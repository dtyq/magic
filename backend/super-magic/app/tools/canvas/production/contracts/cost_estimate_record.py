"""积分预估确认凭证模型。"""

from dataclasses import dataclass
from datetime import datetime, timezone

from app.tools.canvas.application.commands import GenerationParameters


@dataclass(frozen=True)
class CostEstimateRecordItem:
    """绑定一次预估中的 item_ref、标准请求、参数指纹和状态。"""

    item_ref: str
    status: str
    request_fingerprint: str
    points: int | float | None
    canonical_parameters: GenerationParameters


@dataclass(frozen=True)
class CostEstimateRecord:
    """保存真实提交前必须校验的批量预估凭证。"""

    estimate_id: str
    project_path: str
    production_rule: str
    items: tuple[CostEstimateRecordItem, ...]
    created_at: datetime

    @classmethod
    def create(
        cls,
        estimate_id: str,
        project_path: str,
        production_rule: str,
        items: tuple[CostEstimateRecordItem, ...],
    ) -> "CostEstimateRecord":
        """创建带 UTC 时间的不可变预估记录。"""
        return cls(estimate_id, project_path, production_rule, items, datetime.now(timezone.utc))

    def get_item(self, item_ref: str) -> CostEstimateRecordItem | None:
        """按 item_ref 返回对应预估结果。"""
        return next((item for item in self.items if item.item_ref == item_ref), None)
