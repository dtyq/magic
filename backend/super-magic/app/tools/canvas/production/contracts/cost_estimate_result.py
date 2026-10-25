"""积分预估结果模型。"""

from dataclasses import dataclass, field
from typing import Literal

from app.tools.canvas.application.results.base import CanvasResult
from app.tools.canvas.domain.types import JsonObject

EstimateStatus = Literal["estimated", "unavailable", "not_billable", "failed"]


@dataclass(frozen=True)
class CostEstimateItemResult:
    """描述一个稳定 item_ref 的积分预估结果。"""

    item_ref: str
    status: EstimateStatus
    points: int | float | None = None
    reason: str | None = None
    request_fingerprint: str | None = None

    @property
    def can_continue(self) -> bool:
        """判断该项是否允许进入真实产出。"""
        return self.status in {"estimated", "not_billable"}

    def to_dict(self) -> JsonObject:
        """转换为积分预估结果项。"""
        return {
            "item_ref": self.item_ref,
            "status": self.status,
            "points": self.points,
            "reason": self.reason,
            "request_fingerprint": self.request_fingerprint,
        }


@dataclass(frozen=True)
class CostEstimateResult(CanvasResult):
    """描述一次批量内容积分预估。"""

    production_rule: str
    items: tuple[CostEstimateItemResult, ...]
    total_points: int | float | None
    estimate_id: str | None
    can_continue: bool
    request_fingerprints: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> JsonObject:
        """转换为积分预估工具需要的 JSON 对象。"""
        return {
            "production_rule": self.production_rule,
            "items": [item.to_dict() for item in self.items],
            "total_points": self.total_points,
            "estimate_id": self.estimate_id,
            "can_continue": self.can_continue,
            "request_fingerprints": dict(self.request_fingerprints),
        }
