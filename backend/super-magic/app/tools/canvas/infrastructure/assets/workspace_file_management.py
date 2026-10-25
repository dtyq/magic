"""画布管理使用实际挂载文件身份，不把历史生成名称当当前文件名。"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Awaitable, TypeVar

from pydantic import BaseModel, ConfigDict

from app.core.context.agent_context import AgentContext
from app.infrastructure.magic_service import MagicServiceClient
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.infrastructure.assets.project_asset_path_resolver import ProjectAssetPathResolver
from app.tools.share.workspace import resolve_workspace_file
from app.utils.async_file_utils import async_exists, get_file_id_from_xattr

T = TypeVar("T")


class WorkspaceFileInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    parent_id: str
    is_directory: bool
    version: int
    latest_version: int


@dataclass(frozen=True)
class ManagedCanvasFile:
    path: Path
    info: WorkspaceFileInfo


class WorkspaceFileManagement:
    def __init__(self, workspace: Path, project_path: str, agent_context: AgentContext):
        self.paths = ProjectAssetPathResolver(workspace)
        self.workspace = self.paths.workspace
        self.project_path = project_path
        self.project_root = self.paths.resolve_project_root(project_path)
        self.agent_context = agent_context
        self.client = MagicServiceClient()

    async def wait(self, work: Awaitable[T]) -> T:
        task = asyncio.ensure_future(work)
        interrupted = asyncio.create_task(self.agent_context.get_interruption_event().wait())
        try:
            if self.agent_context.get_interruption_event().is_set():
                raise asyncio.CancelledError
            done, _ = await asyncio.wait([task, interrupted], return_when=asyncio.FIRST_COMPLETED)
            # 已完成的副作用需要先交给调用方记账；后续等待仍会立即响应中断。
            if task in done:
                return await task
            raise asyncio.CancelledError
        finally:
            for pending in (task, interrupted):
                if not pending.done():
                    pending.cancel()
            await asyncio.gather(task, interrupted, return_exceptions=True)

    async def resolve(self, asset_path: str) -> ManagedCanvasFile:
        if "://" in asset_path or asset_path.startswith("data:"):
            raise CanvasDomainError(
                "FILE_REFERENCE_UNSUPPORTED",
                "This resource is not a resolved Workspace file. Import it into this project before managing its file.",
            )
        reference = self.paths.to_workspace_reference_path(self.project_path, asset_path)
        resolved = await resolve_workspace_file(self.workspace, reference)
        if not resolved.absolute_path.is_relative_to(self.project_root):
            raise CanvasDomainError(
                "FILE_OUTSIDE_PROJECT", "Only actual image files inside this Canvas project can be managed."
            )
        info = await self.info(resolved.file_id)
        parent_id = await get_file_id_from_xattr(resolved.absolute_path.parent)
        if (
            info.id != resolved.file_id
            or info.name != resolved.absolute_path.name
            or info.is_directory
            or info.parent_id != parent_id
        ):
            raise CanvasDomainError(
                "FILE_IDENTITY_CHANGED",
                "The current file name or parent does not match its Workspace identity. Query the current state again.",
            )
        return ManagedCanvasFile(resolved.absolute_path, info)

    async def info(self, file_id: str) -> WorkspaceFileInfo:
        return WorkspaceFileInfo.model_validate(await self.wait(self.client.query_workspace_file(file_id)))

    async def check_canvas_write_access(self) -> None:
        file_id = await get_file_id_from_xattr(self.project_root / "magic.project.js")
        if not file_id:
            raise CanvasDomainError(
                "FILE_IDENTITY_MISSING", "Canvas is not synchronized with Workspace; file management is unavailable."
            )
        await self.wait(self.client.check_workspace_file_write_access(file_id))

    async def rename(self, source: ManagedCanvasFile, target_name: str) -> ManagedCanvasFile:
        target = source.path.with_name(target_name)
        current = await self.info(source.info.id)
        if current != source.info:
            raise CanvasDomainError(
                "FILE_IDENTITY_CHANGED", "File metadata changed after preparation. Prepare the operation again."
            )
        if target_name == current.name:
            return source
        if await async_exists(target):
            raise CanvasDomainError(
                "FILE_NAME_CONFLICT", f"A file named {target_name} already exists in the same directory."
            )
        failure: Exception | None = None
        try:
            await self.wait(self.client.rename_workspace_file_checked(current.id, target_name))
        except Exception as error:
            failure = error
        # 请求失败不等于业务失败；用同一 file_id 复查，绝不自动重发 rename。
        after = await self.info(current.id)
        if after.parent_id != current.parent_id or after.name != target_name:
            if failure:
                raise failure
            raise CanvasDomainError(
                "FILE_RENAME_UNKNOWN",
                "The rename response did not produce the expected file identity. Do not repeat the write automatically.",
            )
        return ManagedCanvasFile(target, after)
