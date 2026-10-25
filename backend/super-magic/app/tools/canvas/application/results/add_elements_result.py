"""新增 Element 结果。"""

from dataclasses import dataclass

from app.tools.canvas.application.results.base import CanvasBatchResult, CanvasResultItem
from app.tools.canvas.domain.types import JsonObject


@dataclass
class AddElementResultItem(CanvasResultItem):
    """描述一个新增或复用 Element 的结果。"""

    item_ref: str
    element_id: str
    content_id: str | None
    status: str
    asset_path: str | None = None
    generation_task_id: str | None = None
    output_uri: str | None = None
    error: str | None = None
    persistence_warning: str | None = None
    persistence_error: str | None = None
    started_at: str | None = None
    expected_finished_at: str | None = None

    def to_dict(self) -> JsonObject:
        """转换为新增 Element 结果项。"""
        values: JsonObject = {
            "item_ref": self.item_ref,
            "element_id": self.element_id,
            "content_id": self.content_id,
            "status": self.status,
            "asset_path": self.asset_path,
            "generation_task_id": self.generation_task_id,
            "output_uri": self.output_uri,
            "error": self.error,
            "persistence_warning": self.persistence_warning,
            "persistence_error": self.persistence_error,
            "started_at": self.started_at,
            "expected_finished_at": self.expected_finished_at,
        }
        return {key: value for key, value in values.items() if value is not None}


class AddElementsResult(CanvasBatchResult[AddElementResultItem]):
    """描述一批新增或复用 Element 的结果。"""

    def __init__(self, items: list[AddElementResultItem], created_element_ids: list[str]) -> None:
        """保存新增项和已创建的 Element ID。"""
        super().__init__(items)
        self.created_element_ids = created_element_ids

    def to_dict(self) -> JsonObject:
        """转换为新增 Element 工具需要的 JSON 对象。"""
        return {
            **super().to_dict(),
            "created_element_ids": list(self.created_element_ids),
        }
