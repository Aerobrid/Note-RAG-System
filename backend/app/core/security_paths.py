"""Resolve and validate paths under the configured notes directory."""
from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException


def notes_dir_resolved(settings) -> Path:
    return Path(settings.notes_dir).resolve()


def safe_upload_filename(raw: str | None) -> str:
    """Single path segment only — blocks path traversal via upload names."""
    if not raw or not raw.strip():
        raise HTTPException(status_code=400, detail="Invalid filename")
    name = Path(raw).name
    if not name or name in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid filename")
    return name


def assert_under_notes(path: Path, notes_root: Path) -> Path:
    """Ensure resolved path is notes_root or a file/dir inside it."""
    resolved = path.resolve()
    root = notes_root.resolve()
    if resolved == root:
        return resolved
    try:
        resolved.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=400, detail="Path must be under the notes directory")
    return resolved
