"""Render PDF pages to images."""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path
from typing import Iterable, List, Tuple


class PdfPageRenderer:
    @staticmethod
    async def render_pages(path: Path, pages: Iterable[int], dpi: int = 150) -> List[Tuple[int, Path]]:
        return await asyncio.to_thread(PdfPageRenderer._render_pages_sync, path, list(pages), dpi)

    @staticmethod
    def _render_pages_sync(path: Path, pages: Iterable[int], dpi: int = 150) -> List[Tuple[int, Path]]:
        import fitz

        rendered: List[Tuple[int, Path]] = []
        with fitz.open(str(path)) as doc:
            matrix = fitz.Matrix(dpi / 72, dpi / 72)
            for page_no in pages:
                if page_no < 1 or page_no > doc.page_count:
                    continue
                page = doc[page_no - 1]
                pix = page.get_pixmap(matrix=matrix)
                temp = tempfile.NamedTemporaryFile(suffix=f"_page_{page_no:03d}.png", delete=False)
                temp.close()
                pix.save(temp.name)
                rendered.append((page_no, Path(temp.name)))
        return rendered
