"""Canvas Element 详情查询服务。"""

from __future__ import annotations

from dataclasses import replace
from pathlib import PurePosixPath
from typing import Any, cast

from app.tools.canvas.application.results import (
    CanvasChildElementResult,
    CanvasConnectionDetailResult,
    CanvasContentDetailResult,
    CanvasElementDetailResult,
    CanvasElementsResult,
    CanvasLayoutResult,
)
from app.tools.canvas.domain.content_fields.generated_media_protocol import (
    find_generation_request,
    generated_request_fields,
)
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.content_fields.image import ImageContentFields
from app.tools.canvas.domain.models import CanvasElement
from app.tools.canvas.domain.services.element_tree_index import ElementTreeIndex
from app.tools.canvas.domain.services.spatial_geometry import CanvasSpatialGeometry
from app.tools.canvas.domain.types import JsonObject
from app.tools.canvas.infrastructure.assets.project_asset_path_resolver import ProjectAssetPathResolver
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.canvas.infrastructure.persistence.element_details_adapter import ElementDetailsAdapter
from app.utils.async_file_utils import async_exists, get_file_id_from_xattr

_RUNTIME_DETAIL_FIELDS = frozenset(
    {
        "productionRule",
        "generationStatus",
        "providerTaskId",
        "generationTaskId",
        "outputUri",
        "outputFilename",
        "durationSeconds",
        "hasAudio",
        "composition",
        "attemptHistory",
    }
)


