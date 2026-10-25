"""Canvas 概览查询结果。"""

from dataclasses import dataclass

from app.tools.canvas.application.results.base import CanvasResult
from app.tools.canvas.domain.types import JsonObject


@dataclass(frozen=True)
class CanvasOverviewElementResult:
    """描述概览中的一个轻量 Element。"""

    element_id: str
    element_type: str
    name: str | None
    x: float | None
    y: float | None
    width: float | None
    height: float | None
    content_count: int
    active_content_id: str | None
    main_content_id: str | None
    status: str | None
    parent_element_id: str | None
    depth: int
    child_count: int
    incoming_element_ids: tuple[str, ...]
    outgoing_element_ids: tuple[str, ...]
    asset_path: str | None = None
    file_name: str | None = None

    def to_dict(self) -> JsonObject:
        """转换为模型友好的概览对象。"""
        return {
            "element_id": self.element_id,
            "element_type": self.element_type,
            "name": self.name,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "content_count": self.content_count,
            "active_content_id": self.active_content_id,
            "main_content_id": self.main_content_id,
            "status": self.status,
            "parent_element_id": self.parent_element_id,
            "depth": self.depth,
            "child_count": self.child_count,
            "incoming": list(self.incoming_element_ids),
            "outgoing": list(self.outgoing_element_ids),
            "asset_path": self.asset_path,
            "file_name": self.file_name,
        }


@dataclass(frozen=True)
class CanvasOverviewResult(CanvasResult):
    """描述一页 Canvas Element 概览。"""

    project_path: str
    project_name: str
    total_elements: int
    total_connections: int
    page: int
    limit: int
    has_more: bool
    elements: tuple[CanvasOverviewElementResult, ...]

    def to_dict(self) -> JsonObject:
        """转换为概览工具需要的 JSON 对象。"""
        return {
            "project_path": self.project_path,
            "project_name": self.project_name,
            "total_elements": self.total_elements,
            "total_connections": self.total_connections,
            "page": self.page,
            "limit": self.limit,
            "has_more": self.has_more,
            "elements": [element.to_dict() for element in self.elements],
        }
