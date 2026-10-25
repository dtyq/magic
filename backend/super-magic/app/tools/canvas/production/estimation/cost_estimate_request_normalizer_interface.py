"""积分预估请求规范化器接口。"""

from abc import ABC, abstractmethod

from app.tools.canvas.application.commands import GenerationParameters
from app.tools.canvas.production.contracts import CostEstimateRequestInterface


class CostEstimateRequestNormalizerInterface(ABC):
    """定义生成参数到具体内容预估请求的转换边界。"""

    @property
    @abstractmethod
    def production_rule(self) -> str:
        """返回当前规范化器支持的内容产出规则。"""

    @abstractmethod
    def normalize(
        self,
        project_path: str,
        item_ref: str,
        parameters: GenerationParameters,
    ) -> CostEstimateRequestInterface:
        """返回排除确认凭证后的稳定预估请求。"""
