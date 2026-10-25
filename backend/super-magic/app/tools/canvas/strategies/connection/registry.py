"""Connection 策略注册器。"""

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasConnection, CanvasDocument
from app.tools.canvas.strategies.connection.direct_connection import DirectConnectionStrategy
from app.tools.canvas.strategies.connection.interface import ConnectionStrategyInterface
from app.tools.canvas.strategies.connection.plan import ConnectionMutationPlan
from app.tools.canvas.strategies.connection.request import ConnectionStrategyRequest


class ConnectionStrategyRegistry:
    """只负责按名称选择 Connection 策略实现。"""

    def __init__(self, strategies: list[ConnectionStrategyInterface] | None = None):
        """注册默认直接连线策略或调用方提供的替换实现。"""
        values = strategies or [DirectConnectionStrategy()]
        self._strategies = {strategy.name: strategy for strategy in values}

    def get(self, name: str = "direct") -> ConnectionStrategyInterface:
        """按名称返回 Connection 策略。"""
        try:
            return self._strategies[name]
        except KeyError as exc:
            raise CanvasDomainError("CONNECTION_STRATEGY_NOT_FOUND", f"Unknown Connection strategy: {name}.") from exc

    def add(self, canvas: CanvasDocument, source: str, target: str) -> CanvasConnection:
        """通过默认策略新增一条 Connection。"""
        return self.get().add(canvas, source, target)

    def plan(self, canvas: CanvasDocument, source: str, target: str) -> ConnectionMutationPlan:
        """通过默认策略返回强类型变更计划。"""
        return self.get().plan(canvas, ConnectionStrategyRequest(source, target))
