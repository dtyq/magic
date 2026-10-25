"""Canvas 其他写入用例的强类型结果。"""

from dataclasses import dataclass

from app.tools.canvas.application.results.base import CanvasBatchResult, CanvasResultItem
from app.tools.canvas.domain.types import JsonObject


@dataclass
class FrameElementResultItem(CanvasResultItem):
    """描述一次 Frame 框选结果。"""

    item_ref: str
    frame_element_id: str
    child_element_ids: tuple[str, ...]
    content_id: str | None
    parent_element_id: str | None
    depth: int
    padding: float
    status: str

    def to_dict(self) -> JsonObject:
        """转换为 Frame 结果项。"""
        return {
            "item_ref": self.item_ref,
            "frame_element_id": self.frame_element_id,
            "child_element_ids": list(self.child_element_ids),
            "content_id": self.content_id,
            "parent_element_id": self.parent_element_id,
            "depth": self.depth,
            "padding": self.padding,
            "status": self.status,
        }


class FrameElementsResult(CanvasBatchResult[FrameElementResultItem]):
    """描述一批 Frame 框选结果。"""


@dataclass
class AddContentResultItem(CanvasResultItem):
    """描述一次 Content 版本追加结果。"""

    item_ref: str
    element_id: str
    content_id: str
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
        """转换为 Content 追加结果项。"""
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


class AddContentsResult(CanvasBatchResult[AddContentResultItem]):
    """描述一批 Content 版本追加结果。"""


@dataclass(frozen=True)
class SelectMainContentResultItem(CanvasResultItem):
    """描述一次主 Content 选择结果。"""

    item_ref: str
    status: str
    element_id: str
    previous_main_content_id: str | None
    main_content_id: str
    active_content_id: str | None

    def to_dict(self) -> JsonObject:
        """转换为主 Content 选择结果项。"""
        return {
            "item_ref": self.item_ref,
            "status": self.status,
            "element_id": self.element_id,
            "previous_main_content_id": self.previous_main_content_id,
            "main_content_id": self.main_content_id,
            "active_content_id": self.active_content_id,
        }


class SelectMainContentsResult(CanvasBatchResult[SelectMainContentResultItem]):
    """描述一批主 Content 选择结果。"""


@dataclass(frozen=True)
class LayoutElementResultItem(CanvasResultItem):
    """描述一次布局策略执行结果。"""

    item_ref: str
    status: str
    element_id: str
    strategy: str

    def to_dict(self) -> JsonObject:
        """转换为布局结果项。"""
        return {
            "item_ref": self.item_ref,
            "status": self.status,
            "element_id": self.element_id,
            "strategy": self.strategy,
        }


class LayoutElementsResult(CanvasBatchResult[LayoutElementResultItem]):
    """描述一批布局策略执行结果。"""


@dataclass(frozen=True)
class ConnectionResultItem(CanvasResultItem):
    """描述一次新增、删除或替换 Connection 的结果。"""

    item_ref: str
    status: str
    connection_id: str | None
    removed_connection_ids: tuple[str, ...]
    source_element_id: str | None
    target_element_id: str | None

    def to_dict(self) -> JsonObject:
        """转换为 Connection 结果项。"""
        values: JsonObject = {
            "item_ref": self.item_ref,
            "status": self.status,
            "connection_id": self.connection_id,
            "removed_connection_ids": list(self.removed_connection_ids),
            "source_element_id": self.source_element_id,
            "target_element_id": self.target_element_id,
        }
        return {key: value for key, value in values.items() if value is not None}


class ConnectionsResult(CanvasBatchResult[ConnectionResultItem]):
    """描述一批 Connection 变更结果。"""


@dataclass
class RetryContentResultItem(CanvasResultItem):
    """描述一次失败 Content 重试结果。"""

    item_ref: str
    element_id: str
    content_id: str
    status: str
    retry_count: int
    generation_task_id: str | None = None
    output_uri: str | None = None
    error: str | None = None
    next_action: str | None = None
    persistence_warning: str | None = None
    persistence_error: str | None = None
    previous_status: str | None = None
    main_content_id: str | None = None
    idempotent_replay: bool | None = None
    started_at: str | None = None
    expected_finished_at: str | None = None

    def to_dict(self) -> JsonObject:
        """转换为重试结果项。"""
        values: JsonObject = {
            "item_ref": self.item_ref,
            "element_id": self.element_id,
            "content_id": self.content_id,
            "status": self.status,
            "retry_count": self.retry_count,
            "generation_task_id": self.generation_task_id,
            "output_uri": self.output_uri,
            "error": self.error,
            "next_action": self.next_action,
            "persistence_warning": self.persistence_warning,
            "persistence_error": self.persistence_error,
            "previous_status": self.previous_status,
            "main_content_id": self.main_content_id,
            "idempotent_replay": self.idempotent_replay,
            "started_at": self.started_at,
            "expected_finished_at": self.expected_finished_at,
        }
        return {key: value for key, value in values.items() if value is not None}


class RetryContentsResult(CanvasBatchResult[RetryContentResultItem]):
    """描述一批失败 Content 重试结果。"""
