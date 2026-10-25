"""Frame 框选策略变更计划。"""

from dataclasses import dataclass

from app.tools.canvas.domain.models import CanvasElement


@dataclass(frozen=True)
class FrameSelectionPlan:
    """封装已经完成校验和坐标换算的 Frame 计划。"""

    item_ref: str
    frame: CanvasElement
    children: tuple[CanvasElement, ...]
    selected_ids: tuple[str, ...]
    root_insert_index: int
    padding: float
