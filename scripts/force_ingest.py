import asyncio
import os
import sys
from pathlib import Path

# Add backend to path so we can import app modules
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.api.routes.ingest import ingest_file_async
from app.core.config import get_settings

async def force_ingest_all():
    settings = get_settings()
    notes_dir = Path(settings.notes_dir)
    
    if not notes_dir.exists():
        print(f"Notes directory {notes_dir} does not exist.")
        return

    files = list(notes_dir.glob("*"))
    print(f"Found {len(files)} files in {notes_dir}. Starting ingestion...")

    for i, file_path in enumerate(files):
        if file_path.is_file():
            print(f"[{i+1}/{len(files)}] Ingesting {file_path.name}...")
            try:
                result = await ingest_file_async(str(file_path))
                if "error" in result:
                    print(f"  ! Error: {result['error']}")
                else:
                    print(f"  ✓ Done: {result['status']}")
            except Exception as e:
                print(f"  ! Failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(force_ingest_all())