class ElementDetailsQueryService:
    """只负责读取精确 Element、合并 sidecar 并投影详情 DTO。"""

    def __init__(self, repository: CanvasRepositoryInterface, sidecar_adapter: ElementDetailsAdapter | None = None):
        """保存详情查询所需的仓储和 sidecar 适配器。"""
        self.repository = repository
        self.sidecar_adapter = sidecar_adapter or ElementDetailsAdapter()

    async def elements(self, project_path: str, element_ids: list[str]) -> CanvasElementsResult:
        """返回精确 Element 的模型友好详情和关联连线。"""
        project = await self.repository.read(project_path)
        sidecar_warnings: list[str] = []
        try:
            baseline = await self.repository.read_sidecar(project_path, "element-details.json")
            baseline["__canvas_runtime__"] = await self.repository.read_sidecar_runtime(project_path)
        except ValueError:
            baseline = {}
            sidecar_warnings.append("Some generated Content details are temporarily unavailable.")
        try:
            user = await self.repository.read_sidecar(project_path, "element-details-user.json")
        except ValueError:
            user = {}
            sidecar_warnings.append("Some user-provided Content details are temporarily unavailable.")
        merged_details = self.sidecar_adapter.merge(project, baseline, user)
        tree = ElementTreeIndex(project.canvas)
        requested = []
        for element_id in element_ids:
            element = project.canvas.get_element(element_id)
            if element is None:
                raise CanvasDomainError("ELEMENT_NOT_FOUND", f"Element {element_id} does not exist.")
            requested.append(element)
        selected = set(element_ids)
        connections = tuple(
            CanvasConnectionDetailResult(
                connection_id=connection.connection_id,
                source_element_id=connection.source_element_id,
                target_element_id=connection.target_element_id,
            )
            for connection in project.canvas.connections
            if connection.source_element_id in selected or connection.target_element_id in selected
        )
        projected: list[CanvasElementDetailResult] = []
        paths = ProjectAssetPathResolver(self.repository.workspace)
        geometry = CanvasSpatialGeometry(project.canvas)
        for element in requested:
            dto = self.element_details_dto(element, merged_details.get(element.element_id, {}), connections, tree)
            contents: list[CanvasContentDetailResult] = []
            for content in dto.contents:
                if content.asset_path and "://" not in content.asset_path and not content.asset_path.startswith("data:"):
                    try:
                        reference = paths.to_workspace_reference_path(project_path, content.asset_path)
                    except ValueError:
                        sidecar_warnings.append(
                            f"Element {element.element_id} Content {content.content_id} has an unresolved Workspace file path."
                        )
                        contents.append(replace(content, file_name=None))
                        continue
                    path = self.repository.workspace / reference
                    exists = await async_exists(path)
                    content = replace(
                        content, file_exists=exists,
                        file_id=await get_file_id_from_xattr(path) if exists else None,
                        file_name=path.name if exists else None,
                    )
                unlocked = all(e.properties.locked is not True for e in [element, *geometry.ancestors(element.element_id)])
                available = element.element_type == "image" and unlocked and bool(content.file_exists and content.file_id) and content.status not in {"pending", "processing"}
                contents.append(replace(content, can_rename_file=available, file_rename_reason=None if available else "The Element or its parent is locked." if not unlocked else "No completed, resolved Workspace image file is available for this version."))
            projected.append(replace(dto, contents=tuple(contents)))
        return CanvasElementsResult(
            project_path=project_path,
            details_complete=not sidecar_warnings,
            elements=tuple(projected),
            connections=connections,
            warnings=tuple(sidecar_warnings),
        )

    @staticmethod
    def element_details_dto(
        element: CanvasElement,
        details: dict[str, dict[str, Any]],
        connections: tuple[CanvasConnectionDetailResult, ...],
        tree: ElementTreeIndex,
    ) -> CanvasElementDetailResult:
        """把持久化字段和内部详情转换为稳定 Tool DTO。"""
        layout_keys = {
            "x": "x", "y": "y", "width": "width", "height": "height",
            "scaleX": "scale_x", "scaleY": "scale_y", "zIndex": "z_index",
        }
        layout = CanvasLayoutResult(
            x=element.properties.x,
            y=element.properties.y,
            width=element.properties.width,
            height=element.properties.height,
            scale_x=element.properties.scale_x,
            scale_y=element.properties.scale_y,
            z_index=element.properties.z_index,
        )
        contents: list[CanvasContentDetailResult] = []
        for version_index, content in enumerate(element.contents, 1):
            detail = details.get(content.content_id, {})
            payload = {
                key: value
                for key, value in content.fields.to_dict().items()
                if key not in {
                    "src", "status", "errorMessage", "imageGenerationTaskMeta", "discarded",
                } | generated_request_fields()
            }
            generation_request = find_generation_request(detail)
            parameters = detail.get("generationParameters")
            if not isinstance(parameters, dict):
                parameters = generation_request[1] if generation_request else {}
            elif generation_request is not None:
                # 界面按版本读取公共生成请求；同名字段以它为准，保留运行记录中的补充字段。
                # 只构造查询投影，不修改 sidecar 或用于重试的原始参数。
                parameters = {**parameters, **generation_request[1]}
            contents.append(CanvasContentDetailResult(
                version_index=version_index,
                file_name=(PurePosixPath(content.fields.asset_path).name
                           if content.fields.asset_path and "://" not in content.fields.asset_path else None),
                generation_name=str(parameters["name"]) if parameters.get("name") else None,
                is_current=content.content_id == element.active_content_id,
                is_main=content.content_id == element.main_content_id,
                content_id=content.content_id,
                status=content.fields.generation_status,
                asset_path=content.fields.asset_path,
                error_message=content.fields.error_message,
                source=detail.get("source"),
                retry_count=int(detail.get("retryCount", 0)),
                generation_task_id=detail.get("generationTaskId"),
                generation_parameters=(
                    cast(JsonObject, parameters) if parameters else None
                ),
                payload=cast(JsonObject, payload) if payload else None,
                runtime=ElementDetailsQueryService._runtime_detail(detail),
                discarded=isinstance(content.fields, ImageContentFields) and content.fields.discarded,
            ))
        return CanvasElementDetailResult(
            element_id=element.element_id,
            element_type=element.element_type,
            name=element.properties.name,
            visible=element.properties.visible,
            locked=element.properties.locked,
            opacity=element.properties.opacity,
            parent_element_id=tree.parent_id(element.element_id),
            depth=tree.depth(element.element_id),
            child_element_ids=tuple(tree.child_ids(element.element_id)),
            children=tuple(
                CanvasChildElementResult(
                    element_id=child.element_id,
                    element_type=child.element_type,
                    parent_element_id=element.element_id,
                    depth=tree.depth(child.element_id),
                )
                for child in element.children or []
            ),
            layout=layout,
            active_content_id=element.active_content_id,
            main_content_id=element.main_content_id,
            contents=tuple(contents),
            connections=tuple(
                connection for connection in connections
                if connection.source_element_id == element.element_id
                or connection.target_element_id == element.element_id
            ),
        )

    @staticmethod
    def _runtime_detail(detail: dict[str, Any]) -> JsonObject | None:
        """提取模型继续决策所需的受控运行态详情。"""
        runtime = {
            key: value
            for key, value in detail.items()
            if key in _RUNTIME_DETAIL_FIELDS and value is not None
        }
        return cast(JsonObject, runtime) if runtime else None
