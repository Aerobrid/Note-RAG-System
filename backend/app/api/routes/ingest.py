"""
Ingest API — upload files, trigger ingestion, manage the watchdog auto-indexer.

The watchdog watches ./notes directory and automatically ingests any
new file dropped there. This is the "agentic auto-index" feature.
"""
from __future__ import annotations
import asyncio

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

import hashlib
import shutil
from pathlib import Path


import aiofiles
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.core.security_paths import assert_under_notes, notes_dir_resolved, safe_upload_filename
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
        embeddings = await embed_texts(texts, for_code=(doc.doc_type == "code"))

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
    notes_root = notes_dir_resolved(settings)

    for upload in files:
        try:
            safe_name = safe_upload_filename(upload.filename)
        except HTTPException as e:
            detail = e.detail if isinstance(e.detail, str) else str(e.detail)
            results.append({"file": upload.filename or "", "error": detail})
            continue

        suffix = Path(safe_name).suffix.lower()
        if suffix not in SUPPORTED:
            results.append({"file": safe_name, "error": f"Unsupported format: {suffix}"})
            continue

        dest = (notes_dir / safe_name).resolve()
        try:
            assert_under_notes(dest, notes_root)
        except HTTPException as e:
            results.append({"file": safe_name, "error": e.detail})
            continue

        # Stream-upload to disk in chunks to avoid buffering entire file in memory
        hash_obj = hashlib.sha256()
        chunk_size = 1024 * 1024  # 1MB
        async with aiofiles.open(dest, "wb") as f:
            while True:
                chunk = await upload.read(chunk_size)
                if not chunk:
                    break
                await f.write(chunk)
                hash_obj.update(chunk)

        upload_hash = hash_obj.hexdigest()
        upload_size = dest.stat().st_size

        # Compare content hash only against same-sized files (avoids reading the whole notes tree each upload)
        duplicate_of: str | None = None
        for other in notes_dir.iterdir():
            if not other.is_file() or other.resolve() == dest:
                continue
            try:
                if other.stat().st_size != upload_size:
                    continue
            except OSError:
                continue
            with open(other, "rb") as rf:
                if hashlib.sha256(rf.read()).hexdigest() == upload_hash:
                    duplicate_of = other.name
                    break

        if duplicate_of:
            try:
                dest.unlink()
            except OSError:
                pass
            results.append({
                "file": safe_name,
                "status": "skipped",
                "reason": f"Duplicate of {duplicate_of} by content hash",
            })
            continue

        # Ingest in background
        background_tasks.add_task(ingest_file_async, str(dest))
        results.append({"file": safe_name, "status": "queued"})

    return {"results": results}


@router.post("/ingest-path")
async def ingest_path(path: str, background_tasks: BackgroundTasks):
    """Trigger ingestion of a specific file path (used by watchdog)."""
    settings = get_settings()
    root = notes_dir_resolved(settings)
    raw = Path(path)
    target = raw.resolve() if raw.is_absolute() else (Path(settings.notes_dir) / raw).resolve()
    assert_under_notes(target, root)
    background_tasks.add_task(ingest_file_async, str(target))
    return {"status": "queued", "path": str(target)}


@router.get("/status/{file_id}")
async def get_status(file_id: str):
    status = _ingestion_status.get(file_id, {"status": "unknown"})
    return status


@router.get("/stats")
async def get_ingestion_stats():
    try:
        return await asyncio.wait_for(asyncio.to_thread(get_stats), timeout=8.0)
    except asyncio.TimeoutError:
        return {"documents": 0, "code": 0, "error": "Vector store stats timed out"}


@router.get("/files")
async def list_files():
    """List all successfully indexed files currently residing in the backend notes directory."""
    settings = get_settings()
    notes_dir = Path(settings.notes_dir)
    files = []
    if notes_dir.exists() and notes_dir.is_dir():
        for item in notes_dir.iterdir():
            if item.is_file():
                files.append({
                    "name": item.name,
                    "size": item.stat().st_size,
                })
    return {"files": files}


@router.delete("/delete/{filename}")
async def delete_document_by_name(filename: str):
    """Remove all chunks for a given file name and delete it from local disk."""
    settings = get_settings()
    notes_dir = Path(settings.notes_dir).resolve()
    
    # Safe path resolution
    target = (notes_dir / filename).resolve()
    assert_under_notes(target, notes_dir)
    
    # Delete from Chromadb
    delete_by_source(str(target))
    
    # Delete from local file system
    if target.exists() and target.is_file():
        target.unlink()
        
    return {"status": "deleted", "filename": filename}


@router.delete("/clear")
async def clear_all_documents():
    """Clear all vector data and empty the notes directory."""
    from app.db.vector_store import clear_all
    
    # Empty DB
    clear_all()
    
    # Wipe notes folder
    settings = get_settings()
    notes_dir = Path(settings.notes_dir)
    if notes_dir.exists() and notes_dir.is_dir():
        for item in notes_dir.iterdir():
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                shutil.rmtree(item)
                
    return {"status": "cleared"}


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
