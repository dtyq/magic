"""
Design mode tools for magic project canvas manipulation.
"""

from app.tools.design.manager import (
    CanvasManager,
    ElementQuery,
    CanvasStatistics
)
from app.tools.design.tools import (
    BaseDesignTool,
    CreateCanvas,
    GenerateCanvasImages,
    GenerateCanvasVideos,
    SearchCanvasImages,
    SearchImagePrompts,
)

__all__ = [
    "CanvasManager",
    "ElementQuery",
    "CanvasStatistics",
    "BaseDesignTool",
    "CreateCanvas",
    "GenerateCanvasImages",
    "GenerateCanvasVideos",
    "SearchCanvasImages",
    "SearchImagePrompts",
]
