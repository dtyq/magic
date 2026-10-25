"""Canvas Element 领域模型。"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Iterable

from app.tools.canvas.domain.models.canvas_content import CanvasContent
from app.tools.canvas.domain.models.element_properties import ElementProperties
from app.tools.canvas.domain.types import JsonObject, JsonValue


@dataclass
class CanvasElement:
    """表示一个可嵌套的 Canvas Element。"""

    element_id: str
    element_type: str
    properties: ElementProperties = field(default_factory=ElementProperties)
    contents: list[CanvasContent] = field(default_factory=list)
    active_content_id: str | None = None
    main_content_id: str | None = None
    children: list["CanvasElement"] | None = None
    extra_data: JsonObject = field(default_factory=dict)
    # 未支持或解码失败的子节点，跳过结构化解析，保存时按原位置写回。
    opaque_children: list[tuple[int, JsonValue]] = field(default_factory=list)

    def clone(self) -> "CanvasElement":
        """返回当前 Element 的深拷贝。"""
        return CanvasElement(
            element_id=self.element_id,
            element_type=self.element_type,
            properties=ElementProperties.from_dict(self.properties.to_dict()),
            contents=[content.clone() for content in self.contents],
            active_content_id=self.active_content_id,
            main_content_id=self.main_content_id,
            children=[child.clone() for child in self.children] if self.children is not None else None,
            extra_data=deepcopy(self.extra_data),
            opaque_children=deepcopy(self.opaque_children),
        )

    def iter_elements(self) -> Iterable["CanvasElement"]:
        """递归返回当前 Element 及其子节点。"""
        yield self
        for child in self.children or []:
            yield from child.iter_elements()

    def get_content(self, content_id: str | None) -> CanvasContent | None:
        """按 Content ID 查找版本。"""
        if not content_id:
            return None
        return next((item for item in self.contents if item.content_id == content_id), None)

    def to_dict(self) -> dict[str, object]:
        """转换为主协议 Element 字典。"""
        result = {
            **deepcopy(self.extra_data),
            "id": self.element_id,
            "type": self.element_type,
            **self.properties.to_dict(),
            "activeContentId": self.active_content_id,
            "mainContentId": self.main_content_id,
            "contents": [content.to_dict() for content in self.contents],
        }
        if self.children is not None or self.opaque_children:
            result["children"] = merge_indexed_opaque(
                [child.to_dict() for child in self.children or []],
                self.opaque_children,
            )
        return result


def merge_indexed_opaque(
    items: list[dict[str, object]],
    opaques: list[tuple[int, JsonValue]],
) -> list[object]:
    """把跳过解析的原始节点按原下标插回序列，避免保存时丢失。"""
    result: list[object] = list(items)
    for index, raw in sorted(opaques, key=lambda pair: pair[0]):
        insert_at = min(max(index, 0), len(result))
        result.insert(insert_at, deepcopy(raw))
    return result


def collect_opaque_element_ids(opaques: list[tuple[int, JsonValue]]) -> set[str]:
    """从跳过解析的原始节点中收集 id，供连线校验使用。"""
    ids: set[str] = set()

    def visit(raw: object) -> None:
        if not isinstance(raw, dict):
            return
        element_id = raw.get("id")
        if isinstance(element_id, str) and element_id:
            ids.add(element_id)
        children = raw.get("children")
        if isinstance(children, list):
            for child in children:
                visit(child)

    for _, raw in opaques:
        visit(raw)
    return ids
