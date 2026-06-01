"""Notebook structured parsing driver."""

from __future__ import annotations

from ..constants import NOTEBOOK_EXTENSIONS
from .generic import GenericMarkItDownDriver


class NotebookDocumentDriver(GenericMarkItDownDriver):
    file_type = "notebook"
    unit_type = "cell"
    supported_extensions = NOTEBOOK_EXTENSIONS
