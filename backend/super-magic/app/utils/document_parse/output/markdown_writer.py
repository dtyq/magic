"""Markdown writer for combined outputs."""

from __future__ import annotations

from pathlib import Path

from app.utils.async_file_utils import async_write_text
from ..models import DocumentChunk


class MarkdownWriter:
    @staticmethod
    async def write_combined(output_path: Path, chunks: list[DocumentChunk], title: str) -> Path:
        parts = [f"# {title}", ""]
        for chunk in chunks:
            parts.extend([f"## {chunk.title}", "", chunk.content.rstrip(), ""])
        await async_write_text(output_path, "\n".join(parts).rstrip() + "\n")
        return output_path
