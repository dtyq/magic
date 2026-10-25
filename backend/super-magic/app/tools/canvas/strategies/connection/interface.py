"""Connection 策略抽象接口。"""

from abc import ABC, abstractmethod

from app.tools.canvas.domain.models import CanvasConnection, CanvasDocument
from app.tools.canvas.strategies.connection.plan import ConnectionMutationPlan
from app.tools.canvas.strategies.connection.request import ConnectionStrategyRequest


class ConnectionStrategyInterface(ABC):
    """定义所有 Connection 创建实现必须遵守的边界。"""

    name: str

    @abstractmethod
    def plan(
        self,
        canvas: CanvasDocument,
        request: ConnectionStrategyRequest,
    ) -> ConnectionMutationPlan:
        """校验并计算一条 Connection 变更计划。"""

    def add(self, canvas: CanvasDocument, source: str, target: str) -> CanvasConnection:
        """为现有调用方应用 Connection 计划。"""
        return self.plan(canvas, ConnectionStrategyRequest(source, target)).apply(canvas)
