"""Frame 框选层级策略。"""

import math
import uuid

from app.tools.canvas.domain.content_fields import ContentFieldsFactory
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasContent, CanvasDocument, CanvasElement, ElementProperties
from app.tools.canvas.domain.services.coordinate_space_resolver import CoordinateSpaceResolver
from app.tools.canvas.domain.services.element_tree_index import ElementTreeIndex
from app.tools.canvas.strategies.hierarchy.interface import HierarchyStrategyInterface
from app.tools.canvas.strategies.hierarchy.plan import FrameSelectionPlan
from app.tools.canvas.strategies.hierarchy.request import FrameSelectionRequest


class FrameSelectionStrategy(HierarchyStrategyInterface):
    """把根级普通兄弟节点转换为一个 Frame。"""

    name = "frame_selection"
    default_padding_divisor = 18.0

    def plan(self, canvas: CanvasDocument, request: FrameSelectionRequest) -> FrameSelectionPlan:
        """校验选区并计算 Frame 包围盒和子节点局部坐标。"""
        element_ids = list(request.element_ids)
        if not element_ids:
            raise CanvasDomainError("FRAME_SELECTION_INVALID", "Frame selection cannot be empty.")
        if len(element_ids) != len(set(element_ids)):
            raise CanvasDomainError("FRAME_SELECTION_INVALID", "Frame selection cannot contain duplicate Element IDs.")
        index = ElementTreeIndex(canvas)
        selected = []
        for element_id in element_ids:
            element = canvas.get_element(element_id)
            if element is None:
                raise CanvasDomainError("ELEMENT_NOT_FOUND", f"Element {element_id} does not exist.")
            if element.element_type in {"frame", "group"}:
                raise CanvasDomainError("FRAME_SELECTION_INVALID", "Frame selection cannot include Frame or Group Elements.")
            if element.properties.locked is True:
                raise CanvasDomainError("FRAME_SELECTION_INVALID", f"Element {element_id} is locked.")
            if index.parent_id(element_id) is not None:
                raise CanvasDomainError("FRAME_SELECTION_ALREADY_NESTED", "Selected Elements must be direct root-level Elements.")
            selected.append(element)
        if any(index.parent_id(element.element_id) != index.parent_id(selected[0].element_id) for element in selected):
            raise CanvasDomainError("FRAME_SELECTION_MIXED_PARENTS", "Selected Elements must share the same direct parent.")
        ordered = sorted(selected, key=lambda element: canvas.elements.index(element))
        left, top, right, bottom = CoordinateSpaceResolver.bounds(ordered)
        longest = max(right - left, bottom - top)
        padding = longest / self.default_padding_divisor if request.padding is None else request.padding
        if not isinstance(padding, (int, float)) or isinstance(padding, bool) or not math.isfinite(float(padding)) or padding < 0:
            raise CanvasDomainError("FRAME_PADDING_INVALID", "Frame padding must be a non-negative number.")
        frame_id = f"frame-{uuid.uuid4().hex[:16]}"
        frame_x = left - float(padding)
        frame_y = top - float(padding)
        frame = CanvasElement(
            element_id=frame_id,
            element_type="frame",
            properties=ElementProperties(x=frame_x, y=frame_y, width=right - left + 2 * float(padding), height=bottom - top + 2 * float(padding), z_index=CoordinateSpaceResolver.next_root_z_index(canvas)),
            children=[],
        )
        if request.name:
            frame.properties.name = request.name
        content = CanvasContent(f"content-{uuid.uuid4().hex[:16]}", ContentFieldsFactory.empty("frame"))
        frame.contents = [content]
        frame.active_content_id = content.content_id
        frame.main_content_id = content.content_id
        children = tuple(CoordinateSpaceResolver.to_local(element, frame_x, frame_y) for element in ordered)
        root_indexes = [canvas.elements.index(element) for element in ordered]
        return FrameSelectionPlan(
            item_ref=request.item_ref,
            frame=frame,
            children=children,
            selected_ids=tuple(element.element_id for element in ordered),
            root_insert_index=min(root_indexes),
            padding=float(padding),
        )
