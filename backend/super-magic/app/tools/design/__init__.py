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
    CreateDesignProject,
    CreateCanvasElement,
    UpdateCanvasElement,
    DeleteCanvasElement,
    ReorderCanvasElements,
    QueryCanvasOverview,
    QueryCanvasElement,
    BatchCreateCanvasElements,
    BatchUpdateCanvasElements,
)

__all__ = [
    "CanvasManager",
    "ElementQuery",
    "CanvasStatistics",
    "BaseDesignTool",
    "CreateDesignProject",
    "CreateCanvasElement",
    "UpdateCanvasElement",
    "DeleteCanvasElement",
    "ReorderCanvasElements",
    "QueryCanvasOverview",
    "QueryCanvasElement",
    "BatchCreateCanvasElements",
    "BatchUpdateCanvasElements",
]
