"""
Vector store - ChromaDB with two persistent collections:
    • "documents" - prose notes, slides, PDFs
    • "code"      - code files, with language metadata
"""
from __future__ import annotations

import chromadb
from chromadb.config import Settings as ChromaSettings
from functools import lru_cache

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_chroma_client() -> chromadb.PersistentClient:
    settings = get_settings()
    return chromadb.PersistentClient(
        path=settings.chroma_path,
        settings=ChromaSettings(anonymized_telemetry=False),
    )


def get_docs_collection() -> chromadb.Collection:
    client = get_chroma_client()
    return client.get_or_create_collection(
        name="documents",
        metadata={"hnsw:space": "cosine"},
    )


def get_code_collection() -> chromadb.Collection:
    client = get_chroma_client()
    return client.get_or_create_collection(
        name="code",
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(
    chunks: list[dict],  # [{"id", "text", "embedding", "metadata"}]
    collection_name: str = "documents",
) -> int:
    """Upsert chunks into the specified collection. Returns number added."""
    if not chunks:
        return 0

    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )

    collection.upsert(
        ids=[c["id"] for c in chunks],
        documents=[c["text"] for c in chunks],
        embeddings=[c["embedding"] for c in chunks],
        metadatas=[c["metadata"] for c in chunks],
    )
    return len(chunks)


def query_collection(
    embedding: list[float],
    collection_name: str = "documents",
    n_results: int = 20,
    where: dict | None = None,
) -> list[dict]:
    """Semantic search. Returns list of {text, metadata, distance}."""
    client = get_chroma_client()
    collection = client.get_or_create_collection(name=collection_name)

    kwargs: dict = {"query_embeddings": [embedding], "n_results": n_results, "include": ["documents", "metadatas", "distances"]}
    if where:
        kwargs["where"] = where

    results = collection.query(**kwargs)

    docs = []
    for text, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        docs.append({"text": text, "metadata": meta, "score": 1 - dist})
    return docs


def delete_by_source(source_path: str) -> None:
    """Remove all chunks from a file (used when re-ingesting)."""
    for collection in [get_docs_collection(), get_code_collection()]:
        results = collection.get(where={"source": source_path})
        if results["ids"]:
            collection.delete(ids=results["ids"])


def get_stats() -> dict:
    """Return document counts for both collections."""
    return {
        "documents": get_docs_collection().count(),
        "code": get_code_collection().count(),
    }
