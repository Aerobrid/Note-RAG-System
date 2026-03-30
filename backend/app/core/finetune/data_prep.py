"""
Fine-tuning Data Prep - auto-generate Q&A pairs from your notes using Gemini/Ollama.
This creates a personalized instruction dataset for LoRA fine-tuning.

Output format: Alpaca-style JSONL
    {"instruction": "...", "input": "", "output": "..."}
"""
from __future__ import annotations

import json
import random
from pathlib import Path

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm.provider import get_llm
from app.db.vector_store import get_docs_collection, get_code_collection

QA_GEN_PROMPT = """You are creating a study Q&A dataset from lecture notes.
Given a passage from lecture notes, generate {n} diverse question-answer pairs.
The questions should vary: some factual, some conceptual, some application-based.

Format your response as a JSON array:
[
  {{"question": "...", "answer": "..."}},
  ...
]

Only output the JSON array, nothing else."""

CODE_QA_GEN_PROMPT = """You are creating a programming Q&A dataset from code files.
Given a code snippet, generate {n} question-answer pairs about:
- What the code does
- How specific functions work
- Time/space complexity if relevant
- How you would use or modify it

Format as JSON array:
[
  {{"question": "...", "answer": "..."}},
  ...
]

Only output the JSON array, nothing else."""


def _format_alpaca(question: str, answer: str) -> dict:
    return {
        "instruction": question,
        "input": "",
        "output": answer,
    }


async def generate_qa_pairs(
    text: str,
    is_code: bool = False,
    n_pairs: int = 3,
) -> list[dict]:
    """Use the LLM to generate Q&A pairs from a text chunk."""
    llm = get_llm(for_code=is_code)
    prompt = CODE_QA_GEN_PROMPT if is_code else QA_GEN_PROMPT

    messages = [
        SystemMessage(content=prompt.format(n=n_pairs)),
        HumanMessage(content=text[:3000]),  # Cap context length
    ]

    try:
        response = llm.invoke(messages)
        raw = response.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        pairs = json.loads(raw)
        return [_format_alpaca(p["question"], p["answer"]) for p in pairs]
    except (json.JSONDecodeError, KeyError, Exception):
        return []


async def build_dataset(
    output_path: str = "./finetune_data.jsonl",
    n_pairs_per_chunk: int = 3,
    max_chunks: int = 500,
    progress_callback=None,
) -> dict:
    """
    Build a full fine-tuning dataset from all indexed documents.
    Samples up to max_chunks chunks from ChromaDB and generates Q&A pairs.
    """
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    doc_collection = get_docs_collection()
    code_collection = get_code_collection()

    # Fetch all chunks
    doc_data = doc_collection.get(include=["documents", "metadatas"])
    code_data = code_collection.get(include=["documents", "metadatas"])

    all_chunks = []
    for text, meta in zip(doc_data["documents"], doc_data["metadatas"]):
        all_chunks.append({"text": text, "meta": meta, "is_code": False})
    for text, meta in zip(code_data["documents"], code_data["metadatas"]):
        all_chunks.append({"text": text, "meta": meta, "is_code": True})

    # Sample if too many
    if len(all_chunks) > max_chunks:
        all_chunks = random.sample(all_chunks, max_chunks)

    total_pairs = 0
    with output.open("w", encoding="utf-8") as f:
        for i, chunk in enumerate(all_chunks):
            if progress_callback:
                progress_callback(i, len(all_chunks))

            if len(chunk["text"].strip()) < 100:
                continue

            pairs = await generate_qa_pairs(
                chunk["text"],
                is_code=chunk["is_code"],
                n_pairs=n_pairs_per_chunk,
            )
            for pair in pairs:
                f.write(json.dumps(pair, ensure_ascii=False) + "\n")
                total_pairs += 1

    return {
        "dataset_path": str(output),
        "total_chunks_processed": len(all_chunks),
        "total_qa_pairs": total_pairs,
    }
