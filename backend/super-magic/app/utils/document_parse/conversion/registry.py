"""Registry for document format conversion drivers."""

from __future__ import annotations

from .converters.base import DocumentFormatConverterDriver
from .converters.office_converter import OfficeDocumentConverter
from .converters.pdf_image_converter import PdfImageConverter
from .models import ConversionCapability, ConversionRequest, UnsupportedConversionError


class DocumentConversionRegistry:
    def __init__(self, converters: list[DocumentFormatConverterDriver] | None = None):
        self._converters = converters or [
            PdfImageConverter(),
            OfficeDocumentConverter(),
        ]

    def capabilities(self) -> list[ConversionCapability]:
        return [capability for converter in self._converters for capability in converter.capabilities()]

    def get_converter(self, request: ConversionRequest) -> DocumentFormatConverterDriver:
        for converter in self._converters:
            if converter.supports(request):
                return converter
        raise UnsupportedConversionError(self._unsupported_message(request))

    def _unsupported_message(self, request: ConversionRequest) -> str:
        capability_lines = "\n".join(f"- {capability.description}" for capability in self.capabilities())
        return (
            f"Unsupported document format conversion: {request.source_extension or '<unknown>'} -> {request.normalized_target}.\n\n"
            "Current supported format conversions:\n"
            f"{capability_lines}\n\n"
            "If you need readable content instead of a new file format, use export_document_markdown."
        )

