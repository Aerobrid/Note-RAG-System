"""
RAG System Backend — FastAPI entry point
"""
from contextlib import asynccontextmanager
import asyncio
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

    print("[startup] Scheduling model preload in background...")
    try:
        loop = asyncio.get_running_loop()
        # Load models in threadpool so startup isn't blocked by heavy model downloads
        loop.run_in_executor(None, get_embedder)
        loop.run_in_executor(None, get_reranker)
    except RuntimeError:
        # If no running loop (very early), fall back to synchronous loads
        try:
            get_embedder()
            get_reranker()
        except Exception:
            pass

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
        redirect_slashes=False,
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
