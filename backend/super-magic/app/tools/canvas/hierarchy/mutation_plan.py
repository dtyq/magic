"""Canvas 层级变更计划。"""

from dataclasses import dataclass

from app.tools.canvas.domain.models import CanvasDocument, CanvasElement


@dataclass(frozen=True)
class HierarchyMutationPlan:
    """封装一次把同层级节点收纳到 Frame 的树结构变更。"""

    frame: CanvasElement
    selected_ids: tuple[str, ...]
    root_insert_index: int

    def apply(self, canvas: CanvasDocument) -> None:
        """在已完成校验的 Canvas 快照上应用层级变更。"""
        selected = set(self.selected_ids)
        canvas.elements[:] = [element for element in canvas.elements if element.element_id not in selected]
        canvas.insert_element(self.frame, index=min(self.root_insert_index, len(canvas.elements)))
