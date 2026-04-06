"""
Embedder — BAAI/bge-large-en-v1.5 running locally via sentence-transformers.
Free, no API key, high quality (outperforms OpenAI ada-002 on MTEB).
"""
from __future__ import annotations

from functools import lru_cache
import numpy as np
from sentence_transformers import SentenceTransformer, CrossEncoder

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_embedder() -> SentenceTransformer:
    settings = get_settings()
    print(f"[embedder] Loading {settings.embed_model}...")
    model = SentenceTransformer(settings.embed_model)
    print("[embedder] Ready.")
    return model


@lru_cache(maxsize=1)
def get_code_embedder() -> SentenceTransformer:
    settings = get_settings()
    print(f"[code-embedder] Loading {settings.code_embed_model}...")
    model = SentenceTransformer(settings.code_embed_model)
    print("[code-embedder] Ready.")
    return model


@lru_cache(maxsize=1)
def get_reranker() -> CrossEncoder:
    settings = get_settings()
    print(f"[reranker] Loading {settings.reranker_model}...")
    model = CrossEncoder(settings.reranker_model, max_length=512)
    print("[reranker] Ready.")
    return model


def embed_texts(texts: list[str], batch_size: int = 64, for_code: bool = False) -> list[list[float]]:
    """Embed a list of texts. Runs encoding in a thread to avoid blocking the event loop.

    This function is async-friendly: call it with `await embed_texts(...)`.
    """
    import asyncio

    def _encode():
        model = get_code_embedder() if for_code else get_embedder()
        embeddings = model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=len(texts) > 50,
        )
        return embeddings.tolist()

    return asyncio.to_thread(_encode)


def embed_query(query: str, for_code: bool = False) -> list[float]:
    """Embed a single query. Uses instruction prefix for document embedder but not code embedder."""
    if for_code:
        model = get_code_embedder()
        embedding = model.encode(query, normalize_embeddings=True)
        return embedding.tolist()

    model = get_embedder()
    # BGE-large uses an instruction prefix for retrieval queries
    instructed = f"Represent this sentence for searching relevant passages: {query}"
    embedding = model.encode(instructed, normalize_embeddings=True)
    return embedding.tolist()


def rerank(query: str, docs: list[dict], top_k: int = 5) -> list[dict]:
    """
    Cross-encoder reranking: takes semantic candidates and reorders
    by relevance. Returns top_k most relevant docs.
    """
    if not docs:
        return []

    reranker = get_reranker()
    pairs = [(query, doc["text"]) for doc in docs]
    scores = reranker.predict(pairs)

    ranked = sorted(
        zip(scores, docs),
        key=lambda x: x[0],
        reverse=True,
    )
    result = []
    for score, doc in ranked[:top_k]:
        doc_copy = dict(doc)
        doc_copy["rerank_score"] = float(score)
        result.append(doc_copy)
    return result
