"""
RAG System Backend — FastAPI entry point
"""
from contextlib import asynccontextmanager
import asyncio
import json
import urllib.error
import urllib.request
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.ingestion.embedder import get_embedder, get_reranker, get_code_embedder
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
        loop.run_in_executor(None, get_code_embedder)
        loop.run_in_executor(None, get_reranker)
    except RuntimeError:
        # If no running loop (very early), fall back to synchronous loads
        try:
            get_embedder()
            get_code_embedder()
            get_reranker()
        except Exception:
            pass

    print("[startup] Starting file watchdog...")
    start_watchdog(settings.notes_dir)

    print("[startup] RAG System is ready.")
    yield

    print("[shutdown] Stopping watchdog...")
    stop_watchdog()


def _ollama_reachable(base_url: str) -> dict:
    """Lightweight check against Ollama's HTTP API (no LLM generation)."""
    url = base_url.rstrip("/") + "/api/tags"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            data = json.loads(resp.read().decode())
            names = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
            return {"reachable": True, "models_installed": len(names), "sample_models": names[:5]}
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, OSError) as e:
        return {"reachable": False, "error": str(e)[:200]}


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
        """Fast liveness check — no Chroma or embedding load. Optional Ollama reachability."""
        payload: dict = {
            "status": "ok",
            "llm_provider": settings.llm_provider,
        }
        if settings.llm_provider == "ollama":
            payload["ollama"] = await asyncio.to_thread(_ollama_reachable, settings.ollama_base_url)
        else:
            payload["gemini_configured"] = bool(settings.gemini_api_key.strip())
        return payload

    return app


app = create_app()
