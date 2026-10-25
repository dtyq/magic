"""布局策略注册器。"""

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.strategies.layout.dependency_flow import DependencyFlowLayoutStrategy
from app.tools.canvas.strategies.layout.explicit_position import ExplicitPositionLayoutStrategy
from app.tools.canvas.strategies.layout.interface import LayoutStrategyInterface
from app.tools.canvas.strategies.layout.row_incremental import RowIncrementalLayoutStrategy


class LayoutStrategyRegistry:
    """只负责按名称选择布局策略实现。"""

    def __init__(self, strategies: list[LayoutStrategyInterface] | None = None):
        """注册默认布局策略或调用方提供的替换实现。"""
        values = strategies or [
            RowIncrementalLayoutStrategy(),
            DependencyFlowLayoutStrategy(),
            ExplicitPositionLayoutStrategy(),
        ]
        self._strategies = {strategy.name: strategy for strategy in values}

    def get(self, name: str) -> LayoutStrategyInterface:
        """按名称返回布局策略。"""
        try:
            return self._strategies[name]
        except KeyError as exc:
            raise CanvasDomainError("LAYOUT_STRATEGY_NOT_FOUND", f"Unknown layout strategy: {name}.") from exc
