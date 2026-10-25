"""Code Mode SDK 调用状态注册表。"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from enum import StrEnum

from agentlang.chat_history.chat_history_models import ContextSource
from agentlang.logger import get_logger

logger = get_logger(__name__)

_MAX_CALLS_PER_EXECUTION = 200
_SUMMARY_MAX_CHARS = 240

_ScopeKey = tuple[str, str, str]
_ExecutionKey = tuple[str, str]


class SdkCallStatus(StrEnum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass(frozen=True, slots=True)
class SdkCallSummary:
    tool_call_id: str
    tool_name: str
    status: SdkCallStatus
    started_at: datetime
    finished_at: datetime | None = None
    ok: bool | None = None
    summary: str = ""
    error_code: str | None = None


@dataclass(slots=True)
class SdkCallEntry:
    agent_context_id: str
    sdk_execution_id: str
    tool_call_id: str
    tool_name: str
    task: asyncio.Task[object]


class SdkCallRegistry:
    """在主事件循环内维护 in-flight task 和有界执行摘要。"""

    _instance: "SdkCallRegistry | None" = None

    def __init__(self) -> None:
        self._entries: dict[_ScopeKey, SdkCallEntry] = {}
        self._summaries: dict[_ExecutionKey, dict[str, SdkCallSummary]] = {}

    @classmethod
    def get_instance(cls) -> "SdkCallRegistry":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register(self, entry: SdkCallEntry) -> None:
        scope_key = (entry.agent_context_id, entry.sdk_execution_id, entry.tool_call_id)
        execution_key = (entry.agent_context_id, entry.sdk_execution_id)
        self._entries[scope_key] = entry
        summaries = self._summaries.setdefault(execution_key, {})
        if len(summaries) >= _MAX_CALLS_PER_EXECUTION:
            oldest_id = min(summaries, key=lambda call_id: summaries[call_id].started_at)
            summaries.pop(oldest_id, None)
        summaries[entry.tool_call_id] = SdkCallSummary(
            tool_call_id=entry.tool_call_id,
            tool_name=entry.tool_name,
            status=SdkCallStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
        )
        logger.debug(
            "[SdkCallRegistry] registered execution=%s tool_call=%s tool=%s",
            entry.sdk_execution_id[:8],
            entry.tool_call_id,
            entry.tool_name,
        )

    def finish(
        self,
        agent_context_id: str,
        sdk_execution_id: str,
        tool_call_id: str,
        *,
        ok: bool,
        summary: str,
        error_code: str | None = None,
    ) -> None:
        status = SdkCallStatus.COMPLETED if ok else SdkCallStatus.FAILED
        self._update_summary(
            agent_context_id,
            sdk_execution_id,
            tool_call_id,
            status=status,
            ok=ok,
            summary=summary,
            error_code=error_code,
        )

    def mark_cancelled(
        self,
        agent_context_id: str,
        sdk_execution_id: str,
        tool_call_id: str,
    ) -> None:
        self._update_summary(
            agent_context_id,
            sdk_execution_id,
            tool_call_id,
            status=SdkCallStatus.CANCELLED,
            ok=False,
            summary="Tool call cancelled by interruption.",
        )

    def unregister_task(
        self,
        agent_context_id: str,
        sdk_execution_id: str,
        tool_call_id: str,
    ) -> None:
        self._entries.pop((agent_context_id, sdk_execution_id, tool_call_id), None)

    def snapshot_execution(
        self,
        agent_context_id: str,
        sdk_execution_id: str,
    ) -> tuple[SdkCallSummary, ...]:
        summaries = self._summaries.get((agent_context_id, sdk_execution_id), {})
        return tuple(sorted(summaries.values(), key=lambda item: item.started_at))

    def context_source(self, agent_context_id: str, sdk_execution_id: str) -> ContextSource:
        """只判定本次可见脚本输出的来源，不累加内部结果。

        全部 MCP / 全部技能读取 -> 可归类；混合、空或达到摘要上限 -> 不猜测。
        上限处早期摘要可能已被淘汰，剩余工具一致不能证明整次执行来源一致。
        """
        calls = self.snapshot_execution(agent_context_id, sdk_execution_id)
        if not calls or len(calls) >= _MAX_CALLS_PER_EXECUTION:
            return ContextSource.MIXED
        if all(call.tool_name.startswith("mcp_") for call in calls):
            return ContextSource.MCP
        if all(call.tool_name == "read_skills" for call in calls):
            return ContextSource.SKILLS
        return ContextSource.MIXED

    def clear_execution(self, agent_context_id: str, sdk_execution_id: str) -> None:
        execution_key = (agent_context_id, sdk_execution_id)
        self._summaries.pop(execution_key, None)
        for key in tuple(self._entries):
            if key[:2] == execution_key:
                self._entries.pop(key, None)

    def cancel_by_execution(self, agent_context_id: str, sdk_execution_id: str) -> int:
        to_cancel = [
            (key, entry)
            for key, entry in self._entries.items()
            if entry.agent_context_id == agent_context_id
            and entry.sdk_execution_id == sdk_execution_id
        ]
        cancelled = 0
        for key, entry in to_cancel:
            if not entry.task.done():
                self.mark_cancelled(agent_context_id, sdk_execution_id, entry.tool_call_id)
                entry.task.cancel()
                cancelled += 1
            self._entries.pop(key, None)
        if cancelled:
            logger.info(
                "[SdkCallRegistry] cancelled %s task(s) for execution=%s context=%s",
                cancelled,
                sdk_execution_id[:8],
                agent_context_id[:8],
            )
        return cancelled

    def cancel_by_context(self, agent_context_id: str) -> int:
        execution_ids = {
            entry.sdk_execution_id
            for entry in self._entries.values()
            if entry.agent_context_id == agent_context_id
        }
        return sum(
            self.cancel_by_execution(agent_context_id, execution_id)
            for execution_id in execution_ids
        )

    def _update_summary(
        self,
        agent_context_id: str,
        sdk_execution_id: str,
        tool_call_id: str,
        *,
        status: SdkCallStatus,
        ok: bool,
        summary: str,
        error_code: str | None = None,
    ) -> None:
        summaries = self._summaries.get((agent_context_id, sdk_execution_id))
        if summaries is None:
            return
        current = summaries.get(tool_call_id)
        if current is None:
            return
        summaries[tool_call_id] = replace(
            current,
            status=status,
            finished_at=datetime.now(timezone.utc),
            ok=ok,
            summary=self._short_summary(summary),
            error_code=error_code,
        )

    @staticmethod
    def _short_summary(value: str) -> str:
        normalized = " ".join(value.split())
        return normalized[:_SUMMARY_MAX_CHARS]
