"""创建消息内的文件下载入口，不生成或上传压缩包。"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from pydantic import ConfigDict, Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import (
    DisplayType, FileContent, FileDownloadContent, FileDownloadItem, ToolDetail,
)
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.share.models import ShareServiceError
from app.tools.share.service_common import raise_if_interrupted, required_numeric_metadata
from app.tools.share.workspace import get_workspace_root, resolve_workspace_file
from app.utils.async_file_utils import async_stat


def _positive_limit(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value < 1:
        raise ValueError(f"{name} must be a positive integer")
    return value


MAX_FILES = _positive_limit("CREATE_CLIENT_SIDE_FILE_BUNDLE_MAX_FILES", 200)
MAX_DETAIL_BYTES = _positive_limit("CREATE_CLIENT_SIDE_FILE_BUNDLE_MAX_DETAIL_BYTES", 256 * 1024)


class CreateClientSideFileBundleParams(BaseToolParams):
    """集合名称和准确的工作区文件路径。"""

    model_config = ConfigDict(extra="forbid")
    title: str = Field(..., min_length=1, max_length=160, description="Collection name used as the ZIP filename.")
    file_paths: list[str] = Field(
        ..., min_length=1, max_length=MAX_FILES,
        description="Exact workspace-relative file paths.",
    )

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        title = value.strip()
        if title in {"", ".", "..", ".zip"} or any(char in title for char in "/\\") or any(ord(char) < 32 for char in title):
            raise ValueError("title must be a non-empty filename without path separators or control characters")
        return title


def _failure_message(result: ToolResult) -> str:
    info = result.extra_info or {}
    key = f"file_download.error.{info.get('error_code', 'unknown')}"
    message = i18n.translate(key, category="tool.messages")
    if message == key:
        message = i18n.translate("file_download.failed", category="tool.messages")
    path = info.get("path")
    return f"{message}：{path}" if path else message


# 模型使用说明：agents/skills/file-bundle/SKILL.md。
@tool(name="create_client_side_file_bundle", code_mode_only=True)
class CreateClientSideFileBundle(BaseTool[CreateClientSideFileBundleParams]):
    """Create a client-side file bundle card for existing workspace files."""

    name = "create_client_side_file_bundle"

    async def execute(self, tool_context: ToolContext, params: CreateClientSideFileBundleParams) -> ToolResult:
        try:
            project_id = required_numeric_metadata(tool_context, "project_id", "missing_project_context")
            root = get_workspace_root(tool_context)
            items: list[FileDownloadItem] = []
            seen: set[str] = set()
            for path in params.file_paths:
                await raise_if_interrupted(tool_context)
                if Path(path).is_absolute():
                    return ToolResult.error("Download paths must be workspace-relative.", extra_info={"error_code": "path_outside_workspace", "path": path})
                resolved = await resolve_workspace_file(root, path, expected_project_id=project_id)
                if resolved.file_id in seen:
                    continue
                stat = await async_stat(resolved.absolute_path)
                items.append(FileDownloadItem(
                    file_id=resolved.file_id,
                    relative_file_path=resolved.relative_path,
                    file_name=resolved.absolute_path.name,
                    file_size=stat.st_size,
                ))
                seen.add(resolved.file_id)

            # 成员固定在真实 file_id 上；旧路径后来被新文件占用时不能自动替换。
            detail = FileDownloadContent(
                title=params.title,
                archive_name=params.title if params.title.lower().endswith(".zip") else f"{params.title}.zip",
                project_id=project_id,
                total_bytes=sum(item.file_size for item in items),
                items=items,
            )
            if len(detail.model_dump_json().encode("utf-8")) > MAX_DETAIL_BYTES:
                return ToolResult.error("The download collection is too large for one message. Prepare smaller, explicit collections; no files were omitted.")
            await raise_if_interrupted(tool_context)
            return ToolResult(
                content=(
                    f"Created a download card for {len(items)} unique workspace files. "
                    "No archive was created or uploaded. The user can click the card to download the listed source files. "
                    "Membership is fixed by file ID; accessible file contents are resolved at download time. "
                    "Do not claim that the user has downloaded or saved the archive."
                ),
                data=detail.model_dump(),
            )
        except asyncio.CancelledError:
            raise
        except ShareServiceError as error:
            return ToolResult.error(error.info.message, extra_info={"error_code": error.info.code, "path": error.info.path or ""})
        except (OSError, ValueError) as error:
            return ToolResult.error(f"Could not prepare the file collection: {error}")

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        if not result.ok:
            return ToolDetail(type=DisplayType.TEXT, data=FileContent(
                file_name="", content=_failure_message(result),
            ))
        return ToolDetail(type=DisplayType.FILE_DOWNLOAD, data=FileDownloadContent.model_validate(result.data))

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {
            "action": i18n.translate(self.name, category="tool.actions"),
            "remark": str((arguments or {}).get("title") or ""),
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {
            "action": i18n.translate(self.name, category="tool.actions"),
            "remark": str((arguments or {}).get("title") or "") if result.ok else _failure_message(result),
        }
