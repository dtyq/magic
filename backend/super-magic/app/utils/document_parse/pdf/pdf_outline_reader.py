"""Read PDF bookmarks as document nodes."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import List

from ..models import DocumentNode


class PdfOutlineReader:
    @staticmethod
    async def read(path: Path) -> List[DocumentNode]:
        return await asyncio.to_thread(PdfOutlineReader._read_sync, path)

    @staticmethod
    def _read_sync(path: Path) -> List[DocumentNode]:
        import fitz

        nodes: List[DocumentNode] = []
        with fitz.open(str(path)) as doc:
            toc = doc.get_toc(simple=True) or []
        for index, item in enumerate(toc, start=1):
            level, title, page = item
            nodes.append(DocumentNode(
                node_id=f"pdf_outline_{index}",
                title=str(title).strip() or f"Page {page}",
                level=max(1, int(level)),
                source_range=str(page),
            ))
        return nodes
