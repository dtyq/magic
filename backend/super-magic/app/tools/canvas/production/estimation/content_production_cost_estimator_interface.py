"""内容积分估算器接口。"""

from abc import ABC, abstractmethod

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.production.contracts import CostEstimateItemResult, CostEstimateRequestInterface


class ContentProductionCostEstimatorInterface(ABC):
    """定义可挂载到任意内容产出规则的积分估算能力。"""

    @property
    @abstractmethod
    def production_rule(self) -> str:
        """返回该估算器支持的内容产出规则。"""

    @abstractmethod
    async def estimate(
        self,
        request: CostEstimateRequestInterface,
        tool_context: ToolContext | None,
    ) -> CostEstimateItemResult:
        """估算一个规范化请求。"""
