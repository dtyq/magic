"""PDF metadata inspection."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, Dict


class PdfMetadata:
    @staticmethod
    async def inspect(path: Path) -> Dict[str, Any]:
        return await asyncio.to_thread(PdfMetadata._inspect_sync, path)

    @staticmethod
    def _inspect_sync(path: Path) -> Dict[str, Any]:
        import fitz

        with fitz.open(str(path)) as doc:
            page_count = doc.page_count
            sample_pages = min(page_count, 3)
            text_chars = 0
            has_images = False
            for page_no in range(sample_pages):
                page = doc[page_no]
                text_chars += len((page.get_text() or "").strip())
                if page.get_images():
                    has_images = True
            avg_chars = text_chars / sample_pages if sample_pages else 0
            if avg_chars > 2000:
                text_density = "high"
            elif avg_chars > 500:
                text_density = "medium"
            else:
                text_density = "low"
            metadata = doc.metadata or {}
        return {
            "page_count": page_count,
            "sample_pages": sample_pages,
            "avg_chars_per_sample_page": avg_chars,
            "text_density": text_density,
            "has_images_in_sample": has_images,
            "pdf_metadata": metadata,
        }
