"""
Utility functions for design mode tools.
"""

from .magic_project_design_parser import (
    # Data classes
    MagicProjectConfig,
    CanvasConfig,
    ViewportState,
    BaseElement,
    ImageElement,
    TextElement,
    RectangleElement,
    EllipseElement,
    TriangleElement,
    StarElement,
    GroupElement,
    FrameElement,
    CanvasElement,
    ShapeElement,
    InteractionConfig,
    TextStyle,
    RichTextNode,
    RichTextParagraph,
    ParagraphStyle,
    VisualUnderstanding,
    GenerateImageRequest,
    ValidationResult,
    # Functions
    read_magic_project_js,
    write_magic_project_js,
    validate_project_config,
    get_project_file_path,
)

__all__ = [
    # Data classes
    "MagicProjectConfig",
    "CanvasConfig",
    "ViewportState",
    "BaseElement",
    "ImageElement",
    "TextElement",
    "RectangleElement",
    "EllipseElement",
    "TriangleElement",
    "StarElement",
    "GroupElement",
    "FrameElement",
    "CanvasElement",
    "ShapeElement",
    "InteractionConfig",
    "TextStyle",
    "RichTextNode",
    "RichTextParagraph",
    "ParagraphStyle",
    "VisualUnderstanding",
    "GenerateImageRequest",
    "ValidationResult",
    # Functions
    "read_magic_project_js",
    "write_magic_project_js",
    "validate_project_config",
    "get_project_file_path",
]
