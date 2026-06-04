"""Text structured parsing driver."""

from __future__ import annotations

from ..constants import TEXT_EXTENSIONS
from .markdown_driver import MarkdownDocumentDriver


class TextDocumentDriver(MarkdownDocumentDriver):
    file_type = "text"
    unit_type = "section"
    supported_extensions = TEXT_EXTENSIONS
