"""
RAG System Backend — FastAPI entry point
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.ingestion.embedder import get_embedder, get_reranker
from app.api.routes import chat, ingest, search, finetune
from app.api.routes.ingest import start_watchdog, stop_watchdog


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: pre-load models and start watchdog. Shutdown: clean up."""
    settings = get_settings()

    print("[startup] Pre-loading embedding model...")
    get_embedder()

    print("[startup] Pre-loading reranker model...")
    get_reranker()

    print("[startup] Starting file watchdog...")
    start_watchdog(settings.notes_dir)

    print("[startup] RAG System is ready.")
    yield

    print("[shutdown] Stopping watchdog...")
    stop_watchdog()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="RAG System API",
        description="Personal RAG knowledge engine for college notes and code.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(chat.router, prefix="/api")
    app.include_router(ingest.router, prefix="/api")
    app.include_router(search.router, prefix="/api")
    app.include_router(finetune.router, prefix="/api")

    @app.get("/api/health")
    async def health():
        from app.db.vector_store import get_stats
        return {
            "status": "ok",
            "llm_provider": settings.llm_provider,
            "stats": get_stats(),
        }

    return app


app = create_app()
