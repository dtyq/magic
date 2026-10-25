"""层级策略抽象接口。"""

from abc import ABC, abstractmethod

from app.tools.canvas.domain.models import CanvasDocument
from app.tools.canvas.strategies.hierarchy.plan import FrameSelectionPlan
from app.tools.canvas.strategies.hierarchy.request import FrameSelectionRequest


class HierarchyStrategyInterface(ABC):
    """定义所有层级变更实现必须遵守的边界。"""

    name: str

    @abstractmethod
    def plan(self, canvas: CanvasDocument, request: FrameSelectionRequest) -> FrameSelectionPlan:
        """根据当前树快照计算层级变更计划。"""
