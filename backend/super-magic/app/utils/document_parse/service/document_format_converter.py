"""Format conversion service."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.utils.async_file_utils import async_mkdir

from ..conversion.models import ConversionRequest
from ..conversion.registry import DocumentConversionRegistry


class DocumentFormatConverter:
    def __init__(self, registry: DocumentConversionRegistry | None = None):
        self._registry = registry or DocumentConversionRegistry()

    async def convert(self, input_path: Path, output_dir: Path, target_format: str, ranges: Optional[str] = None) -> list[Path]:
        await async_mkdir(output_dir, parents=True, exist_ok=True)
        request = ConversionRequest(
            input_path=input_path,
            output_dir=output_dir,
            target_format=target_format,
            ranges=ranges,
        )
        converter = self._registry.get_converter(request)
        result = await converter.convert(request)
        return result.output_files
