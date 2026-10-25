"""积分预估请求规范化器注册器。"""

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.production.estimation.cost_estimate_request_normalizer_interface import (
    CostEstimateRequestNormalizerInterface,
)


class CostEstimateRequestNormalizerRegistry:
    """按内容产出规则选择明确的请求规范化器。"""

    def __init__(self, normalizers: list[CostEstimateRequestNormalizerInterface]) -> None:
        """显式接收 Composition Root 组装的规范化器。"""
        self._normalizers = {normalizer.production_rule: normalizer for normalizer in normalizers}

    def get(self, production_rule: str) -> CostEstimateRequestNormalizerInterface:
        """返回规则对应的规范化器。"""
        normalizer = self._normalizers.get(production_rule)
        if normalizer is None:
            raise CanvasDomainError(
                "POINT_ESTIMATE_UNAVAILABLE",
                f"Point estimation is unavailable for content production rule {production_rule}.",
            )
        return normalizer
