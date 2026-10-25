"""Content 策略抽象接口。"""

from abc import ABC, abstractmethod

from app.tools.canvas.domain.models import CanvasContent
from app.tools.canvas.strategies.content.plan import ContentMutationPlan
from app.tools.canvas.strategies.content.request import ContentStrategyRequest


class ContentStrategyInterface(ABC):
    """定义所有 Content 构建实现必须遵守的边界。"""

    source: str

    @abstractmethod
    def plan(self, request: ContentStrategyRequest) -> ContentMutationPlan:
        """把外部输入转换为主协议 Content 计划。"""

    def build(self, request: ContentStrategyRequest) -> CanvasContent:
        """返回计划中的 Content。"""
        return self.plan(request).content
