"""内容积分估算器注册器。"""

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.production.estimation.content_production_cost_estimator_interface import (
    ContentProductionCostEstimatorInterface,
)


class ContentProductionCostEstimatorRegistry:
    """按明确的内容产出规则选择积分估算器。"""

    def __init__(self, estimators: list[ContentProductionCostEstimatorInterface]) -> None:
        """显式接收已组装的估算器。"""
        self._estimators = {estimator.production_rule: estimator for estimator in estimators}

    def get(self, production_rule: str) -> ContentProductionCostEstimatorInterface:
        """返回规则对应估算器。"""
        estimator = self._estimators.get(production_rule)
        if estimator is None:
            raise CanvasDomainError(
                "POINT_ESTIMATE_UNAVAILABLE",
                f"Point estimation is unavailable for content production rule {production_rule}.",
            )
        return estimator

    def has(self, production_rule: str) -> bool:
        """判断规则是否注册了估算器。"""
        return production_rule in self._estimators
