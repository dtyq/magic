"""HTML structured parsing driver."""

from __future__ import annotations

from ..constants import HTML_EXTENSIONS
from .generic import GenericMarkItDownDriver


class HtmlDocumentDriver(GenericMarkItDownDriver):
    file_type = "html"
    unit_type = "section"
    supported_extensions = HTML_EXTENSIONS
