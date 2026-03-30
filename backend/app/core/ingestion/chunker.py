"""
Chunker — adaptive chunking strategy per content type.
  • Prose/docs : recursive text splitting with overlap
  • Code       : split on function/class boundaries first, then fallback
"""
from __future__ import annotations

import re
import hashlib
from dataclasses import dataclass

from langchain.text_splitter import RecursiveCharacterTextSplitter, Language

from app.core.ingestion.parser import ParsedDocument

LANGUAGE_MAP = {
    "python": Language.PYTHON,
    "javascript": Language.JS,
    "typescript": Language.JS,
    "jsx": Language.JS,
    "tsx": Language.JS,
    "java": Language.JAVA,
    "c": Language.C,
    "c++": Language.CPP,
    "go": Language.GO,
    "rust": Language.RUST,
    "ruby": Language.RUBY,
}


@dataclass
class Chunk:
    id: str
    text: str
    metadata: dict

    @staticmethod
    def make_id(source: str, index: int) -> str:
        base = f"{source}::{index}"
        return hashlib.md5(base.encode()).hexdigest()


def chunk_document(doc: ParsedDocument, chunk_size: int = 1000, overlap: int = 150) -> list[Chunk]:
    """Split a parsed document into chunks appropriate for its type."""
    if doc.doc_type == "code":
        return _chunk_code(doc, chunk_size, overlap)
    return _chunk_prose(doc, chunk_size, overlap)


def _chunk_prose(doc: ParsedDocument, chunk_size: int, overlap: int) -> list[Chunk]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )
    texts = splitter.split_text(doc.text)
    chunks = []
    for i, text in enumerate(texts):
        if len(text.strip()) < 30:
            continue
        chunks.append(Chunk(
            id=Chunk.make_id(doc.source, i),
            text=text.strip(),
            metadata={
                **doc.metadata,
                "chunk_index": i,
                "chunk_total": len(texts),
                "doc_type": "document",
            },
        ))
    return chunks


def _chunk_code(doc: ParsedDocument, chunk_size: int, overlap: int) -> list[Chunk]:
    lang_enum = LANGUAGE_MAP.get(doc.language)

    if lang_enum:
        splitter = RecursiveCharacterTextSplitter.from_language(
            language=lang_enum,
            chunk_size=chunk_size,
            chunk_overlap=overlap,
        )
    else:
        # Fallback for unsupported languages
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=overlap,
            separators=["\n\n", "\n", " "],
        )

    texts = splitter.split_text(doc.text)
    chunks = []
    for i, text in enumerate(texts):
        if len(text.strip()) < 20:
            continue

        # Try to extract function/class name for better metadata
        func_name = _extract_symbol_name(text, doc.language)

        chunks.append(Chunk(
            id=Chunk.make_id(doc.source, i),
            text=text.strip(),
            metadata={
                **doc.metadata,
                "chunk_index": i,
                "chunk_total": len(texts),
                "doc_type": "code",
                "language": doc.language,
                "symbol": func_name,
            },
        ))
    return chunks


def _extract_symbol_name(text: str, language: str) -> str:
    """Extract the first function or class name from a code chunk."""
    patterns = {
        "python": [r"^def\s+(\w+)", r"^class\s+(\w+)", r"^\s+def\s+(\w+)"],
        "javascript": [r"function\s+(\w+)", r"const\s+(\w+)\s*=", r"class\s+(\w+)"],
        "typescript": [r"function\s+(\w+)", r"const\s+(\w+)\s*=", r"class\s+(\w+)", r"interface\s+(\w+)"],
        "java": [r"(?:public|private|protected)?\s+\w+\s+(\w+)\s*\(", r"class\s+(\w+)"],
    }

    for pattern in patterns.get(language, []):
        match = re.search(pattern, text, re.MULTILINE)
        if match:
            return match.group(1)
    return ""
