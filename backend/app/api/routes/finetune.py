"""Fine-tuning endpoints - trigger dataset generation and LoRA training."""
from __future__ import annotations

import asyncio
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.core.config import get_settings

router = APIRouter(prefix="/finetune", tags=["finetune"])

# Track fine-tune job state
_job_state: dict = {"status": "idle", "progress": 0, "message": ""}


class FinetuneRequest(BaseModel):
    n_pairs_per_chunk: int = 3
    max_chunks: int = 300
    epochs: int = 3
    batch_size: int = 4


@router.post("/generate-dataset")
async def generate_dataset(
    background_tasks: BackgroundTasks,
    n_pairs: int = 3,
    max_chunks: int = 300,
):
    """
    Step 1: Generate Q&A pairs from your indexed notes.
    This uses Gemini/Ollama to create the training dataset.
    """
    from app.core.finetune.data_prep import build_dataset

    global _job_state
    if _job_state["status"] == "running":
        raise HTTPException(400, "A job is already running.")

    _job_state = {"status": "running", "phase": "dataset", "progress": 0, "message": "Generating Q&A pairs..."}

    def progress(i, total):
        _job_state["progress"] = int(i / total * 100)
        _job_state["message"] = f"Processing chunk {i}/{total}"

    async def run():
        global _job_state
        try:
            result = await build_dataset(
                n_pairs_per_chunk=n_pairs,
                max_chunks=max_chunks,
                progress_callback=progress,
            )
            _job_state = {"status": "done", "phase": "dataset", "progress": 100, "result": result}
        except Exception as e:
            _job_state = {"status": "error", "message": str(e)}

    background_tasks.add_task(run)
    return {"status": "started", "message": "Dataset generation queued"}


@router.post("/train")
async def train(background_tasks: BackgroundTasks, req: FinetuneRequest):
    """
    Step 2: Run LoRA fine-tuning on the generated dataset.
    Requires NVIDIA GPU. Set LLM_PROVIDER=ollama after to use your fine-tuned model.
    """
    from app.core.finetune.trainer import run_finetune

    global _job_state
    if _job_state["status"] == "running":
        raise HTTPException(400, "A job is already running.")

    settings = get_settings()
    _job_state = {"status": "running", "phase": "training", "progress": 0, "message": "Starting fine-tune..."}

    def progress(msg: str, pct: int):
        _job_state["progress"] = pct
        _job_state["message"] = msg

    async def _train_async():
        global _job_state
        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(
                None,
                lambda: run_finetune(
                    dataset_path="./finetune_data.jsonl",
                    output_dir=settings.finetune_output_dir,
                    base_model=settings.finetune_base_model,
                    epochs=req.epochs,
                    batch_size=req.batch_size,
                    progress_callback=progress,
                ),
            )
            _job_state = {"status": "done", "phase": "training", "progress": 100, "result": result}
        except Exception as e:
            _job_state = {"status": "error", "message": str(e)}

    background_tasks.add_task(_train_async)
    return {"status": "started", "message": "Training queued. Check /finetune/status"}


@router.get("/status")
async def get_status():
    return _job_state
