"""Canvas 持久化基础设施。"""

from app.tools.canvas.infrastructure.persistence.canvas_codec import (
    BASE_ELEMENT_FIELDS,
    CANVAS_PREFIX,
    CONTENT_FIELDS,
    MAGIC_PROJECT_TYPE,
    MAGIC_PROJECT_VERSION,
    SUPPORTED_ELEMENT_TYPES,
    CanvasCodec,
)
from app.tools.canvas.infrastructure.persistence.canvas_main_file_sanitizer import CanvasMainFileSanitizer
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.canvas.infrastructure.persistence.content_metadata_service import ContentMetadataService
from app.tools.canvas.infrastructure.persistence.element_details_adapter import ElementDetailsAdapter
from app.tools.canvas.infrastructure.persistence.element_details_codec import ElementDetailsCodec

__all__ = [
    "BASE_ELEMENT_FIELDS", "CANVAS_PREFIX", "CONTENT_FIELDS",
    "MAGIC_PROJECT_TYPE", "MAGIC_PROJECT_VERSION", "SUPPORTED_ELEMENT_TYPES", "CanvasCodec",
    "CanvasMainFileSanitizer", "CanvasRepositoryInterface", "ContentMetadataService", "ElementDetailsAdapter", "ElementDetailsCodec",
]
