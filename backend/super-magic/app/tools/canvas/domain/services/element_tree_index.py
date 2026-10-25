"""Canvas Element 树只读索引。"""

from __future__ import annotations

from app.tools.canvas.domain.models import CanvasDocument, CanvasElement


class ElementTreeIndex:
    """为查询、布局和层级写入提供统一的只读树索引。"""

    def __init__(self, canvas: CanvasDocument):
        """根据当前 Canvas 快照建立父级和深度索引。"""
        self._canvas = canvas
        self._parent_ids = canvas.parent_map()
        self._depths = canvas.depth_map()

    def parent_id(self, element_id: str) -> str | None:
        """返回 Element 的直接父级 ID。"""
        return self._parent_ids.get(element_id)

    def depth(self, element_id: str) -> int:
        """返回 Element 在树中的深度。"""
        return self._depths.get(element_id, 0)

    def child_ids(self, element_id: str) -> list[str]:
        """返回 Element 的直接子节点 ID。"""
        return [child.element_id for child in self._canvas.direct_children(element_id)]

    def siblings(self, element_id: str) -> list[CanvasElement]:
        """返回 Element 所在直接父级下的全部兄弟节点。"""
        parent_id = self.parent_id(element_id)
        if parent_id is None:
            return list(self._canvas.elements)
        return self._canvas.direct_children(parent_id)
