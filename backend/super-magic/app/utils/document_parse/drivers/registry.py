"""Document driver registry."""

from __future__ import annotations

from pathlib import Path
from typing import List

from ..errors import UnsupportedDocumentError
from .base import DocumentDriver
from .html_driver import HtmlDocumentDriver
from .image_driver import ImageDocumentDriver
from .markdown_driver import MarkdownDocumentDriver
from .notebook_driver import NotebookDocumentDriver
from .pdf_driver import PdfDocumentDriver
from .powerpoint_driver import PowerPointDocumentDriver
from .spreadsheet_driver import SpreadsheetDocumentDriver
from .text_driver import TextDocumentDriver
from .word_driver import WordDocumentDriver


class DocumentDriverRegistry:
    def __init__(self):
        self._drivers: List[DocumentDriver] = [
            PdfDocumentDriver(),
            WordDocumentDriver(),
            PowerPointDocumentDriver(),
            SpreadsheetDocumentDriver(),
            ImageDocumentDriver(),
            NotebookDocumentDriver(),
            HtmlDocumentDriver(),
            MarkdownDocumentDriver(),
            TextDocumentDriver(),
        ]

    def get_driver(self, path: Path) -> DocumentDriver:
        for driver in self._drivers:
            if driver.supports(path):
                return driver
        raise UnsupportedDocumentError(f"Unsupported document type: {path.suffix}")


_registry: DocumentDriverRegistry | None = None


def get_document_driver_registry() -> DocumentDriverRegistry:
    global _registry
    if _registry is None:
        _registry = DocumentDriverRegistry()
    return _registry
