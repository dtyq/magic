"""Markdown chunking helpers."""

from __future__ import annotations

from typing import List, Optional

from ..constants import DEFAULT_CHUNK_MAX_CHARS
from ..models import DocumentChunk


class DocumentChunker:
    """Split content into chunks while preserving a source range label."""

    @staticmethod
    def chunk_text(
        content: str,
        title: str,
        source_range: str,
        max_chars: int = DEFAULT_CHUNK_MAX_CHARS,
        parent_node_id: Optional[str] = None,
    ) -> List[DocumentChunk]:
        text = content.strip()
        if not text:
            return []

        chunks: List[DocumentChunk] = []
        paragraphs = text.split("\n\n")
        current: List[str] = []
        current_len = 0

        def flush() -> None:
            nonlocal current, current_len
            if not current:
                return
            index = len(chunks) + 1
            chunks.append(DocumentChunk(
                chunk_id=f"chunk_{index:04d}",
                title=title if index == 1 else f"{title} ({index})",
                content="\n\n".join(current).strip(),
                source_range=source_range,
                parent_node_id=parent_node_id,
            ))
            current = []
            current_len = 0

        for paragraph in paragraphs:
            if current and current_len + len(paragraph) + 2 > max_chars:
                flush()
            if len(paragraph) > max_chars:
                flush()
                for start in range(0, len(paragraph), max_chars):
                    part = paragraph[start:start + max_chars]
                    index = len(chunks) + 1
                    chunks.append(DocumentChunk(
                        chunk_id=f"chunk_{index:04d}",
                        title=f"{title} ({index})",
                        content=part,
                        source_range=source_range,
                        parent_node_id=parent_node_id,
                    ))
                continue
            current.append(paragraph)
            current_len += len(paragraph) + 2
        flush()

        for index, chunk in enumerate(chunks):
            if index > 0:
                chunk.previous_chunk_id = chunks[index - 1].chunk_id
            if index + 1 < len(chunks):
                chunk.next_chunk_id = chunks[index + 1].chunk_id
        return chunks
