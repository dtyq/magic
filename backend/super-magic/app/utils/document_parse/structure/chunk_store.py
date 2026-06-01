"""Chunk file storage.

Chunks use stable id-based filenames so Code Mode can address them directly from
`document.index.json` without guessing title-derived slugs.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, List

from app.utils.async_file_utils import async_write_text
from ..constants import CHUNKS_DIRNAME
from ..models import DocumentChunk


class ChunkStore:
    """Persist markdown chunks to ``chunks/``."""

    @staticmethod
    async def write_chunks(output_dir: Path, chunks: Iterable[DocumentChunk]) -> List[DocumentChunk]:
        chunks_dir = output_dir / CHUNKS_DIRNAME
        saved: List[DocumentChunk] = []
        for chunk in chunks:
            filename = f"{chunk.chunk_id}.md"
            path = chunks_dir / filename
            await async_write_text(path, chunk.content.rstrip() + "\n")
            chunk.path = str(path.relative_to(output_dir))
            saved.append(chunk)
        return saved
