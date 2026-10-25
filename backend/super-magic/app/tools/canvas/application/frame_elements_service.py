"""Frame 框选用例服务。"""

from __future__ import annotations

from collections.abc import Sequence

from app.tools.canvas.application.commands import FrameElementsCommand
from app.tools.canvas.application.results import FrameElementResultItem, FrameElementsResult
from app.tools.canvas.application.support import CanvasApplicationOperations
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.hierarchy import FrameSelectionRequest, HierarchyMutationPlan
from app.tools.canvas.repository import CanvasUnitOfWork
from app.tools.canvas.strategies.hierarchy.interface import HierarchyStrategyInterface


class FrameElementsService:
    """Canvas FrameElementsService 用例服务。"""

    def __init__(self, unit_of_work: CanvasUnitOfWork, frame_selection: HierarchyStrategyInterface):
        """显式绑定框选用例所需的事务和层级选择策略。"""
        self.unit_of_work = unit_of_work
        self.frame_selection = frame_selection

    async def frame_elements(
        self,
        project_path: str,
        items: Sequence[FrameElementsCommand],
    ) -> FrameElementsResult:
        """将根级普通兄弟节点框选为新 Frame，并完成局部坐标转换。"""
        CanvasApplicationOperations.validate_unique_item_refs(items)
        current_item_ref: str | None = None

        def mutate(project: CanvasProject, metadata: dict) -> tuple[FrameElementsResult, dict]:
            nonlocal current_item_ref
            results: list[FrameElementResultItem] = []
            selected_ids: set[str] = set()
            for item in items:
                current_item_ref = item.item_ref
                request = FrameSelectionRequest(
                    item_ref=item.item_ref,
                    element_ids=item.element_ids,
                    name=item.name,
                    padding=item.padding,
                )
                if selected_ids.intersection(request.element_ids):
                    raise CanvasDomainError("FRAME_SELECTION_OVERLAP", "Frame selections in one batch cannot overlap.")
                plan = self.frame_selection.plan(project.canvas, request)
                children = [child.clone() for child in plan.children]
                plan.frame.children = children
                HierarchyMutationPlan(
                    frame=plan.frame,
                    selected_ids=plan.selected_ids,
                    root_insert_index=plan.root_insert_index,
                ).apply(project.canvas)
                selected_ids.update(plan.selected_ids)
                results.append(FrameElementResultItem(
                    item_ref=item.item_ref,
                    frame_element_id=plan.frame.element_id,
                    child_element_ids=tuple(child.element_id for child in children),
                    content_id=plan.frame.active_content_id,
                    parent_element_id=None,
                    depth=0,
                    padding=plan.padding,
                    status="completed",
                ))
            return FrameElementsResult(results), metadata

        try:
            return await self.unit_of_work.transaction_with_sidecar(project_path, mutate)
        except CanvasDomainError as error:
            raise CanvasApplicationOperations.batch_error(list(items), current_item_ref, error) from error
