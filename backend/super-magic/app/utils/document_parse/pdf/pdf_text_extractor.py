"""Local PDF text extraction.

The segment API preserves page boundaries so downstream chunking can emit true
page ranges instead of labeling every chunk with the whole extraction range.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Iterable, List, Tuple


class PdfTextExtractor:
    @staticmethod
    async def extract_pages(path: Path, pages: Iterable[int]) -> str:
        return await asyncio.to_thread(PdfTextExtractor._extract_pages_sync, path, list(pages))

    @staticmethod
    async def extract_page_segments(path: Path, pages: Iterable[int]) -> List[Tuple[int, str]]:
        return await asyncio.to_thread(PdfTextExtractor._extract_page_segments_sync, path, list(pages))

    @staticmethod
    def _extract_pages_sync(path: Path, pages: Iterable[int]) -> str:
        parts: List[str] = []
        for page_no, text in PdfTextExtractor._extract_page_segments_sync(path, pages):
            parts.extend([f"## 第 {page_no} 页", "", text, ""])
        return "\n".join(parts).strip()

    @staticmethod
    def _extract_page_segments_sync(path: Path, pages: Iterable[int]) -> List[Tuple[int, str]]:
        import fitz

        segments: List[Tuple[int, str]] = []
        with fitz.open(str(path)) as doc:
            for page_no in pages:
                if page_no < 1 or page_no > doc.page_count:
                    continue
                page = doc[page_no - 1]
                text = (page.get_text() or "").strip()
                segments.append((page_no, text or "(本页未提取到文本)"))
        return segments
