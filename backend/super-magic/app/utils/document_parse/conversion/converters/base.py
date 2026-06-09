"""Base interface for document format converters."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import ConversionCapability, ConversionRequest, ConversionResult


class DocumentFormatConverterDriver(ABC):
    @abstractmethod
    def capabilities(self) -> list[ConversionCapability]:
        """Return conversion routes supported by this converter."""

    def supports(self, request: ConversionRequest) -> bool:
        source = request.source_extension
        target = request.normalized_target
        return any(
            source in capability.source_extensions and target in capability.target_formats
            for capability in self.capabilities()
        )

    @abstractmethod
    async def convert(self, request: ConversionRequest) -> ConversionResult:
        """Convert the requested document and return output paths."""

