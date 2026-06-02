"""Document content extraction service."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.utils.async_file_utils import async_mkdir

from ..drivers import get_document_driver_registry
from ..models import ExtractionResult


class DocumentExtractor:
    async def extract(
        self,
        path: Path,
        output_dir: Path,
        ranges: Optional[str] = None,
        mode: str = "auto",
        max_chars: int = 12000,
        **kwargs,
    ) -> ExtractionResult:
        await async_mkdir(output_dir, parents=True, exist_ok=True)
        driver = get_document_driver_registry().get_driver(path)
        return await driver.extract(path, output_dir, ranges=ranges, mode=mode, max_chars=max_chars, **kwargs)
