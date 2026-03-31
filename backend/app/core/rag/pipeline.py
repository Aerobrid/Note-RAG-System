"""
LangGraph Agentic RAG Pipeline

Graph:
    START -> route_query -> retrieve -> rerank -> generate -> END
                                        ↓ (code)
                                 retrieve_code -> rerank -> generate -> END

Nodes:
    route_query   - classify query as "qa", "code", or "hybrid"
    retrieve      - hybrid semantic+BM25 from the right collection
    rerank        - cross-encoder reranking
    generate      - LLM generation with citations
    check         - hallucination check, retry if score too low
"""
from __future__ import annotations

import json
from typing import TypedDict, Literal, AsyncIterator

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END, START

from app.core.ingestion.embedder import rerank
from app.core.rag.retriever import retrieve, retrieve_hybrid
from app.core.llm.provider import get_llm, build_messages


# ── State ──────────────────────────────────────────────────────────────────

class RAGState(TypedDict):
    query: str
    query_type: str                # "qa" | "code" | "hybrid"
    candidates: list[dict]         # raw retrieval results
    reranked: list[dict]           # post-reranking results
    context: str                   # formatted context string for LLM
    response: str                  # final answer
    sources: list[dict]            # source citations
    history: list[dict]            # conversation history
    retry_count: int
    stream_tokens: list[str]       # accumulated streaming tokens


# ── Prompts ─────────────────────────────────────────────────────────────────

ROUTER_PROMPT = """You are a query router for a personal knowledge base of college lecture notes and code.
Classify the query into one of:
- "code"   - questions about code, programming, algorithms, data structures, debugging
- "qa"     - questions about concepts, theory, definitions from lecture notes
- "hybrid" - questions that need both notes and code (e.g. "show me the code from today's lecture on sorting")

Respond with ONLY one word: code, qa, or hybrid."""

QA_SYSTEM_PROMPT = """You are a personal knowledge assistant trained on the user's own college notes.
Answer questions using ONLY the provided context from their notes.
- Be precise and academic
- If the context doesn't contain enough information, say so honestly
- Always cite which source the information came from using [Source: filename]
- Format math/formulas clearly using markdown"""

CODE_SYSTEM_PROMPT = """You are a code-aware study assistant with access to the user's code files.
When answering:
- Reference specific functions, classes, or lines from their code
- Explain what the code does in plain English
- Point out patterns, bugs, or improvements if relevant
- Use markdown code blocks for all code snippets
- Always cite [Source: filename] when referencing their code"""


# ── Node functions ───────────────────────────────────────────────────────────

def route_query(state: RAGState) -> RAGState:
    """Classify query type using LLM."""
    llm = get_llm()
    messages = [
        SystemMessage(content=ROUTER_PROMPT),
        HumanMessage(content=state["query"]),
    ]
    response = llm.invoke(messages)
    query_type = response.content.strip().lower()
    if query_type not in ("code", "qa", "hybrid"):
        query_type = "qa"

    return {**state, "query_type": query_type}


def retrieve_docs(state: RAGState) -> RAGState:
    """Retrieve candidates from the appropriate collection."""
    query_type = state["query_type"]

    if query_type == "hybrid":
        candidates = retrieve_hybrid(state["query"], n_candidates=25, n_final=15)
    else:
        candidates = retrieve(state["query"], query_type=query_type, n_candidates=25, n_final=15)

    return {**state, "candidates": candidates}


def rerank_docs(state: RAGState) -> RAGState:
    """Cross-encoder reranking of candidates."""
    # Build context string with citations
    reranked = rerank(state["query"], state["candidates"])
    context_parts = []
    sources = []
    for i, doc in enumerate(reranked, 1):
        meta = doc["metadata"]
        filename = meta.get("filename", "unknown")
        doc_type = meta.get("doc_type", "document")
        lang = meta.get("language", "")

        source_label = f"[{i}] {filename}"
        if doc_type == "code" and lang:
            source_label += f" ({lang})"
        context_parts.append(f"{source_label}:\n{doc['text']}")

        sources.append({
            "index": i,
            "filename": filename,
            "source": meta.get("source", ""),
            "doc_type": doc_type,
            "score": doc.get("rerank_score", 0),
        })

    context = "\n\n---\n\n".join(context_parts)
    return {**state, "reranked": reranked, "context": context, "sources": sources}


