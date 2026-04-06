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

import asyncio
import json
import re
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

ROUTER_PROMPT = """You are a query router for a personal knowledge base of lecture notes and uploaded files (including source code).
Classify the query into one of:
- "code"   - programming, algorithms, debugging, refactoring, or questions clearly about source code behavior
- "qa"     - concepts, theory, definitions from notes only (no code files needed)
- "hybrid" - needs both, OR the user refers to "my file", "the script I uploaded", a filename, or anything that could be in notes or code

Respond with ONLY one word: code, qa, or hybrid."""

# Fast path: skip an LLM round-trip when the query clearly concerns code or uploads.
_CODE_EXT_RE = re.compile(
    r"\.(py|js|mjs|cjs|ts|tsx|jsx|java|c|cpp|cc|cxx|h|hpp|cs|go|rs|rb|php|swift|kt|kts|sql|sh|bash|"
    r"r|m|ipynb|json|yaml|yml|toml|xml|html|css|scss|vue|svelte)\b",
    re.IGNORECASE,
)


def _heuristic_query_type(query: str) -> str | None:
    q = query.strip()
    if not q:
        return None
    low = q.lower()
    if _CODE_EXT_RE.search(q):
        return "hybrid"
    upload_hints = (
        "uploaded", "my file", "my code", "this file", "the file", "script i", "in my repo",
        "source file", "snippet", "repository",
    )
    if any(h in low for h in upload_hints):
        return "hybrid"
    code_hints = (
        "def ", "class ", "import ", "function ", "stack trace", "traceback", "refactor",
        "debug", "compiler", "runtime error", "exception", "npm ", "pip ", "git ",
    )
    if any(h in low for h in code_hints):
        return "code"
    return None

QA_SYSTEM_PROMPT = """Answer using ONLY the provided context (notes, slides, PDFs, and any code excerpts included there).
- Be precise; if the context is insufficient, say so
- Cite sources as [Source: filename]
- Use clear markdown for formulas"""

CODE_SYSTEM_PROMPT = """Answer using ONLY the provided context from the user's indexed source files.
- Name functions, classes, or files you rely on
- Explain behavior in plain language; use fenced code blocks for snippets
- Cite [Source: filename] for each code reference"""


# ── Node functions ───────────────────────────────────────────────────────────

def route_query(state: RAGState) -> RAGState:
    """Classify query type using a cheap heuristic first, then LLM if needed."""
    guessed = _heuristic_query_type(state["query"])
    if guessed:
        return {**state, "query_type": guessed}

    llm = get_llm()
    messages = [
        SystemMessage(content=ROUTER_PROMPT),
        HumanMessage(content=state["query"]),
    ]
    response = llm.invoke(messages)
    query_type = (response.content or "").strip().lower()
    if query_type not in ("code", "qa", "hybrid"):
        query_type = "qa"

    return {**state, "query_type": query_type}


def retrieve_docs(state: RAGState) -> RAGState:
    """Retrieve candidates from the appropriate collection(s).

    Note: plain "qa" still searches both Chroma collections so uploaded code files
    are reachable from chat (search already used collection=all; chat must match).
    """
    query_type = state["query_type"]
    q = state["query"]

    if query_type == "code":
        candidates = retrieve(q, query_type="code", n_candidates=28, n_final=15)
    else:
        # qa + hybrid: notes + code (extra code quota helps natural-language questions about files)
        candidates = retrieve_hybrid(
            q, n_candidates=24, n_final=18, code_quota=28,
        )

    return {**state, "candidates": candidates}


def rerank_docs(state: RAGState) -> RAGState:
    """Cross-encoder reranking of candidates."""
    # Build context string with citations (default rerank top_k=5 was too small for code + notes)
    n = len(state["candidates"])
    reranked = rerank(state["query"], state["candidates"], top_k=max(1, min(n, 15)))
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

    def _sync_run() -> dict:
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
        final_state = graph.invoke(initial_state)
        return {
            "response": final_state["response"],
            "sources": final_state["sources"],
            "query_type": final_state["query_type"],
        }

    return await asyncio.to_thread(_sync_run)


async def stream_rag_pipeline(
    query: str,
    history: list[dict] | None = None,
) -> AsyncIterator[str]:
    """
    Streaming version - yields tokens as they arrive.
    Route / retrieve / rerank run in a worker thread so embedding and reranker
    do not block the asyncio event loop; then the LLM streams on the loop.
    """
    hist = history or []

    def _sync_retrieval() -> tuple[RAGState, RAGState]:
        initial: RAGState = {
            "query": query, "query_type": "qa", "candidates": [],
            "reranked": [], "context": "", "response": "",
            "sources": [], "history": hist,
            "retry_count": 0, "stream_tokens": [],
        }
        route_state = route_query(initial)
        retrieved_state = retrieve_docs(route_state)
        return route_state, rerank_docs(retrieved_state)

    route_state, reranked_state = await asyncio.to_thread(_sync_retrieval)
    is_code = route_state["query_type"] == "code"
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
    try:
        async for chunk in llm.astream(messages):
            token = chunk.content
            if token:
                payload = json.dumps({"type": "token", "content": token})
                yield f"data: {payload}\n\n"
    except Exception as e:
        # Send an error chunk so proxies/clients receive a clean SSE message
        err = json.dumps({"type": "error", "message": str(e)})
        yield f"data: {err}\n\n"

    yield "data: [DONE]\n\n"
