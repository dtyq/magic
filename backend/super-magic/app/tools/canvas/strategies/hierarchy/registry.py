"""层级策略注册器。"""

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.strategies.hierarchy.frame_selection import FrameSelectionStrategy
from app.tools.canvas.strategies.hierarchy.interface import HierarchyStrategyInterface


class HierarchyStrategyRegistry:
    """只负责按名称选择层级策略实现。"""

    def __init__(self, strategies: list[HierarchyStrategyInterface] | None = None):
        """注册默认 Frame 框选策略或调用方提供的替换实现。"""
        values = strategies or [FrameSelectionStrategy()]
        self._strategies = {strategy.name: strategy for strategy in values}

    def get(self, name: str = "frame_selection") -> HierarchyStrategyInterface:
        """按名称返回层级策略。"""
        try:
            return self._strategies[name]
        except KeyError as exc:
            raise CanvasDomainError("HIERARCHY_STRATEGY_NOT_FOUND", f"Unknown hierarchy strategy: {name}.") from exc
