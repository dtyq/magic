"""层级策略接口、实现和注册器。"""

from app.tools.canvas.strategies.hierarchy.frame_selection import FrameSelectionStrategy
from app.tools.canvas.strategies.hierarchy.interface import HierarchyStrategyInterface
from app.tools.canvas.strategies.hierarchy.plan import FrameSelectionPlan
from app.tools.canvas.strategies.hierarchy.registry import HierarchyStrategyRegistry
from app.tools.canvas.strategies.hierarchy.request import FrameSelectionRequest

__all__ = [
    "FrameSelectionPlan",
    "FrameSelectionRequest",
    "FrameSelectionStrategy",
    "HierarchyStrategyInterface",
    "HierarchyStrategyRegistry",
]
