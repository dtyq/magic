"""布局策略抽象接口。"""

from abc import ABC, abstractmethod

from app.tools.canvas.application.commands import LayoutCommand
from app.tools.canvas.domain.models import CanvasDocument, CanvasElement
from app.tools.canvas.strategies.layout.plan import LayoutMutationPlan
from app.tools.canvas.strategies.layout.request import LayoutStrategyRequest


class LayoutStrategyInterface(ABC):
    """定义所有布局实现必须遵守的计算边界。"""

    name: str

    @abstractmethod
    def plan(
        self,
        canvas: CanvasDocument,
        element: CanvasElement,
        request: LayoutStrategyRequest,
    ) -> LayoutMutationPlan:
        """根据当前快照计算布局计划，不直接持久化。"""

    def apply(
        self,
        canvas: CanvasDocument,
        element: CanvasElement,
        request: LayoutCommand,
        index: int,
    ) -> None:
        """为现有调用方应用布局计划。"""
        self.plan(
            canvas,
            element,
            LayoutStrategyRequest(element.element_id, request, index),
        ).apply(canvas)
