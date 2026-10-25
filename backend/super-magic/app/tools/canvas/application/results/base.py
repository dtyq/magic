"""Canvas Application 结果对象的公共行为。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Generic, Protocol, TypeVar

from app.tools.canvas.domain.types import JsonObject, JsonValue


class CanvasResult(ABC):
    """定义可转换为模型和工具边界 JSON 的业务结果。"""

    @abstractmethod
    def to_dict(self) -> JsonObject:
        """把强类型结果投影为工具边界需要的 JSON 对象。"""

    def __getitem__(self, key: str) -> JsonValue:
        """提供只读字段访问，便于逐步迁移旧的结果读取代码。"""
        return self.to_dict()[key]

    def get(self, key: str, default: JsonValue | None = None) -> JsonValue | None:
        """按字段读取结果，供展示层安全访问可选字段。"""
        return self.to_dict().get(key, default)


class CanvasResultItem(ABC):
    """定义批量结果项的 JSON 投影行为。"""

    @abstractmethod
    def to_dict(self) -> JsonObject:
        """把批量结果项转换为 JSON 对象。"""


class GeneratedResultItem(Protocol):
    """声明生成提交阶段需要更新的结果项字段。"""

    content_id: str | None
    status: str
    generation_task_id: str | None
    output_uri: str | None
    error: str | None
    persistence_warning: str | None
    persistence_error: str | None
    started_at: str | None
    expected_finished_at: str | None


TResultItem = TypeVar("TResultItem", bound=CanvasResultItem)


class CanvasBatchResult(CanvasResult, Generic[TResultItem]):
    """保存一批强类型结果项，并提供统一的 JSON 投影。"""

    def __init__(self, items: list[TResultItem]) -> None:
        """保存可被生成提交阶段更新的结果项列表。"""
        self.items = items

    def to_dict(self) -> JsonObject:
        """把批量结果项列表转换为 JSON 数组。"""
        return {"items": [item.to_dict() for item in self.items]}
