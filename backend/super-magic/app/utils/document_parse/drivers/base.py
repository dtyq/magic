"""Structured document driver base classes."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from ..models import DocumentProfile, ExtractionResult


class DocumentDriver(ABC):
    """Driver contract for one document family."""

    file_type: str
    unit_type: str
    supported_extensions: set[str]

    def supports(self, path: Path) -> bool:
        return path.suffix.lower() in self.supported_extensions

    @abstractmethod
    async def inspect(self, path: Path) -> DocumentProfile:
        pass

    @abstractmethod
    async def extract(
        self,
        path: Path,
        output_dir: Path,
        ranges: Optional[str] = None,
        mode: str = "auto",
        max_chars: int = 12000,
        **kwargs,
    ) -> ExtractionResult:
        pass
