"""Canvas Element 详情结果。"""

from dataclasses import dataclass

from app.tools.canvas.application.results.base import CanvasResult
from app.tools.canvas.domain.types import JsonObject


@dataclass(frozen=True)
class CanvasLayoutResult:
    """描述 Element 的稳定布局字段。"""

    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None
    scale_x: float | None = None
    scale_y: float | None = None
    z_index: float | None = None

    def to_dict(self) -> JsonObject:
        """转换为布局 JSON 对象。"""
        values: JsonObject = {
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "scale_x": self.scale_x,
            "scale_y": self.scale_y,
            "z_index": self.z_index,
        }
        return {key: value for key, value in values.items() if value is not None}


@dataclass(frozen=True)
class CanvasContentDetailResult:
    """描述 Element 中一个 Content 版本的详情。"""

    content_id: str
    status: str | None
    asset_path: str | None
    error_message: str | None
    source: str | None
    retry_count: int
    generation_task_id: str | None
    generation_parameters: JsonObject | None
    payload: JsonObject | None
    runtime: JsonObject | None
    version_index: int = 1
    file_name: str | None = None
    generation_name: str | None = None
    is_current: bool = False
    is_main: bool = False
    file_id: str | None = None
    file_exists: bool | None = None
    can_rename_file: bool = False
    file_rename_reason: str | None = None
    discarded: bool = False

    def to_dict(self) -> JsonObject:
        """转换为 Content 详情 JSON 对象。"""
        values: JsonObject = {
            "content_id": self.content_id,
            "status": self.status,
            "asset_path": self.asset_path,
            "error_message": self.error_message,
            "source": self.source,
            "retry_count": self.retry_count,
            "generation_task_id": self.generation_task_id,
            "generation_parameters": self.generation_parameters,
            "payload": self.payload,
            "runtime": self.runtime,
            "version_index": self.version_index,
            "file_name": self.file_name,
            "generation_name": self.generation_name,
            "is_current": self.is_current,
            "is_main": self.is_main,
            "file_id": self.file_id,
            "file_exists": self.file_exists,
            "can_rename_file": self.can_rename_file,
            "file_rename_reason": self.file_rename_reason,
            "discarded": True if self.discarded else None,
        }
        return {key: value for key, value in values.items() if value is not None}


@dataclass(frozen=True)
class CanvasConnectionDetailResult:
    """描述一个与 Element 相关的 Connection。"""

    connection_id: str
    source_element_id: str
    target_element_id: str

    def to_dict(self) -> JsonObject:
        """转换为 Connection JSON 对象。"""
        return {
            "connection_id": self.connection_id,
            "source_element_id": self.source_element_id,
            "target_element_id": self.target_element_id,
        }


@dataclass(frozen=True)
class CanvasChildElementResult:
    """描述详情中的直接子 Element。"""

    element_id: str
    element_type: str
    parent_element_id: str
    depth: int

    def to_dict(self) -> JsonObject:
        """转换为子 Element JSON 对象。"""
        return {
            "element_id": self.element_id,
            "element_type": self.element_type,
            "parent_element_id": self.parent_element_id,
            "depth": self.depth,
        }


@dataclass(frozen=True)
class CanvasElementDetailResult:
    """描述一个完整的 Canvas Element。"""

    element_id: str
    element_type: str
    name: str | None
    visible: bool | None
    locked: bool | None
    opacity: float | None
    parent_element_id: str | None
    depth: int
    child_element_ids: tuple[str, ...]
    children: tuple[CanvasChildElementResult, ...]
    layout: CanvasLayoutResult
    active_content_id: str | None
    main_content_id: str | None
    contents: tuple[CanvasContentDetailResult, ...]
    connections: tuple[CanvasConnectionDetailResult, ...]

    def to_dict(self) -> JsonObject:
        """转换为 Element 详情 JSON 对象。"""
        return {
            "element_id": self.element_id,
            "element_type": self.element_type,
            "name": self.name,
            "visible": self.visible,
            "locked": self.locked,
            "opacity": self.opacity,
            "parent_element_id": self.parent_element_id,
            "depth": self.depth,
            "child_element_ids": list(self.child_element_ids),
            "children": [child.to_dict() for child in self.children],
            "layout": self.layout.to_dict(),
            "active_content_id": self.active_content_id,
            "main_content_id": self.main_content_id,
            "contents": [content.to_dict() for content in self.contents],
            "connections": [connection.to_dict() for connection in self.connections],
        }


@dataclass(frozen=True)
class CanvasElementsResult(CanvasResult):
    """描述精确 Element 查询结果及其连接。"""

    project_path: str
    details_complete: bool
    elements: tuple[CanvasElementDetailResult, ...]
    connections: tuple[CanvasConnectionDetailResult, ...]
    warnings: tuple[str, ...]

    def to_dict(self) -> JsonObject:
        """转换为详情工具需要的 JSON 对象。"""
        return {
            "project_path": self.project_path,
            "details_complete": self.details_complete,
            "elements": [element.to_dict() for element in self.elements],
            "connections": [connection.to_dict() for connection in self.connections],
            "warnings": list(self.warnings),
        }