def generate_response(state: RAGState) -> RAGState:
    """Generate LLM response (non-streaming, used internally in graph)."""
    is_code = state["query_type"] == "code"
    system_prompt = CODE_SYSTEM_PROMPT if is_code else QA_SYSTEM_PROMPT
    llm = get_llm(for_code=is_code)

    messages = build_messages(
        system_prompt=system_prompt,
        user_query=state["query"],
        history=state.get("history", []),
        context=state["context"],
    )

    response = llm.invoke(messages)
    return {**state, "response": response.content}


def should_retry(state: RAGState) -> Literal["end", "retry"]:
    '''Simple hallucination check - retry if response says "I don't know" but we have context.'''
    retry_count = state.get("retry_count", 0)
    if retry_count >= 1:
        return "end"

    response = state.get("response", "").lower()
    has_context = bool(state.get("context"))
    uncertain_phrases = ["i don't have", "i don't know", "no information", "cannot find"]
    if has_context and any(phrase in response for phrase in uncertain_phrases):
        return "retry"
    return "end"


def increment_retry(state: RAGState) -> RAGState:
    return {**state, "retry_count": state.get("retry_count", 0) + 1}


# ── Graph definition ─────────────────────────────────────────────────────────

def build_rag_graph():
    graph = StateGraph(RAGState)

    graph.add_node("route_query", route_query)
    graph.add_node("retrieve_docs", retrieve_docs)
    graph.add_node("rerank_docs", rerank_docs)
    graph.add_node("generate_response", generate_response)
    graph.add_node("increment_retry", increment_retry)

    graph.add_edge(START, "route_query")
    graph.add_edge("route_query", "retrieve_docs")
    graph.add_edge("retrieve_docs", "rerank_docs")
    graph.add_edge("rerank_docs", "generate_response")

    graph.add_conditional_edges(
        "generate_response",
        should_retry,
        {"end": END, "retry": "increment_retry"},
    )
    graph.add_edge("increment_retry", "generate_response")

    return graph.compile()


# Singleton compiled graph
_rag_graph = None

def get_rag_graph():
    global _rag_graph
    if _rag_graph is None:
        _rag_graph = build_rag_graph()
    return _rag_graph


async def run_rag_pipeline(
    query: str,
    history: list[dict] | None = None,
) -> dict:
    """Run the full agentic RAG pipeline and return result."""
    graph = get_rag_graph()
    initial_state: RAGState = {
        "query": query,
        "query_type": "qa",
        "candidates": [],
        "reranked": [],
        "context": "",
        "response": "",
        "sources": [],
        "history": history or [],
        "retry_count": 0,
        "stream_tokens": [],
    }
    final_state = await graph.ainvoke(initial_state)
    return {
        "response": final_state["response"],
        "sources": final_state["sources"],
        "query_type": final_state["query_type"],
    }


async def stream_rag_pipeline(
    query: str,
    history: list[dict] | None = None,
) -> AsyncIterator[str]:
    """
    Streaming version - yields tokens as they arrive.
    The graph runs route->retrieve->rerank synchronously,
    then streams the generator step.
    """
    is_code = False
    sources = []

    # Run retrieval stages synchronously first
    initial: RAGState = {
        "query": query, "query_type": "qa", "candidates": [],
        "reranked": [], "context": "", "response": "",
        "sources": [], "history": history or [],
        "retry_count": 0, "stream_tokens": [],
    }
    route_state = route_query(initial)
    is_code = route_state["query_type"] == "code"

    retrieved_state = retrieve_docs(route_state)
    reranked_state = rerank_docs(retrieved_state)
    sources = reranked_state["sources"]

    # Stream the generation
    system_prompt = CODE_SYSTEM_PROMPT if is_code else QA_SYSTEM_PROMPT
    llm = get_llm(for_code=is_code)
    messages = build_messages(
        system_prompt=system_prompt,
        user_query=query,
        history=history or [],
        context=reranked_state["context"],
    )

    # Yield query type and sources as first JSON chunk
    meta = json.dumps({
        "type": "meta",
        "query_type": route_state["query_type"],
        "sources": sources,
    })
    yield f"data: {meta}\n\n"

    # Stream tokens
    async for chunk in llm.astream(messages):
        token = chunk.content
        if token:
            payload = json.dumps({"type": "token", "content": token})
            yield f"data: {payload}\n\n"

    yield "data: [DONE]\n\n"
