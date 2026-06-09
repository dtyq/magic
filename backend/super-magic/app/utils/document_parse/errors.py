"""Domain errors for structured document parsing."""

from __future__ import annotations


class DocumentParseError(Exception):
    """Base error for document parsing failures."""


class UnsupportedDocumentError(DocumentParseError):
    """Raised when no driver supports the document type."""


class DocumentRangeError(DocumentParseError):
    """Raised when a requested page/slide/sheet/cell range is invalid."""


class DocumentExtractionError(DocumentParseError):
    """Raised when content extraction fails."""
