"""确认后移除画布目标，真实文件删除复用 Workspace 工具。"""

from __future__ import annotations

from pathlib import Path
from typing import Literal, cast

from pydantic import BaseModel, ConfigDict

from agentlang.context.tool_context import ToolContext
from app.core.context.agent_context import AgentContext
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.domain.services.spatial_geometry import CanvasSpatialGeometry
from app.tools.canvas.domain.types import JsonObject
from app.tools.canvas.infrastructure.assets.workspace_file_management import WorkspaceFileInfo, WorkspaceFileManagement
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.canvas.infrastructure.persistence.content_metadata_service import ContentMetadataService
from app.tools.delete_files import DeleteFiles, DeleteFilesParams
from app.utils.async_file_utils import async_exists, get_file_id_from_xattr


class DeleteCanvasTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")
    element_id: str
    scope: Literal["current", "all"] | None = None
    content_id: str | None = None


class DeleteElementsService:
    def __init__(self, repository: CanvasRepositoryInterface, context: ToolContext):
        self.repository, self.context = repository, context

    async def run(
        self,
        project_path: str,
        targets: list[DeleteCanvasTarget],
        mode: str,
        stage: str,
    ) -> JsonObject:
        agent = self.context.get_extension_typed("agent_context", AgentContext)
        if agent is None:
            raise CanvasDomainError("AGENT_CONTEXT_REQUIRED", "Canvas deletion requires the current Agent context.")
        gateway = WorkspaceFileManagement(self.repository.workspace, project_path, agent)
        payload = await self._prepare(project_path, targets, mode, gateway)
        if stage == "prepare":
            return {
                **payload,
                "items": [{**item, "status": "prepared"} for item in payload["items"]],
                "stage": "prepared",
            }
        await gateway.check_canvas_write_access()
        file_outcomes: dict[str, JsonObject] = {}
        for file in payload["files"]:
            if file["shared"]:
                file_outcomes[str(file["file_id"])] = {**file, "status": "shared_file_kept"}
                continue
            path = Path(str(file["path"]))
            identity = WorkspaceFileInfo.model_validate(file["identity"])
            try:
                if await gateway.info(identity.id) != identity or await get_file_id_from_xattr(path) != identity.id:
                    raise CanvasDomainError("FILE_IDENTITY_CHANGED", "The file changed during execution.")
                deletion = await gateway.wait(
                    DeleteFiles(base_dir=self.repository.workspace).execute(
                        self.context, DeleteFilesParams(file_paths=[str(path)])
                    )
                )
                status = "file_deleted" if deletion.ok and not await async_exists(path) else "deletion_unconfirmed"
                file_outcomes[identity.id] = {**file, "status": status}
            except Exception as error:
                file_outcomes[identity.id] = {
                    **file,
                    "status": "failed",
                    "error": str(error),
                    "error_code": error.code if isinstance(error, CanvasDomainError) else "INTERNAL_ERROR",
                }
        outcomes: list[JsonObject] = []
        for item in payload["items"]:
            removable = [
                content_id
                for content_id in item["content_ids"]
                if mode == "remove"
                or file_outcomes[item["content_files"][content_id]]["status"] in {"file_deleted", "shared_file_kept"}
            ]
            ready = len(removable) == len(item["content_ids"])
            if not removable and item["content_ids"]:
                outcomes.append(
                    {
                        **item,
                        "status": "retained",
                        "reason": "File deletion was not confirmed; Canvas target was retained.",
                        "error_code": "FILE_DELETE_INCOMPLETE",
                    }
                )
                continue
            try:
                cleaned = await self._remove(project_path, item, removable)
                outcomes.append(
                    {
                        **item,
                        "status": "removed" if ready and cleaned else "partial",
                        "removed_content_ids": removable,
                        "metadata_cleanup_complete": cleaned,
                        "error_code": None if cleaned else "METADATA_CLEANUP_FAILED",
                    }
                )
            except Exception as error:
                changed_files = any(file_outcomes[file_id]["status"] == "file_deleted" for file_id in item["file_ids"])
                outcomes.append(
                    {
                        **item,
                        "status": "partial" if changed_files else "canvas_write_failed",
                        "reason": str(error),
                        "error_code": error.code if isinstance(error, CanvasDomainError) else "INTERNAL_ERROR",
                    }
                )
        complete = all(item["status"] == "removed" and item["metadata_cleanup_complete"] for item in outcomes)
        return {
            "project_path": project_path,
            "stage": "executed",
            "items": outcomes,
            "files": list(file_outcomes.values()),
            "complete": complete,
        }

    async def _prepare(
        self, project_path: str, targets: list[DeleteCanvasTarget], mode: str, gateway: WorkspaceFileManagement
    ) -> JsonObject:
        if not targets or len({target.element_id for target in targets}) != len(targets):
            raise CanvasDomainError("INVALID_SELECTION", "Select distinct exact Element IDs.")
        project = await self.repository.read(project_path)
        canvas, items, files = project.canvas, [], {}
        if (
            canvas.opaque_elements
            or canvas.opaque_connections
            or any(element.opaque_children for element in canvas.iter_elements())
        ):
            raise CanvasDomainError(
                "REFERENCES_UNAVAILABLE",
                "Some Elements or connections cannot be decoded. Deletion scope cannot be verified safely.",
            )
        geometry = CanvasSpatialGeometry(canvas)
        selected = {target.element_id for target in targets}
        references: dict[str, list[tuple[str, str]]] = {}
        for element in canvas.iter_elements():
            if mode != "remove_with_files":
                break
            for content in element.contents:
                asset_path = content.fields.asset_path
                if not asset_path or "://" in asset_path:
                    continue
                try:
                    reference = gateway.paths.to_workspace_reference_path(project_path, asset_path)
                except ValueError:
                    continue
                references.setdefault(str(gateway.workspace / reference), []).append(
                    (element.element_id, content.content_id)
                )
        removal_pairs: set[tuple[str, str]] = set()
        for target in targets:
            element = geometry.assert_mutable(target.element_id)
            if any(ancestor.element_id in selected for ancestor in geometry.ancestors(target.element_id)):
                continue
            scope = target.scope
            if len(element.contents) > 1 and scope is None:
                raise CanvasDomainError(
                    "VERSION_SCOPE_REQUIRED", "This Element has multiple versions. Explicitly choose current or all."
                )
            scope = scope or "all"
            if target.content_id is not None and (scope != "current" or target.content_id != element.active_content_id):
                raise CanvasDomainError(
                    "CURRENT_VERSION_REQUIRED", "content_id must identify the exact active version with scope=current."
                )
            if scope == "current" and len(element.contents) > 1:
                if element.element_type != "image" or target.content_id != element.active_content_id:
                    raise CanvasDomainError(
                        "CURRENT_VERSION_REQUIRED",
                        "Current-version deletion requires the exact active image Content ID.",
                    )
                affected = [element]
                content_ids = [target.content_id]
            else:
                affected = list(element.iter_elements())
                content_ids = [content.content_id for child in affected for content in child.contents]
            for child in affected:
                geometry.assert_mutable(child.element_id)
                removal_pairs.update(
                    (child.element_id, content.content_id)
                    for content in child.contents
                    if content.content_id in content_ids
                )
            if mode == "remove_with_files" and element.element_type != "image":
                raise CanvasDomainError(
                    "IMAGE_REQUIRED", "Remove-with-files supports actual image Elements, not directories or Frames."
                )
            items.append(
                {
                    "element_id": element.element_id,
                    "name": element.properties.name,
                    "scope": scope,
                    "content_ids": content_ids,
                    "descendant_ids": [child.element_id for child in affected],
                    "file_ids": [],
                    "content_files": {},
                    "snapshot": [
                        {
                            "element_id": child.element_id,
                            "name": child.properties.name,
                            "active_content_id": child.active_content_id,
                            "main_content_id": child.main_content_id,
                            "contents": [c.to_dict() for c in child.contents],
                        }
                        for child in affected
                    ],
                }
            )
        for item in items:
            if mode != "remove_with_files":
                continue
            element = geometry.require(str(item["element_id"]))
            for content in element.contents:
                if content.content_id not in item["content_ids"]:
                    continue
                if not content.fields.asset_path or content.fields.generation_status in {"pending", "processing"}:
                    raise CanvasDomainError(
                        "FILE_NOT_READY",
                        "This version is still generating or has no actual file. Use remove to remove only its Canvas placeholder.",
                    )
                file = await gateway.resolve(content.fields.asset_path)
                outside = [pair for pair in references.get(str(file.path), []) if pair not in removal_pairs]
                if outside and item["scope"] == "all":
                    raise CanvasDomainError(
                        "FILE_SHARED",
                        f"File {file.info.name} is referenced by unselected Contents. Remove only Canvas Elements, or explicitly select every affected reference.",
                    )
                files[file.info.id] = {
                    "file_id": file.info.id,
                    "file_name": file.info.name,
                    "path": str(file.path),
                    "identity": file.info.model_dump(),
                    "shared": bool(outside),
                }
                if file.info.id not in item["file_ids"]:
                    item["file_ids"].append(file.info.id)
                item["content_files"][content.content_id] = file.info.id
        removed_ids = {
            element_id
            for item in items
            if item["scope"] == "all" or len(geometry.require(str(item["element_id"])).contents) == 1
            for element_id in item["descendant_ids"]
        }
        connections = [
            connection.connection_id
            for connection in canvas.connections
            if connection.source_element_id in removed_ids or connection.target_element_id in removed_ids
        ]
        for item in items:
            item_ids = set(item["descendant_ids"]) & removed_ids
            item["connection_ids"] = [
                connection.connection_id
                for connection in canvas.connections
                if connection.source_element_id in item_ids or connection.target_element_id in item_ids
            ]
        payload: JsonObject = {
            "project_path": project_path,
            "mode": mode,
            "items": cast(list[JsonObject], items),
            "files": list(files.values()),
            "connection_ids": connections,
        }
        return payload

    async def _remove(self, project_path: str, item: JsonObject, content_ids: list[str]) -> bool:
        removed_elements: list[str] = []

        def change(project: CanvasProject, sidecar: dict) -> tuple[None, dict]:
            element_id = str(item["element_id"])
            element = CanvasSpatialGeometry(project.canvas).assert_mutable(element_id)
            geometry = CanvasSpatialGeometry(project.canvas)
            affected = (
                [element] if item["scope"] == "current" and len(element.contents) > 1 else list(element.iter_elements())
            )
            for child in affected:
                geometry.assert_mutable(child.element_id)
                if child.opaque_children:
                    raise CanvasDomainError(
                        "CANVAS_TARGET_CHANGED",
                        "The target now contains undecoded children; prepare its current scope again.",
                    )
            current = [
                {
                    "element_id": child.element_id,
                    "name": child.properties.name,
                    "active_content_id": child.active_content_id,
                    "main_content_id": child.main_content_id,
                    "contents": [c.to_dict() for c in child.contents],
                }
                for child in affected
            ]
            if current != item["snapshot"]:
                raise CanvasDomainError(
                    "CANVAS_TARGET_CHANGED",
                    "The target or its descendants changed during execution; Canvas removal was not performed.",
                )
            remaining = [content for content in element.contents if content.content_id not in content_ids]
            if remaining and (item["scope"] == "current" or len(content_ids) < len(item["content_ids"])):
                original = element.contents
                active_index = next(
                    i for i, content in enumerate(original) if content.content_id == element.active_content_id
                )
                main_index = next(
                    i for i, content in enumerate(original) if content.content_id == element.main_content_id
                )
                ordered = sorted(
                    remaining,
                    key=lambda content: (
                        abs(original.index(content) - active_index),
                        original.index(content) > active_index,
                    ),
                )
                if element.active_content_id in content_ids:
                    element.active_content_id = ordered[0].content_id
                if element.main_content_id in content_ids:
                    eligible = [
                        content
                        for content in remaining
                        if content.fields.asset_path and content.fields.generation_status == "completed"
                    ]
                    eligible.sort(
                        key=lambda content: (
                            abs(original.index(content) - main_index),
                            original.index(content) > main_index,
                        )
                    )
                    element.main_content_id = eligible[0].content_id if eligible else element.active_content_id
                element.contents = remaining
                ContentMetadataService.remove(sidecar, element_id, content_ids)
            else:
                removed = set(item["descendant_ids"])
                current_connections = [
                    connection.connection_id
                    for connection in project.canvas.connections
                    if connection.source_element_id in removed or connection.target_element_id in removed
                ]
                if project.canvas.opaque_connections or not set(current_connections).issubset(item["connection_ids"]):
                    raise CanvasDomainError(
                        "CANVAS_TARGET_CHANGED",
                        "The target's connections changed during execution; Canvas removal was not performed.",
                    )
                project.canvas.remove_element(element_id)
                removed_elements.extend(str(value) for value in removed)
                for removed_id in removed_elements:
                    ContentMetadataService.remove(sidecar, removed_id)
                project.canvas.connections = [
                    connection
                    for connection in project.canvas.connections
                    if connection.source_element_id not in removed and connection.target_element_id not in removed
                ]
            return None, sidecar

        await self.repository.transaction_with_sidecar(project_path, change)
        try:
            user = await self.repository.read_sidecar(project_path, "element-details-user.json")
            if user:
                if removed_elements:
                    for removed_id in removed_elements:
                        ContentMetadataService.remove(user, removed_id)
                else:
                    ContentMetadataService.remove(user, str(item["element_id"]), content_ids)
                await self.repository.write_sidecar(project_path, user, "element-details-user.json")
        except Exception:
            # 业务元素已经删除；用户详情清理失败必须单独报告，不能谎报元素未删除。
            return False
        return True
