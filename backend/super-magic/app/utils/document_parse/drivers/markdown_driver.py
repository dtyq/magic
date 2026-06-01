"""Markdown structured parsing driver."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.utils.async_file_utils import async_read_text, async_stat
from ..constants import MARKDOWN_EXTENSIONS
from ..models import DocumentProfile, ExtractionResult, stable_document_id
from ..structure.chunk_store import ChunkStore
from ..structure.chunker import DocumentChunker
from ..structure.heading_detector import HeadingDetector
from ..structure.outline_builder import OutlineBuilder
from .base import DocumentDriver


class MarkdownDocumentDriver(DocumentDriver):
    file_type = "markdown"
    unit_type = "section"
    supported_extensions = MARKDOWN_EXTENSIONS

    async def inspect(self, path: Path) -> DocumentProfile:
        text = await async_read_text(path, errors="ignore")
        nodes = OutlineBuilder.build_tree(HeadingDetector.detect(text))
        file_stat = await async_stat(path)
        return DocumentProfile(
            source_path=str(path),
            file_name=path.name,
            file_type=self.file_type,
            file_extension=path.suffix.lower(),
            file_size=file_stat.st_size,
            unit_type=self.unit_type,
            total_units=len(nodes) or 1,
            title=path.name,
            outline=nodes,
            samples=[{"range": "start", "content": text[:1000]}],
            recommended_strategy="read outline then target sections",
        )

    async def extract(self, path: Path, output_dir: Path, ranges: Optional[str] = None, mode: str = "auto", max_chars: int = 12000, **kwargs):
        text = await async_read_text(path, errors="ignore")
        chunks = DocumentChunker.chunk_text(text, path.name, ranges or "all", max_chars=max_chars)
        chunks = await ChunkStore.write_chunks(output_dir, chunks)
        nodes = OutlineBuilder.build_tree(HeadingDetector.detect(text))
        return ExtractionResult(
            document_id=stable_document_id(path),
            source_path=str(path),
            output_dir=str(output_dir),
            chunks=chunks,
            nodes=nodes,
            total_units=len(chunks),
            pages_processed=len(chunks),
            metadata={"mode": mode},
        )
