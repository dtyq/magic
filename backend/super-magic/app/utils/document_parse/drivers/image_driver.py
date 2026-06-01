"""Image structured parsing driver."""

from __future__ import annotations

from ..constants import IMAGE_EXTENSIONS
from .generic import GenericMarkItDownDriver


class ImageDocumentDriver(GenericMarkItDownDriver):
    file_type = "image"
    unit_type = "image"
    supported_extensions = IMAGE_EXTENSIONS
