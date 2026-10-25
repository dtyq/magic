"""记忆文件只读计数；使用说明维护在 agents/skills/memory/SKILL.md。"""

from __future__ import annotations

import asyncio
import html
import os
from dataclasses import dataclass
from pathlib import Path
from typing import TypedDict, cast

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.context.agent_context import AgentContext
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.service.memory.policies.memory_file_budget import (
    MemoryFileReadStatus,
    MemoryFileTokenUsage,
    MemoryMdBudget,
    get_memory_md_budget,
    inspect_memory_file,
)
from app.service.memory.policies.memory_scope import MemoryScope, resolve_memory_scopes
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive
from app.utils.async_file_utils import async_realpath


class MemoryUsageData(TypedDict):
    path: str
    status: str
    estimated_tokens: int | None
    size_bytes: int | None


@dataclass(frozen=True, slots=True)
class MemoryInspection:
    usage: MemoryFileTokenUsage
    is_memory_md: bool = False


class InspectMemoryParams(BaseToolParams):
    file_paths: list[str] = Field(..., min_length=1, description="Absolute paths to memory files to measure.")


"""
Code Mode 使用说明：agents/skills/memory/SKILL.md 的 Optional measurement。
MOCK DEMO：显式传入两个绝对文件路径 -> 逐项测量 -> 返回成功数量、每项状态和计数；
一项失败表示部分完成，不能因另一个文件可读就把整批 ok 设为 True。
这里只计数，不返回正文、不登记 Horizon 已读、不自动展开目录，更不执行记忆整理。
用户展示走 i18n 和 ToolDetail；模型 content 保留逐项状态，不能只依赖 data 解释失败。
"""
@tool(name="inspect_memory", code_mode_only=True)
class InspectMemory(BaseTool[InspectMemoryParams]):
    """Measure memory file sizes and estimated token counts without returning their contents."""

    async def execute(self, tool_context: ToolContext, params: InspectMemoryParams) -> ToolResult:
        context = tool_context.get_extension_typed("agent_context", AgentContext)
        if context is None:
            return ToolResult.error("Memory measurement is unavailable: the current agent context is missing.")
        keepalive = start_tool_keep_alive(tool_context)
        usages: list[MemoryFileTokenUsage] = []
        descriptions: list[str] = []
        budget = get_memory_md_budget()
        # 仅规范化路径和去重；不从目录展开目标，也不将计数登记为 Horizon 已读正文。
        paths = dict.fromkeys(os.path.normpath(value) for value in params.file_paths)
        try:
            for value in paths:
                if context.is_interruption_requested():
                    raise asyncio.CancelledError()
                inspection = await self._inspect_path(context, Path(value))
                usages.append(inspection.usage)
                descriptions.append(self._describe_usage(inspection, budget))
        finally:
            stop_tool_keep_alive(keepalive)
            if keepalive is not None:
                await asyncio.gather(keepalive, return_exceptions=True)
        succeeded = sum(usage.status == MemoryFileReadStatus.OK for usage in usages)
        files: list[MemoryUsageData] = [
            {"path": str(usage.path), "status": usage.status.value,
             "estimated_tokens": usage.estimated_tokens, "size_bytes": usage.size_bytes}
            for usage in usages
        ]
        """
        例：global/MEMORY.md 测得 12,000 tokens、48,000 bytes，项目主文件不存在，
        预算为 10,000/16,000 时，ok=False，content 仍完整交代已完成的一项：
        Measured 1 of 2 requested memory files. Token counts use the project estimate, not an exact model tokenizer. File contents were not returned or recorded as read.
        - /home/user/.magic/memory/global/MEMORY.md: 12,000 estimated tokens; 48,000 bytes. MEMORY.md: target 10,000, maximum 16,000 tokens.
        - /home/user/.magic/memory/projects/p_demo/MEMORY.md: file does not exist.
        对应 data["files"] 保留两项：前者 status="ok" 和实际计数；后者 status="missing"、
        estimated_tokens=None、size_bytes=None。调用方可继续使用成功项，不把缺失项当成空文件。
        """
        return ToolResult(
            ok=succeeded == len(usages),
            content=(
                f"Measured {succeeded} of {len(usages)} requested memory files. "
                "Token counts use the project estimate, not an exact model tokenizer. "
                "File contents were not returned or recorded as read.\n" + "\n".join(descriptions)
            ),
            data={"files": files},
        )

    @staticmethod
    async def _resolve_scope(context: AgentContext, path: Path) -> MemoryScope | None:
        """
        路径文字在允许目录内还不够，链接的真实目标也要属于同一作用域。
        例：项目 notes/a.md 是指向项目外文件的链接，不能借这个入口测量项目外内容。
        """
        if not path.is_absolute() or "\x00" in str(path):
            return None
        real_path = await async_realpath(path)
        for scope in resolve_memory_scopes(context):
            if path.is_relative_to(scope.root):
                real_root = await async_realpath(scope.root)
                if real_path.is_relative_to(real_root):
                    return scope if scope in resolve_memory_scopes(context) else None
        return None

    async def _inspect_path(self, context: AgentContext, path: Path) -> MemoryInspection:
        if not path.is_absolute() or "\x00" in str(path):
            return MemoryInspection(MemoryFileTokenUsage(path, MemoryFileReadStatus.INVALID_PATH, None))
        try:
            scope = await self._resolve_scope(context, path)
            if scope is None:
                return MemoryInspection(MemoryFileTokenUsage(path, MemoryFileReadStatus.OUTSIDE_SCOPE, None))
            real_path = await async_realpath(path)
            usage = await inspect_memory_file(real_path, context.get_interruption_event())
            # 返回前确认仍是当前项目中的同一文件；自动开关不影响这项手动查询。
            if await self._resolve_scope(context, path) != scope or await async_realpath(path) != real_path:
                return MemoryInspection(MemoryFileTokenUsage(path, MemoryFileReadStatus.OUTSIDE_SCOPE, None))
            # 三类作用域都只对根下的 MEMORY.md 使用预算，普通笔记不套这份额度。
            is_memory_md = real_path == await async_realpath(scope.memory_file)
            return MemoryInspection(MemoryFileTokenUsage(
                path, usage.status, usage.estimated_tokens, usage.error, usage.size_bytes,
            ), is_memory_md)
        except (OSError, RuntimeError) as error:
            return MemoryInspection(MemoryFileTokenUsage(path, MemoryFileReadStatus.UNREADABLE, None, str(error)))

    @staticmethod
    def _describe_usage(inspection: MemoryInspection, budget: MemoryMdBudget | None) -> str:
        usage = inspection.usage
        if usage.status != MemoryFileReadStatus.OK:
            reasons = {
                MemoryFileReadStatus.MISSING: "file does not exist",
                MemoryFileReadStatus.NOT_FILE: "path is not a regular file",
                MemoryFileReadStatus.UNREADABLE: "file could not be read",
                MemoryFileReadStatus.INVALID_UTF8: "file is not valid UTF-8 text",
                MemoryFileReadStatus.UNSTABLE: "file changed during measurement; count unavailable",
                MemoryFileReadStatus.INVALID_PATH: "a valid absolute file path is required",
                MemoryFileReadStatus.OUTSIDE_SCOPE: "path is outside the current permitted memory scope, or its scope changed",
            }
            return f"- {usage.path}: {reasons[usage.status]}." + (f" Error: {usage.error}." if usage.error else "")
        identity = "Memory note; no MEMORY.md budget applies."
        if inspection.is_memory_md:
            identity = (
                f"MEMORY.md: target {budget.target_tokens:,}, maximum {budget.max_tokens:,} tokens."
                if budget is not None else "MEMORY.md; configured budget unavailable."
            )
        return f"- {usage.path}: {usage.estimated_tokens:,} estimated tokens; {usage.size_bytes:,} bytes. {identity}"

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {"tool_name": tool_name, "action": i18n.translate("inspect_memory", category="tool.actions"),
                "remark": i18n.translate("inspect_memory.before", category="tool.messages")}

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        key = "inspect_memory.success" if result.ok else "inspect_memory.failed"
        return {"tool_name": tool_name, "action": i18n.translate("inspect_memory", category="tool.actions"),
                "remark": i18n.translate(key, category="tool.messages")}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        """
        用户详情只呈现文件名、数量和友好状态；完整路径与技术错误留在给模型的 content 中。
        即使整批失败也返回详情，使用户知道是未找到文件、不可读取还是没有可用上下文。
        """
        key = "inspect_memory.success" if result.ok else "inspect_memory.failed"
        lines = [i18n.translate(key, category="tool.messages"), ""]
        files = cast(list[MemoryUsageData], (result.data or {}).get("files", []))
        for item in files:
            label = html.escape(Path(item["path"]).name)
            if item["status"] == MemoryFileReadStatus.OK:
                summary = i18n.translate("inspect_memory.usage", category="tool.messages",
                                         tokens=item["estimated_tokens"], size=item["size_bytes"])
            else:
                summary = i18n.translate(f"inspect_memory.{item['status']}", category="tool.messages")
            lines.append(f"- <code>{label}</code>：{summary}")
        if not files and not result.ok:
            lines.append(i18n.translate("inspect_memory.unavailable", category="tool.messages"))
        return ToolDetail(type=DisplayType.MD, data=FileContent(file_name="inspect_memory.md", content="\n".join(lines)))
