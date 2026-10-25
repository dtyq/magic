"""Canvas 异步生成等待结果。"""

from dataclasses import dataclass

from app.tools.canvas.application.results.base import CanvasBatchResult, CanvasResultItem
from app.tools.canvas.domain.types import JsonObject


@dataclass
class WaitGenerationResultItem(CanvasResultItem):
    """描述一个生成任务的查询结果。"""

    generation_task_id: str
    status: str
    element_id: str | None = None
    content_id: str | None = None
    output_uri: str | None = None
    error: str | None = None
    error_code: str | None = None
    timed_out: bool | None = None
    already_finalized: bool | None = None
    query_error: str | None = None
    next_action: str | None = None

    def to_dict(self) -> JsonObject:
        """转换为等待结果项。"""
        values: JsonObject = {
            "generation_task_id": self.generation_task_id,
            "status": self.status,
            "element_id": self.element_id,
            "content_id": self.content_id,
            "output_uri": self.output_uri,
            "error": self.error,
            "error_code": self.error_code,
            "timed_out": self.timed_out,
            "already_finalized": self.already_finalized,
            "query_error": self.query_error,
            "next_action": self.next_action,
        }
        return {key: value for key, value in values.items() if value is not None}


class WaitGenerationResult(CanvasBatchResult[WaitGenerationResultItem]):
    """描述一批异步生成任务的等待结果。"""
