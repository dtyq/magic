"""命名前解析实际版本、文件身份与冲突；不执行文件写入。"""

from __future__ import annotations

import mimetypes
from pathlib import Path

from app.tools.canvas.application.commands.rename_commands import BatchNaming, RenameElement, VersionFileName
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.services.spatial_geometry import CanvasSpatialGeometry
from app.tools.canvas.domain.types import JsonObject
from app.tools.canvas.infrastructure.assets.workspace_file_management import ManagedCanvasFile, WorkspaceFileManagement
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.utils.async_file_utils import async_exists


class RenamePreparation:
    def __init__(self, repository: CanvasRepositoryInterface, gateway: WorkspaceFileManagement | None = None):
        self.repository, self.gateway = repository, gateway

    async def prepare(
        self, project_path: str, items: list[RenameElement], gateway: WorkspaceFileManagement
    ) -> JsonObject:
        project = await self.repository.read(project_path)
        geometry = CanvasSpatialGeometry(project.canvas)
        if project.canvas.opaque_elements or any(e.opaque_children for e in project.canvas.iter_elements()):
            raise CanvasDomainError(
                "REFERENCES_UNAVAILABLE", "Some Elements cannot be decoded; file references cannot be checked safely."
            )
        files: dict[str, JsonObject] = {}
        skipped: list[JsonObject] = []
        for item in items:
            element = geometry.assert_mutable(item.element_id)
            if element.element_type != "image" and (item.files or item.all_versions_base_name):
                raise CanvasDomainError("IMAGE_REQUIRED", "File rename currently supports image Elements only.")
            versions = list(item.files)
            resolved_versions: dict[str, ManagedCanvasFile] = {}
            if item.all_versions_base_name:
                for index, content in enumerate(element.contents, 1):
                    if not content.fields.asset_path or content.fields.generation_status in {"pending", "processing"}:
                        skipped.append(
                            {
                                "element_id": item.element_id,
                                "content_id": content.content_id,
                                "status": "not_applied",
                                "error_code": "FILE_NOT_READY",
                            }
                        )
                    else:
                        source = await gateway.resolve(content.fields.asset_path)
                        resolved_versions[content.content_id] = source
                        versions.append(
                            VersionFileName(
                                content_id=content.content_id,
                                file_id=source.info.id,
                                expected_file_name=source.info.name,
                                file_name=f"{item.all_versions_base_name}_v{index}",
                            )
                        )
            for version in versions:
                content = element.get_content(version.content_id)
                if (
                    content is None
                    or not content.fields.asset_path
                    or content.fields.generation_status in {"pending", "processing"}
                ):
                    raise CanvasDomainError(
                        "FILE_NOT_READY",
                        "This version has no completed Workspace image file. Its shared Canvas title can still be renamed.",
                    )
                source = resolved_versions.get(content.content_id) or await gateway.resolve(content.fields.asset_path)
                if source.info.id != version.file_id or source.info.name != version.expected_file_name:
                    raise CanvasDomainError(
                        "FILE_IDENTITY_CHANGED", "The queried version file was renamed or replaced. Query it again."
                    )
                target = self._file_name(version.file_name, source.path.suffix)
                entry: JsonObject = {
                    "element_id": item.element_id,
                    "content_id": content.content_id,
                    "name": element.properties.name,
                    "file_id": source.info.id,
                    "file_name": source.info.name,
                    "target_file_name": target,
                    "path": str(source.path),
                    "identity": source.info.model_dump(),
                    "element_ids": [item.element_id],
                }
                if source.info.id in files and files[source.info.id]["target_file_name"] != target:
                    raise CanvasDomainError(
                        "SHARED_FILE_CONFLICT", "Two requested versions share one file but request different names."
                    )
                if source.info.id in files:
                    entry["element_ids"] = list(dict.fromkeys([*files[source.info.id]["element_ids"], item.element_id]))
                if target != source.path.name and await async_exists(source.path.with_name(target)):
                    raise CanvasDomainError(
                        "FILE_NAME_CONFLICT", f"A file named {target} already exists in the same directory."
                    )
                files[source.info.id] = entry
        destinations = [(str(Path(file["path"]).parent), file["target_file_name"]) for file in files.values()]
        if len(destinations) != len(set(destinations)):
            raise CanvasDomainError("FILE_NAME_CONFLICT", "Multiple files request the same name in the same directory.")
        payload: JsonObject = {
            "project_path": project_path,
            "items": [item.model_dump() for item in items],
            "files": list(files.values()),
            "skipped": skipped,
            "single_version_ids": [
                item.element_id for item in items if len(geometry.require(item.element_id).contents) == 1
            ],
        }
        return payload

    async def batch_items(
        self, project_path: str, items: list[RenameElement], naming: BatchNaming
    ) -> list[RenameElement]:
        project = await self.repository.read(project_path)
        geometry = CanvasSpatialGeometry(project.canvas)
        gateway = self.gateway
        expanded: list[RenameElement] = []
        for index, item in enumerate(items, naming.start_number):
            if item.canvas_title is not None or item.files or item.all_versions_base_name:
                raise CanvasDomainError(
                    "INVALID_NAME", "Do not mix batch_naming with explicit names for the same selection."
                )
            element = geometry.assert_mutable(item.element_id)
            name = f"{naming.base_name}_{index:0{naming.digits}d}"
            values = item.model_dump()
            if naming.target in {"title", "both"}:
                values["canvas_title"] = name
            if naming.target in {"file", "both"}:
                if item.file_scope is None and len(element.contents) > 1:
                    raise CanvasDomainError(
                        "VERSION_SCOPE_REQUIRED",
                        "Batch file naming requires explicit current or all scope for multiple versions.",
                    )
                if item.file_scope == "all":
                    values["all_versions_base_name"] = name
                else:
                    content = element.get_content(element.active_content_id)
                    if (
                        gateway is None
                        or content is None
                        or not content.fields.asset_path
                        or content.fields.generation_status in {"pending", "processing"}
                    ):
                        raise CanvasDomainError(
                            "FILE_NOT_READY", "The current version has no manageable Workspace image file."
                        )
                    source = await gateway.resolve(content.fields.asset_path)
                    values["files"] = [
                        VersionFileName(
                            content_id=content.content_id,
                            file_id=source.info.id,
                            expected_file_name=source.info.name,
                            file_name=name,
                        ).model_dump()
                    ]
            expanded.append(RenameElement.model_validate(values))
        return expanded

    @staticmethod
    def _file_name(value: str, extension: str) -> str:
        name = value.strip()
        if not name or name in {".", ".."} or any(c in name for c in "/\\\x00") or any(ord(c) < 32 for c in name):
            raise CanvasDomainError(
                "INVALID_FILE_NAME", "Supply a valid filename, without a path or control characters."
            )
        if extension and name.lower().endswith(extension.lower()):
            return name[: -len(extension)] + extension
        media_type, _ = mimetypes.guess_type(name)
        if extension and media_type and media_type.startswith("image/"):
            raise CanvasDomainError(
                "INVALID_FILE_NAME",
                f"Renaming cannot convert image formats. Use a basename or retain the original {extension} extension.",
            )
        return name + extension
