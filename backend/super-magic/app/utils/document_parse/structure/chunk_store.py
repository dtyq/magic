"""Chunk file storage.

Chunks use stable id-based filenames so Code Mode can address them directly from
`document.index.json` without guessing title-derived slugs.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, List

from app.utils.async_file_utils import async_exists, async_is_file, async_iterdir, async_write_text

from ..constants import CHUNKS_DIRNAME
from ..models import DocumentChunk


class ChunkStore:
    """Persist markdown chunks to ``chunks/``."""

    @staticmethod
    async def write_chunks(output_dir: Path, chunks: Iterable[DocumentChunk]) -> List[DocumentChunk]:
        chunks_dir = output_dir / CHUNKS_DIRNAME
        existing_ids = await ChunkStore._existing_chunk_ids(chunks_dir)
        used_ids = set(existing_ids)
        next_index = ChunkStore._next_chunk_index(used_ids)
        id_map: dict[str, str] = {}
        saved: List[DocumentChunk] = []
        chunk_list = list(chunks)
        for chunk in chunk_list:
            original_id = chunk.chunk_id
            if chunk.chunk_id in used_ids:
                while f"chunk_{next_index:04d}" in used_ids:
                    next_index += 1
                chunk.chunk_id = f"chunk_{next_index:04d}"
                next_index += 1
            id_map[original_id] = chunk.chunk_id
            used_ids.add(chunk.chunk_id)

        for chunk in chunk_list:
            if chunk.previous_chunk_id in id_map:
                chunk.previous_chunk_id = id_map[chunk.previous_chunk_id]
            if chunk.next_chunk_id in id_map:
                chunk.next_chunk_id = id_map[chunk.next_chunk_id]
            filename = f"{chunk.chunk_id}.md"
            path = chunks_dir / filename
            await async_write_text(path, chunk.content.rstrip() + "\n")
            chunk.path = str(path.relative_to(output_dir))
            saved.append(chunk)
        return saved

    @staticmethod
    async def _existing_chunk_ids(chunks_dir: Path) -> set[str]:
        if not await async_exists(chunks_dir):
            return set()
        ids: set[str] = set()
        for item in await async_iterdir(chunks_dir):
            if await async_is_file(item) and item.stem.startswith("chunk_") and item.suffix == ".md":
                ids.add(item.stem)
        return ids

    @staticmethod
    def _next_chunk_index(chunk_ids: set[str]) -> int:
        indexes = []
        for chunk_id in chunk_ids:
            suffix = chunk_id.removeprefix("chunk_")
            if suffix.isdigit():
                indexes.append(int(suffix))
        return max(indexes, default=0) + 1
