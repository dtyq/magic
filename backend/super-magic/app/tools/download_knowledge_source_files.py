"""下载知识库检索结果对应的源文件到工作区。"""

import json
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import unquote

from pydantic import BaseModel, Field, validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.api.http_dto.knowledge_source_file_download_dto import KnowledgeSourceFileDownloadItem
from app.core.context.agent_context import AgentContext
from app.i18n import i18n
from app.service.knowledge_source_file_download_service import KnowledgeSourceFileDownloadService
from app.service.knowledge_source_file_reference_resolver import (
    KnowledgeSourceFileReferenceError,
    resolve_knowledge_source_file_reference,
)
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class DownloadKnowledgeSourceFileItem(BaseModel):
    file_key: str = Field(
        ...,
        description=(
            "<!--zh: 知识库检索结果中返回的原始文件 file_key。 -->"
            "Original file_key returned by knowledge search results."
        ),
    )
    file_path: str | None = Field(
        None,
        description=(
            "<!--zh: 可选的工作区相对保存路径，包含文件名；不填时会使用 target_dir 和 file_key 末尾文件名。 -->"
            "Optional workspace-relative save path including file name. If omitted, the tool uses "
            "target_dir plus the file name inferred from file_key."
        ),
    )

    @validator("file_key")
    def validate_file_key(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("file_key cannot be empty")
        return trimmed

    @validator("file_path")
    def validate_file_path(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            return None
        return trimmed


class DownloadKnowledgeSourceFilesParams(BaseToolParams):
    files: list[DownloadKnowledgeSourceFileItem] = Field(
        ...,
        min_items=1,
        max_items=50,
        description=(
            "<!--zh: 要下载的知识库源文件列表。每项只需要使用 search_knowledge 返回的 file_key。 -->"
            "Knowledge source files to download. Each item only needs the file_key returned by "
            "search_knowledge."
        ),
    )
    target_dir: str = Field(
        "knowledge_files",
        description=(
            "<!--zh: 默认保存目录；仅当某个文件未指定 file_path 时使用。 -->"
            "Default save directory used only when an item does not provide file_path."
        ),
    )

    @validator("target_dir")
    def validate_target_dir(cls, value: str) -> str:
        trimmed = value.strip().strip("/")
        return trimmed or "knowledge_files"


@tool(name="download_knowledge_source_files")
class DownloadKnowledgeSourceFiles(BaseTool[DownloadKnowledgeSourceFilesParams]):
    """<!--zh
    根据知识库检索结果里的 file_key 下载源文件到当前工作区。
    当用户要求把检索到的知识库原始资料、附件或源文件放入项目文件时使用它。
    -->
    Download source files from knowledge-base search results into the current workspace. Use this
    after search_knowledge with the returned file_key when the user asks to save retrieved knowledge
    materials, attachments, or source files into the project workspace.
    """

    name = "download_knowledge_source_files"

    def get_prompt_hint(self) -> str:
        return """<!--zh
当用户要求“下载检索到的知识库内容/原始文件/附件/资料到项目里”时，先调用 search_knowledge 获取结果，再从结果里的 file_key 选择要下载的源文件，并调用 download_knowledge_source_files。

规则：
- 只使用 search_knowledge 返回的 file_key，不要猜测或编造 file_key
- 下载工具只需要传 file_key；knowledge_code 和 document_code 会由工具从最近一次 search_knowledge 结果中确认
- 如果用户指定目录或文件名，放到 file_path 或 target_dir 中
- 下载完成后告诉用户保存的工作区相对路径
-->
When the user asks to download retrieved knowledge-base content, original files, attachments, or
materials into the project, call search_knowledge first, then pass the returned file_key values to
download_knowledge_source_files.

Rules:
- Use only file_key values returned by search_knowledge. Do not invent file keys.
- The download tool only needs file_key. It resolves knowledge_code and document_code from the latest
  search_knowledge result.
- Respect the user's requested folder or file name through file_path or target_dir.
- After downloading, tell the user the workspace-relative saved paths.
"""

    def is_visible_in_ui(self) -> bool:
        return False

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: dict | None = None,
    ) -> dict:
        count = len((arguments or {}).get("files") or [])
        return {
            "tool_name": tool_name,
            "action": i18n.translate("download_knowledge_source_files", category="tool.actions"),
            "remark": i18n.translate(
                "download_knowledge_source_files.downloading",
                category="tool.messages",
                count=count,
            ),
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict | None = None,
    ) -> dict:
        result.use_custom_remark = True
        action = i18n.translate("download_knowledge_source_files", category="tool.actions")
        if not result.ok:
            return {
                "tool_name": tool_name,
                "action": action,
                "remark": i18n.translate(
                    "download_knowledge_source_files.error",
                    category="tool.messages",
                    error=result.content,
                ),
            }
        success_count = 0
        failed_count = 0
        if result.extra_info:
            success_count = int(result.extra_info.get("success_count") or 0)
            failed_count = int(result.extra_info.get("failed_count") or 0)
        if success_count > 0 and failed_count == 0:
            remark = i18n.translate(
                "download_knowledge_source_files.success_count",
                category="tool.messages",
                count=success_count,
            )
        elif success_count > 0:
            remark = i18n.translate(
                "download_knowledge_source_files.partial_success",
                category="tool.messages",
                success=success_count,
                failed=failed_count,
            )
        else:
            remark = i18n.translate(
                "download_knowledge_source_files.failed_count",
                category="tool.messages",
                count=failed_count,
            )
        return {
            "tool_name": tool_name,
            "action": action,
            "remark": remark,
        }

    async def execute(self, tool_context: ToolContext, params: DownloadKnowledgeSourceFilesParams) -> ToolResult:
        agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
        if agent_context is None:
            return ToolResult.error("Knowledge source file download is not supported in the current mode.")

        try:
            download_items = []
            used_locations: set[str] = set()
            for index, item in enumerate(params.files, start=1):
                reference = resolve_knowledge_source_file_reference(agent_context, item.file_key)
                location = self._resolve_location(item, params.target_dir, index, used_locations)
                download_items.append(KnowledgeSourceFileDownloadItem(
                    file_key=item.file_key,
                    location=location,
                    knowledge_code=reference.knowledge_code,
                    document_code=reference.document_code,
                ))
        except (ValueError, KnowledgeSourceFileReferenceError) as exc:
            return ToolResult.error(str(exc))

        try:
            response = await KnowledgeSourceFileDownloadService(agent_context).download_source_files_batch(download_items)
        except Exception as exc:
            logger.error(f"Download knowledge source files failed: {exc}")
            return ToolResult.error(f"Download knowledge source files failed: {exc}")

        content = self._build_result_content(response.results)
        summary = {
            "total": response.total_count,
            "success": response.success_count,
            "failed": response.failed_count,
        }
        return ToolResult(
            content=json.dumps(
                {
                    "message": f"下载完成：{response.success_count}个成功，{response.failed_count}个失败",
                    "summary": summary,
                    "results": content,
                },
                ensure_ascii=False,
                indent=2,
            ),
            extra_info={
                "total_count": response.total_count,
                "success_count": response.success_count,
                "failed_count": response.failed_count,
                "results": content,
            },
        )

    def _resolve_location(
        self,
        item: DownloadKnowledgeSourceFileItem,
        target_dir: str,
        index: int,
        used_locations: set[str],
    ) -> str:
        if item.file_path:
            location = self._normalize_workspace_location(item.file_path)
            if location in used_locations:
                raise ValueError(f"多个下载项指定了相同的 file_path: {location}")
            used_locations.add(location)
            return location

        filename = self._filename_from_source_file_key(item.file_key, index)
        location = self._normalize_workspace_location(f"{target_dir}/{filename}")
        location = self._deduplicate_generated_location(location, used_locations)
        used_locations.add(location)
        return location

    @staticmethod
    def _filename_from_source_file_key(file_key: str, index: int) -> str:
        name = unquote(PurePosixPath(file_key).name.strip())
        if name in {"", ".", "/"}:
            return f"knowledge_file_{index}"
        return name

    @staticmethod
    def _normalize_workspace_location(location: str) -> str:
        normalized = location.replace("\\", "/").strip().lstrip("/")
        parts = [part for part in PurePosixPath(normalized).parts if part not in {"", "."}]
        return "/".join(parts)

    @classmethod
    def _deduplicate_generated_location(cls, location: str, used_locations: set[str]) -> str:
        if location not in used_locations:
            return location

        path = PurePosixPath(location)
        parent = "" if str(path.parent) == "." else str(path.parent)
        stem = path.stem or path.name
        suffix = path.suffix
        counter = 2
        while True:
            candidate_name = f"{stem} ({counter}){suffix}"
            candidate = f"{parent}/{candidate_name}" if parent else candidate_name
            candidate = cls._normalize_workspace_location(candidate)
            if candidate not in used_locations:
                return candidate
            counter += 1

    @staticmethod
    def _build_result_content(results: list[Any]) -> list[dict[str, Any]]:
        content: list[dict[str, Any]] = []
        for item in results:
            success = bool(getattr(item, "success", False))
            entry: dict[str, Any] = {
                "file_key": getattr(item, "file_key", ""),
                "file_path": getattr(item, "location", ""),
                "status": "success" if success else "failed",
            }
            file_size = getattr(item, "file_size", None)
            if file_size is not None:
                entry["file_size_bytes"] = file_size
            workspace_file_key = getattr(item, "workspace_file_key", None)
            if workspace_file_key:
                entry["workspace_file_key"] = workspace_file_key
            project_file_id = getattr(item, "project_file_id", None)
            if project_file_id:
                entry["project_file_id"] = project_file_id
            registered_relative_path = getattr(item, "registered_relative_path", None)
            if registered_relative_path:
                entry["registered_relative_path"] = registered_relative_path
            error_message = getattr(item, "error_message", None)
            if error_message:
                entry["error"] = error_message
            content.append(entry)
        return content
