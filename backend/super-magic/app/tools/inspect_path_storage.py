"""路径存储层检测；使用说明维护在 agents/skills/vibe-coding/SKILL.md。"""

from __future__ import annotations

import html
from dataclasses import asdict
from pathlib import Path
from typing import cast

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.path_manager import PathManager, RuntimeEnvironment
from app.tools.core import BaseTool, BaseToolParams, tool
from app.utils.path_storage import PathStorageInfo, PathStorageLayer, inspect_path_storage

# 每层对模型的说明：只写对放置决策有用的事实（速度、配额、持久、可见、重建后怎样）
_SANDBOX_LAYER_DESCRIPTIONS: dict[PathStorageLayer, str] = {
    PathStorageLayer.NETWORK: (
        "network storage. Persisted and visible to the user. Each new small file takes about 2 seconds to write, "
        "and the user's plan caps file count per project and total storage size; keep file count low."
    ),
    PathStorageLayer.LOCAL_DEPENDENCY: (
        "local dependency directory. Its files live on this sandbox's local disk, so many small files are fast. "
        "They are not persisted or shown to the user and are emptied when the sandbox is rebuilt; "
        "reinstall them with the package manager."
    ),
    PathStorageLayer.PLATFORM_INTERNAL: (
        "platform-managed internal storage, used by the platform itself such as chat history. "
        "Do not put project files or dependencies here."
    ),
    PathStorageLayer.CONTAINER_LOCAL: (
        "container-local disk: fast, not visible to the user, wiped when the sandbox is rebuilt."
    ),
}
_LOCAL_MACHINE_DESCRIPTION = "ordinary local disk on this machine."


class InspectPathStorageParams(BaseToolParams):
    paths: list[str] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Paths to check. Relative paths are resolved against .workspace; paths that do not exist yet are judged by their nearest existing parent.",
    )


"""
Code Mode 使用说明：agents/skills/vibe-coding/SKILL.md 的 Check storage 一节。
| 运行环境 | content |
| 云端沙盒 | 每个路径一行：所在层级、是否持久、用户是否可见、碎文件快不快、重建后怎样 |
| 本地机器 | 首行说明沙盒分层不适用，每个路径都描述为本机普通磁盘；分层判断照常执行，data 保留真实结果 |
例：检查 3 个路径，其中 1 个因系统错误无法检查 -> ok=False，content 仍给出另外 2 个的结论和失败原因。
"""
@tool(name="inspect_path_storage", code_mode_only=True)
class InspectPathStorage(BaseTool[InspectPathStorageParams]):
    """Check which storage layer each path is on and what that means for writing files there."""

    async def execute(self, tool_context: ToolContext, params: InspectPathStorageParams) -> ToolResult:
        runtime_environment = PathManager.get_runtime_environment()
        items: list[PathStorageInfo] = []
        failures: list[dict[str, str]] = []
        lines: list[str] = []
        if runtime_environment == RuntimeEnvironment.LOCAL:
            lines.append("Runtime is a local machine, so sandbox storage layers do not apply.")

        for raw_path in dict.fromkeys(params.paths):
            try:
                info = await inspect_path_storage(Path(raw_path))
            except OSError as error:
                failures.append({"path": raw_path, "error": str(error)})
                lines.append(f"{raw_path}: could not be inspected. Error: {error}.")
                continue
            items.append(info)
            lines.append(self._describe(info, runtime_environment))

        return ToolResult(
            ok=not failures,
            content="\n".join(lines),
            data={
                "runtime_environment": runtime_environment.value,
                "items": [asdict(item) for item in items],
                "failures": failures,
            },
        )

    @staticmethod
    def _describe(info: PathStorageInfo, runtime_environment: RuntimeEnvironment) -> str:
        description = (
            _LOCAL_MACHINE_DESCRIPTION
            if runtime_environment == RuntimeEnvironment.LOCAL
            else _SANDBOX_LAYER_DESCRIPTIONS[info.layer]
        )
        if info.exists:
            return f"{info.path}: {description}"
        return f"{info.path}: does not exist yet. Its nearest existing parent {info.checked_path} is {description}"

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        raw_paths = (arguments or {}).get("paths")
        count = len(raw_paths) if isinstance(raw_paths, list) else 0
        return {"tool_name": tool_name, "action": i18n.translate("inspect_path_storage", category="tool.actions"),
                "remark": i18n.translate("inspect_path_storage.remark", category="tool.messages", count=count)}

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        raw_paths = (arguments or {}).get("paths")
        count = len(raw_paths) if isinstance(raw_paths, list) else 0
        key = "inspect_path_storage.remark" if result.ok else "inspect_path_storage.failed"
        return {"tool_name": tool_name, "action": i18n.translate("inspect_path_storage", category="tool.actions"),
                "remark": i18n.translate(key, category="tool.messages", count=count)}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        """用户详情只给路径和友好的存储位置；系统错误原文留在给模型的 content 中。"""
        data = result.data or {}
        is_local = data.get("runtime_environment") == RuntimeEnvironment.LOCAL.value
        lines: list[str] = []
        if is_local:
            lines.extend([i18n.translate("inspect_path_storage.local_runtime", category="tool.messages"), ""])

        items = cast(list[dict[str, object]], data.get("items", []))
        failures = cast(list[dict[str, str]], data.get("failures", []))
        if items or failures:
            lines.extend([
                f"| {i18n.translate('inspect_path_storage.detail.path', category='tool.messages')} "
                f"| {i18n.translate('inspect_path_storage.detail.storage', category='tool.messages')} |",
                "| --- | --- |",
            ])
        for item in items:
            layer_key = "local_machine" if is_local else str(item["layer"])
            storage = i18n.translate(f"inspect_path_storage.layer.{layer_key}", category="tool.messages")
            if not item["exists"]:
                storage = i18n.translate("inspect_path_storage.not_exists", category="tool.messages", storage=storage)
            lines.append(f"| <code>{html.escape(str(item['path']))}</code> | {storage} |")
        for failure in failures:
            lines.append(
                f"| <code>{html.escape(failure['path'])}</code> "
                f"| {i18n.translate('inspect_path_storage.inspect_failed', category='tool.messages')} |"
            )
        if not lines:
            lines.append(i18n.translate("inspect_path_storage.unavailable", category="tool.messages"))
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="inspect_path_storage.md", content="\n".join(lines)))
