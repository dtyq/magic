"""Canvas 布局用例服务。"""

from __future__ import annotations

from collections.abc import Sequence

from app.tools.canvas.application.commands import LayoutElementCommand
from app.tools.canvas.application.results import LayoutElementResultItem, LayoutElementsResult
from app.tools.canvas.application.support import CanvasApplicationOperations
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.repository import CanvasUnitOfWork
from app.tools.canvas.strategies import LayoutStrategyRegistry


class LayoutService:
    """Canvas LayoutService 用例服务。"""

    def __init__(self, unit_of_work: CanvasUnitOfWork, layout_strategies: LayoutStrategyRegistry):
        """显式绑定布局用例所需的事务和布局策略。"""
        self.unit_of_work = unit_of_work
        self.layout_strategies = layout_strategies

    async def layout(self, project_path: str, items: Sequence[LayoutElementCommand]) -> LayoutElementsResult:
        """按可插拔布局策略调整 Element 布局。"""
        CanvasApplicationOperations.validate_unique_item_refs(items)
        current_item_ref: str | None = None
        def mutate(project: CanvasProject, metadata: dict) -> tuple[LayoutElementsResult, dict]:
            nonlocal current_item_ref
            results: list[LayoutElementResultItem] = []
            for index, item in enumerate(items):
                current_item_ref = item.item_ref
                element = project.canvas.get_element(item.element_id)
                if element is None:
                    raise CanvasDomainError("ELEMENT_NOT_FOUND", f"Element {item.element_id} does not exist.")
                self.layout_strategies.get(item.layout.strategy).apply(project.canvas, element, item.layout, index)
                results.append(LayoutElementResultItem(
                    item_ref=item.item_ref,
                    status="completed",
                    element_id=element.element_id,
                    strategy=item.layout.strategy,
                ))
            return LayoutElementsResult(results), metadata

        try:
            return await self.unit_of_work.transaction_with_sidecar(project_path, mutate)
        except CanvasDomainError as error:
            raise CanvasApplicationOperations.batch_error(list(items), current_item_ref, error) from error
