from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.rag.pipeline import stream_rag_pipeline, run_rag_pipeline

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str
    history: list[ChatMessage] = []
    stream: bool = True


@router.post("")
async def chat(req: ChatRequest):
    history = [{"role": m.role, "content": m.content} for m in req.history]

    if req.stream:
        return StreamingResponse(
            stream_rag_pipeline(req.query, history),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    # Non-streaming fallback
    result = await run_rag_pipeline(req.query, history)
    return result


@router.get("/health")
async def health():
    return {"status": "ok"}
