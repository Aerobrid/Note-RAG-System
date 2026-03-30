"""
Ingest API — upload files, trigger ingestion, manage the watchdog auto-indexer.

The watchdog watches ./notes directory and automatically ingests any
new file dropped there. This is the "agentic auto-index" feature.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import shutil
from pathlib import Path

import aiofiles
from fastapi import APIRouter, BackgroundTasks, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from app.core.config import get_settings
from app.core.ingestion.parser import parse_file, DOC_EXTENSIONS, CODE_EXTENSIONS
from app.core.ingestion.chunker import chunk_document
from app.core.ingestion.embedder import embed_texts
from app.db.vector_store import add_chunks, delete_by_source, get_stats

router = APIRouter(prefix="/ingest", tags=["ingest"])

SUPPORTED = DOC_EXTENSIONS | set(CODE_EXTENSIONS.keys())

# Track ingestion progress
_ingestion_status: dict[str, dict] = {}


async def ingest_file_async(file_path: str) -> dict:
    """Full ingestion pipeline for a single file."""
    path = Path(file_path)
    if not path.exists():
        return {"error": f"{path.name} not found"}
    if path.suffix.lower() not in SUPPORTED:
        return {"error": f"{path.suffix} not supported"}

    file_id = hashlib.md5(file_path.encode()).hexdigest()
    _ingestion_status[file_id] = {"status": "parsing", "file": path.name}

    try:
        # 1. Parse
        _ingestion_status[file_id]["status"] = "parsing"
        doc = parse_file(path)

        # 2. Chunk
        _ingestion_status[file_id]["status"] = "chunking"
        chunks = chunk_document(doc)
        if not chunks:
            return {"error": "No chunks extracted"}

        # 3. Embed
        _ingestion_status[file_id]["status"] = "embedding"
        texts = [c.text for c in chunks]
        embeddings = embed_texts(texts)

        # 4. Store - remove old chunks first (idempotent re-ingest)
        delete_by_source(str(path))
        chunk_dicts = [
            {
                "id": c.id,
                "text": c.text,
                "embedding": embeddings[i],
                "metadata": c.metadata,
            }
            for i, c in enumerate(chunks)
        ]
        collection = "code" if doc.doc_type == "code" else "documents"
        added = add_chunks(chunk_dicts, collection_name=collection)

        _ingestion_status[file_id] = {
            "status": "done",
            "file": path.name,
            "chunks": added,
            "collection": collection,
        }
        return _ingestion_status[file_id]

    except Exception as e:
        _ingestion_status[file_id] = {"status": "error", "file": path.name, "error": str(e)}
        raise


@router.post("/upload")
async def upload_files(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
):
    """Upload one or more files and ingest them asynchronously."""
    settings = get_settings()
    notes_dir = Path(settings.notes_dir)
    notes_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for upload in files:
        suffix = Path(upload.filename).suffix.lower()
        if suffix not in SUPPORTED:
            results.append({"file": upload.filename, "error": f"Unsupported format: {suffix}"})
            continue

        dest = notes_dir / upload.filename
        async with aiofiles.open(dest, "wb") as f:
            await f.write(await upload.read())

        # Ingest in background
        background_tasks.add_task(ingest_file_async, str(dest))
        results.append({"file": upload.filename, "status": "queued"})

    return {"results": results}


@router.post("/ingest-path")
async def ingest_path(path: str, background_tasks: BackgroundTasks):
    """Trigger ingestion of a specific file path (used by watchdog)."""
    background_tasks.add_task(ingest_file_async, path)
    return {"status": "queued", "path": path}


@router.get("/status/{file_id}")
async def get_status(file_id: str):
    status = _ingestion_status.get(file_id, {"status": "unknown"})
    return status


@router.get("/stats")
async def get_ingestion_stats():
    return get_stats()


@router.delete("/delete")
async def delete_document(source: str):
    """Remove all chunks for a given source file."""
    delete_by_source(source)
    return {"status": "deleted", "source": source}


# ── Watchdog Auto-Indexer ────────────────────────────────────────────────────

class _NotesFolderHandler(FileSystemEventHandler):
    """Automatically ingest new files dropped into the notes directory."""

    def __init__(self, loop: asyncio.AbstractEventLoop):
        super().__init__()
        self.loop = loop

    def on_created(self, event):
        if event.is_directory:
            return
        path = event.src_path
        if Path(path).suffix.lower() in SUPPORTED:
            print(f"[watchdog] New file detected: {path}")
            asyncio.run_coroutine_threadsafe(
                ingest_file_async(path), self.loop
            )

    def on_moved(self, event):
        if event.is_directory:
            return
        # File moved into the watched folder
        path = event.dest_path
        if Path(path).suffix.lower() in SUPPORTED:
            print(f"[watchdog] File moved in: {path}")
            asyncio.run_coroutine_threadsafe(
                ingest_file_async(path), self.loop
            )


_observer: Observer | None = None


def start_watchdog(notes_dir: str):
    """Start the file watcher in a background thread."""
    global _observer
    if _observer and _observer.is_alive():
        return

    Path(notes_dir).mkdir(parents=True, exist_ok=True)
    loop = asyncio.get_event_loop()
    handler = _NotesFolderHandler(loop)
    _observer = Observer()
    _observer.schedule(handler, notes_dir, recursive=True)
    _observer.start()
    print(f"[watchdog] Watching {notes_dir} for new files...")


def stop_watchdog():
    global _observer
    if _observer:
        _observer.stop()
        _observer.join()
