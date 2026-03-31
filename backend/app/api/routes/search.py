from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Literal

from app.core.ingestion.embedder import embed_query, rerank
from app.db.vector_store import query_collection

router = APIRouter(prefix="/search", tags=["search"])


class SearchResult(BaseModel):
    text: str
    filename: str
    source: str
    doc_type: str
    language: str = ""
    score: float


@router.get("")
async def search(
    q: str = Query(..., description="Search query"),
    collection: Literal["documents", "code", "all"] = "all",
    top_k: int = Query(default=10, le=50),
    rerank_results: bool = True,
):
    """
    Semantic search across your notes.
    Use collection='code' to search only code, 'documents' for notes.
    """
    embedding = embed_query(q)

    if collection == "all":
        doc_results = query_collection(embedding, "documents", n_results=top_k)
        code_results = query_collection(embedding, "code", n_results=top_k)
        results = doc_results + code_results
    else:
        results = query_collection(embedding, collection, n_results=top_k)

    if rerank_results and results:
        results = rerank(q, results, top_k=top_k)

    return {
        "query": q,
        "count": len(results),
        "results": [
            SearchResult(
                text=r["text"],
                filename=r["metadata"].get("filename", "unknown"),
                source=r["metadata"].get("source", ""),
                doc_type=r["metadata"].get("doc_type", "document"),
                language=r["metadata"].get("language", ""),
                score=r.get("rerank_score", r.get("score", 0)),
            )
            for r in results
        ],
    }


@router.get("/code")
async def search_code(
    q: str = Query(...),
    language: str | None = Query(default=None, description="Filter by language, e.g. python"),
    top_k: int = 10,
):
    """Search only code files, with optional language filter."""
    embedding = embed_query(q)
    where = {"language": language} if language else None
    results = query_collection(embedding, "code", n_results=top_k * 2, where=where)
    if results:
        results = rerank(q, results, top_k=top_k)
    return {"query": q, "language": language, "results": results}
