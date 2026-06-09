"""Write machine-readable document indexes.

The index is the primary navigation artifact. It keeps a chunk lookup map in
metadata so callers can resolve a chunk id to a stable Markdown path quickly.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.utils.async_file_utils import async_write_text
from ..constants import INDEX_FILENAME
from ..models import DocumentStructure


class IndexWriter:
    @staticmethod
    async def write(output_dir: Path, structure: DocumentStructure) -> Path:
        path = output_dir / INDEX_FILENAME
        structure.metadata = {
            **structure.metadata,
            "chunk_lookup": {
                chunk.chunk_id: {
                    "path": chunk.path,
                    "title": chunk.title,
                    "source_range": chunk.source_range,
                    "parent_node_id": chunk.parent_node_id,
                }
                for chunk in structure.chunks
            },
        }
        await async_write_text(path, json.dumps(structure.to_dict(), ensure_ascii=False, indent=2) + "\n")
        return path
