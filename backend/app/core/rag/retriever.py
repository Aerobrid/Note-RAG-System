"""
Retriever — hybrid semantic + BM25 retrieval with RRF score fusion.
This is the industry-standard approach for production RAG systems.

Reciprocal Rank Fusion (RRF) merges rankings without requiring score normalization.
"""
from __future__ import annotations

import re

from rank_bm25 import BM25Okapi

from app.core.ingestion.embedder import embed_query
from app.db.vector_store import query_collection, get_docs_collection, get_code_collection


def _rrf_merge(
    semantic_results: list[dict],
    bm25_results: list[dict],
    k: int = 60,
) -> list[dict]:
    """Reciprocal Rank Fusion: combine two ranked lists into one."""
    scores: dict[str, float] = {}
    all_docs: dict[str, dict] = {}

    for rank, doc in enumerate(semantic_results):
        doc_id = doc["metadata"].get("source", "") + doc["text"][:50]
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
        all_docs[doc_id] = doc

    for rank, doc in enumerate(bm25_results):
        doc_id = doc["metadata"].get("source", "") + doc["text"][:50]
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
        all_docs[doc_id] = doc

    sorted_ids = sorted(scores, key=lambda x: scores[x], reverse=True)
    results = []
    for doc_id in sorted_ids:
        doc = dict(all_docs[doc_id])
        doc["rrf_score"] = scores[doc_id]
        results.append(doc)
    return results


def _tokenize_bm25(text: str) -> list[str]:
    """Alphanumeric / underscore tokens so paths and code ids (foo.bar) split into foo, bar."""
    return re.findall(r"[a-z0-9_]+", text.lower())


def _bm25_search(query: str, docs: list[dict], top_k: int) -> list[dict]:
    """In-memory BM25 over a candidate set."""
    if not docs:
        return []
    tokenized = [_tokenize_bm25(d["text"]) for d in docs]
    bm25 = BM25Okapi(tokenized)
    scores = bm25.get_scores(_tokenize_bm25(query))
    ranked = sorted(zip(scores, docs), key=lambda x: x[0], reverse=True)
    return [doc for _, doc in ranked[:top_k]]


def retrieve(
    query: str,
    query_type: str = "qa",
    n_candidates: int = 20,
    n_final: int = 10,
) -> list[dict]:
    """
    Hybrid retrieval:
    1. Semantic search (ChromaDB) — top n_candidates
    2. BM25 over those candidates — re-ranks
    3. RRF fusion of both rankings
    Returns n_final results.
    """
    is_code = (query_type == "code")
    embedding = embed_query(query, for_code=is_code)
    collection_name = "code" if is_code else "documents"

    # Semantic results
    semantic_results = query_collection(
        embedding=embedding,
        collection_name=collection_name,
        n_results=n_candidates,
    )

    if not semantic_results:
        return []

    # BM25 over the semantic candidates
    bm25_results = _bm25_search(query, semantic_results, top_k=n_candidates)

    # Fuse rankings
    merged = _rrf_merge(semantic_results, bm25_results)
    return merged[:n_final]


def retrieve_hybrid(
    query: str,
    n_candidates: int = 20,
    n_final: int = 10,
    *,
    code_quota: int | None = None,
) -> list[dict]:
    """Search BOTH collections and merge results — for general queries.

    code_quota: when set, request at least this many candidates from the code
    collection (helps chat find uploaded source files).
    """
    doc_embedding = embed_query(query, for_code=False)
    code_embedding = embed_query(query, for_code=True)

    n_code = max(n_candidates, code_quota or 0)
    doc_results = query_collection(doc_embedding, "documents", n_candidates)
    code_results = query_collection(code_embedding, "code", n_code)

    all_results = doc_results + code_results

    # BM25 over combined set
    bm25_results = _bm25_search(query, all_results, top_k=min(len(all_results), n_candidates * 2))
    merged = _rrf_merge(all_results, bm25_results)
    return merged[:n_final]
