"""Canvas 概览查询服务。"""

from __future__ import annotations

from pathlib import PurePosixPath

from app.tools.canvas.application.results import CanvasOverviewElementResult, CanvasOverviewResult
from app.tools.canvas.domain.content_fields import ContentFieldsFactory
from app.tools.canvas.domain.models import CanvasContent
from app.tools.canvas.domain.services.element_tree_index import ElementTreeIndex
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface


class OverviewQueryService:
    """只负责生成分页的轻量 Canvas Element 概览。"""

    def __init__(self, repository: CanvasRepositoryInterface):
        """保存只读查询所需的 Canvas 仓储。"""
        self.repository = repository

    async def overview(self, project_path: str, page: int, limit: int) -> CanvasOverviewResult:
        """返回带父级、深度和连接摘要的分页结果。"""
        project = await self.repository.read(project_path)
        elements = project.canvas.iter_elements()
        tree = ElementTreeIndex(project.canvas)
        total = len(elements)
        start = (page - 1) * limit
        page_items = elements[start : start + limit]
        connection_map: dict[str, dict[str, list[str]]] = {
            element.element_id: {"incoming": [], "outgoing": []} for element in elements
        }
        for connection in project.canvas.connections:
            if connection.source_element_id in connection_map:
                connection_map[connection.source_element_id]["outgoing"].append(connection.target_element_id)
            if connection.target_element_id in connection_map:
                connection_map[connection.target_element_id]["incoming"].append(connection.source_element_id)
        # 概览只读当前持久化版本，不查询文件系统或生成详情；文件存在性由精确详情核实。
        active_contents = {
            element.element_id: element.get_content(element.active_content_id)
            or CanvasContent("", ContentFieldsFactory.empty(element.element_type))
            for element in page_items
        }
        return CanvasOverviewResult(
            project_path=project_path,
            project_name=project.name,
            total_elements=total,
            total_connections=len(project.canvas.connections),
            page=page,
            limit=limit,
            has_more=start + limit < total,
            elements=tuple(
                CanvasOverviewElementResult(
                    element_id=element.element_id,
                    element_type=element.element_type,
                    name=element.properties.name,
                    x=element.properties.x,
                    y=element.properties.y,
                    width=element.properties.width,
                    height=element.properties.height,
                    content_count=len(element.contents),
                    active_content_id=element.active_content_id,
                    main_content_id=element.main_content_id,
                    status=active_contents[element.element_id].fields.generation_status,
                    asset_path=active_contents[element.element_id].fields.asset_path,
                    file_name=self._file_name(active_contents[element.element_id].fields.asset_path),
                    parent_element_id=tree.parent_id(element.element_id),
                    depth=tree.depth(element.element_id),
                    child_count=len(tree.child_ids(element.element_id)),
                    incoming_element_ids=tuple(connection_map[element.element_id]["incoming"]),
                    outgoing_element_ids=tuple(connection_map[element.element_id]["outgoing"]),
                )
                for element in page_items
            ),
        )

    @staticmethod
    def _file_name(asset_path: str | None) -> str | None:
        """只为项目文件路径返回名称；远程资源和内嵌数据没有可管理的文件名。"""
        if not asset_path or "://" in asset_path or asset_path.startswith("data:"):
            return None
        return PurePosixPath(asset_path).name
