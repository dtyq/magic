"""Canvas Document 领域模型。"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models.canvas_connection import CanvasConnection
from app.tools.canvas.domain.models.canvas_element import (
    CanvasElement,
    collect_opaque_element_ids,
    merge_indexed_opaque,
)
from app.tools.canvas.domain.types import JsonObject, JsonValue


@dataclass
class CanvasDocument:
    """表示解压后的 Canvas 文档。"""

    elements: list[CanvasElement] = field(default_factory=list)
    connections: list[CanvasConnection] = field(default_factory=list)
    extra_data: JsonObject = field(default_factory=dict)
    # 未支持或解码失败的根节点，跳过结构化解析，保存时按原位置写回。
    opaque_elements: list[tuple[int, JsonValue]] = field(default_factory=list)
    # 解码失败或端点无法校验的连线，跳过结构化解析，保存时按原位置写回。
    opaque_connections: list[tuple[int, JsonValue]] = field(default_factory=list)

    def clone(self) -> "CanvasDocument":
        """返回当前文档的深拷贝。"""
        return CanvasDocument(
            elements=[element.clone() for element in self.elements],
            connections=deepcopy(self.connections),
            extra_data=deepcopy(self.extra_data),
            opaque_elements=deepcopy(self.opaque_elements),
            opaque_connections=deepcopy(self.opaque_connections),
        )

    def iter_elements(self) -> list[CanvasElement]:
        """按文档顺序递归返回全部 Element。"""
        result: list[CanvasElement] = []
        for element in self.elements:
            result.extend(element.iter_elements())
        return result

    def get_element(self, element_id: str) -> CanvasElement | None:
        """按 Element ID 查找节点。"""
        return next((element for element in self.iter_elements() if element.element_id == element_id), None)

    def parent_map(self) -> dict[str, str | None]:
        """构建 Element 到直接父级的索引。"""
        result: dict[str, str | None] = {}

        def visit(element: CanvasElement, parent_id: str | None) -> None:
            result[element.element_id] = parent_id
            for child in element.children or []:
                visit(child, element.element_id)

        for element in self.elements:
            visit(element, None)
        return result

    def depth_map(self) -> dict[str, int]:
        """构建 Element 到树深度的索引。"""
        result: dict[str, int] = {}

        def visit(element: CanvasElement, depth: int) -> None:
            result[element.element_id] = depth
            for child in element.children or []:
                visit(child, depth + 1)

        for element in self.elements:
            visit(element, 0)
        return result

    def direct_children(self, element_id: str) -> list[CanvasElement]:
        """返回指定 Frame/Group 的直接子节点。"""
        element = self.get_element(element_id)
        return list(element.children or []) if element is not None else []

    def parent_element(self, element_id: str) -> CanvasElement | None:
        """返回 Element 的直接父容器。"""
        parent_id = self.parent_map().get(element_id)
        return self.get_element(parent_id) if parent_id else None

    def siblings(self, element_id: str) -> list[CanvasElement]:
        """返回 Element 所在直接父级坐标空间中的兄弟节点。"""
        parent = self.parent_element(element_id)
        return list(parent.children or []) if parent is not None else list(self.elements)

    def remove_element(self, element_id: str) -> CanvasElement | None:
        """从根级列表或直接父容器中移除 Element。"""
        for index, element in enumerate(self.elements):
            if element.element_id == element_id:
                return self.elements.pop(index)
        return self._remove_child(self.elements, element_id)

    def insert_element(
        self,
        element: CanvasElement,
        parent_element_id: str | None = None,
        index: int | None = None,
    ) -> None:
        """将 Element 插入根级或指定 Frame/Group 的 children。"""
        target = self.get_element(parent_element_id) if parent_element_id else None
        if parent_element_id and target is None:
            raise CanvasDomainError("ELEMENT_NOT_FOUND", f"Parent Element {parent_element_id} does not exist.")
        if target is None:
            container: list[CanvasElement] = self.elements
        else:
            if target.element_type not in {"frame", "group"}:
                raise CanvasDomainError("INVALID_ELEMENT_PARENT", "Only Frame or Group Elements may contain children.")
            if target.children is None:
                target.children = []
            container = target.children
        if index is None or index < 0 or index > len(container):
            container.append(element)
        else:
            container.insert(index, element)

    def _remove_child(self, elements: list[CanvasElement], element_id: str) -> CanvasElement | None:
        """递归移除直接子节点，供公开层级操作复用。"""
        for element in elements:
            children = element.children or []
            for index, child in enumerate(children):
                if child.element_id == element_id:
                    return children.pop(index)
            removed = self._remove_child(children, element_id)
            if removed is not None:
                return removed
        return None

    def to_dict(self) -> dict[str, object]:
        """转换为主协议 Canvas 字典。"""
        return {
            **deepcopy(self.extra_data),
            "elements": merge_indexed_opaque(
                [element.to_dict() for element in self.elements],
                self.opaque_elements,
            ),
            "connections": merge_indexed_opaque(
                [connection.to_dict() for connection in self.connections],
                self.opaque_connections,
            ),
        }

    def opaque_element_ids(self) -> set[str]:
        """返回跳过解析的节点 id，包含嵌套 children。"""
        ids = collect_opaque_element_ids(self.opaque_elements)
        for element in self.iter_elements():
            ids.update(collect_opaque_element_ids(element.opaque_children))
        return ids

    def validate(self) -> None:
        """校验 Element、Content、Connection 的领域不变量。"""
        elements: list[CanvasElement] = []
        element_ids: set[str] = set()

        def visit(element: CanvasElement, ancestors: set[int]) -> None:
            """递归校验层级树并检测对象引用环。"""
            object_id = id(element)
            if object_id in ancestors:
                raise CanvasDomainError("INVALID_CANVAS_DOCUMENT", "Element hierarchy cannot contain cycles.")
            if element.element_id in element_ids:
                raise CanvasDomainError("INVALID_CANVAS_DOCUMENT", "Element IDs must be unique.")
            element_ids.add(element.element_id)
            elements.append(element)
            next_ancestors = {*ancestors, object_id}
            if element.children and element.element_type not in {"frame", "group"}:
                raise CanvasDomainError("INVALID_ELEMENT", "Only Frame or Group Elements may contain children.")
            for child in element.children or []:
                visit(child, next_ancestors)

        for element in self.elements:
            visit(element, set())

        connection_ids: set[str] = set()
        connection_pairs: set[tuple[str, str]] = set()
        # 连线可能指向前端新增、后端跳过解析的节点，这些 id 仍视为存在。
        known_ids = element_ids | self.opaque_element_ids()
        for connection in self.connections:
            if not connection.connection_id or connection.connection_id in connection_ids:
                raise CanvasDomainError("INVALID_CONNECTION", "Connection IDs must be unique and non-empty.")
            if connection.source_element_id not in known_ids or connection.target_element_id not in known_ids:
                raise CanvasDomainError("INVALID_CONNECTION", "Connection endpoints must reference existing Elements.")
            if connection.source_element_id == connection.target_element_id:
                raise CanvasDomainError("INVALID_CONNECTION", "A Connection cannot point to the same Element.")
            pair = (connection.source_element_id, connection.target_element_id)
            if pair in connection_pairs:
                raise CanvasDomainError("INVALID_CONNECTION", "Duplicate Connections are not allowed.")
            connection_ids.add(connection.connection_id)
            connection_pairs.add(pair)
        for element in elements:
            content_ids = [content.content_id for content in element.contents]
            if len(content_ids) != len(set(content_ids)):
                raise CanvasDomainError("INVALID_CONTENT", "Content IDs must be unique within an Element.")
            if element.contents:
                if element.active_content_id not in content_ids or element.main_content_id not in content_ids:
                    raise CanvasDomainError("INVALID_ELEMENT", "Content pointers must reference existing Content.")
            elif element.active_content_id is not None or element.main_content_id is not None:
                raise CanvasDomainError("INVALID_ELEMENT", "Empty Elements must have null Content pointers.")
