"""Canvas 查询门面兼容层。"""

from __future__ import annotations

from typing import Any

from app.tools.canvas.application.results import (
    CanvasConnectionDetailResult,
    CanvasElementDetailResult,
    CanvasElementsResult,
    CanvasOverviewResult,
)
from app.tools.canvas.domain.models import CanvasElement
from app.tools.canvas.domain.services.element_tree_index import ElementTreeIndex
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.canvas.infrastructure.persistence.element_details_adapter import ElementDetailsAdapter
from app.tools.canvas.queries.element_details_query_service import ElementDetailsQueryService
from app.tools.canvas.queries.overview_query_service import OverviewQueryService


class CanvasQueryService:
    """兼容旧调用方，同时把概览和详情委托给独立查询服务。"""

    def __init__(self, repository: CanvasRepositoryInterface, sidecar_adapter: ElementDetailsAdapter | None = None):
        """组装两个只读查询用例，不承载查询业务规则。"""
        self.repository = repository
        self.sidecar_adapter = sidecar_adapter or ElementDetailsAdapter()
        self.overview_service = OverviewQueryService(repository)
        self.element_details_service = ElementDetailsQueryService(repository, self.sidecar_adapter)

    async def overview(self, project_path: str, page: int, limit: int) -> CanvasOverviewResult:
        """委托概览查询。"""
        return await self.overview_service.overview(project_path, page, limit)

    async def elements(self, project_path: str, element_ids: list[str]) -> CanvasElementsResult:
        """委托详情查询。"""
        return await self.element_details_service.elements(project_path, element_ids)

    @staticmethod
    def element_details_dto(
        element: CanvasElement,
        details: dict[str, dict[str, Any]],
        connections: tuple[CanvasConnectionDetailResult, ...],
        tree: ElementTreeIndex,
    ) -> CanvasElementDetailResult:
        """保留旧的静态投影入口。"""
        return ElementDetailsQueryService.element_details_dto(element, details, connections, tree)
