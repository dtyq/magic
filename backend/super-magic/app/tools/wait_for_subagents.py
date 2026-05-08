import asyncio
from dataclasses import asdict
from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.path_manager import PathManager
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.tools.subagent_runtime_models import (
    SubagentQueryResult,
    SubagentQueryStatus,
    SubagentSessionState,
    SubagentStatus,
    utc_now,
)
from app.tools.subagent_runtime_store import SubagentRuntimeStore
from app.tools.subagent_session_manager import SubagentSessionHandle, subagent_session_manager
from app.core.entity.message.server_message import DisplayType, TerminalContent, ToolDetail
from app.utils.async_file_utils import async_exists, async_read_json

# 超时时返回给父 Agent 的进度快照最大字符数
_LAST_ACTIVITY_MAX_CHARS = 500


class WaitForSubagentsParams(BaseToolParams):
    agent_ids: List[str] = Field(
        ...,
        description="One or more agent_ids returned by call_subagent(background=True). All specified agents are awaited together."
    )
    timeout: float = Field(
        30.0,
        description="Max seconds to wait for all agents to finish. Default: 30 seconds."
    )


@tool()
class WaitForSubagents(BaseTool[WaitForSubagentsParams]):
    """Wait for specified background sub-agents to finish."""

    async def execute(self, tool_context: ToolContext, params: WaitForSubagentsParams) -> ToolResult:
        # Phase 1: resolve agent_ids to handles or immediate error results
        resolved: list[tuple[str, str | None, SubagentSessionHandle | None, SubagentQueryResult | None]] = []
        for agent_id in params.agent_ids:
            states = await SubagentRuntimeStore.find_states_by_agent_id(agent_id)
            if not states:
                resolved.append((agent_id, None, None, SubagentQueryResult(
                    agent_id=agent_id,
                    status=SubagentQueryStatus.NOT_FOUND,
                    error=f"No sub-agent session found with id: {agent_id}",
                )))
                continue
            if len(states) > 1:
                resolved.append((agent_id, None, None, SubagentQueryResult(
                    agent_id=agent_id,
                    status=SubagentQueryStatus.AMBIGUOUS,
                    error=f"Multiple sub-agent sessions found with id: {agent_id}. agent_id must be unique.",
                )))
                continue
            state = states[0]
            handle = await subagent_session_manager.get_handle(state.agent_name, agent_id)
            resolved.append((agent_id, state.agent_name, handle, None))

        # Phase 2: wait for all still-running tasks
        running_task_refs: dict[asyncio.Task, tuple[str, str]] = {
            handle.task: (agent_name, agent_id)
            for (agent_id, agent_name, handle, err) in resolved
            if err is None
            and agent_name is not None
            and handle is not None
            and handle.is_running()
            and handle.task is not None
        }
        if running_task_refs and params.timeout != 0:
            await _wait_for_tasks(running_task_refs, params.timeout, tool_context)

        # Phase 3: read final state for each resolved agent
        results: list[SubagentQueryResult] = []
        for agent_id, agent_name, handle, error_result in resolved:
            if error_result is not None:
                results.append(error_result)
                continue
            async with handle.state_lock:
                state = await SubagentRuntimeStore.load_state(agent_name, agent_id)
                # 子 agent task 已停但状态仍是进行中，说明任务已丢失或进程已重启。
                if state.status in _IN_FLIGHT_STATUSES and not handle.is_running():
                    _mark_missing_inflight_as_interrupted(state)
                    await SubagentRuntimeStore.save_state(state)
            # 超时但仍在运行时，附上最近一条 assistant 消息作为进度快照
            last_activity = None
            if state.status in _IN_FLIGHT_STATUSES:
                last_activity = await _get_last_assistant_message(state.agent_name, agent_id)
            results.append(SubagentQueryResult(
                agent_id=agent_id,
                agent_name=state.agent_name,
                status=state.status,
                result=state.last_result,
                error=state.last_error,
                last_activity=last_activity,
            ))

        return ToolResult(
            content=_build_results_text(results),
            data={"results": [asdict(result) for result in results]},
        )

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        if not result.ok:
            return None

        data = result.data if isinstance(result.data, dict) else {}
        items = data.get("results", [])
        if not items:
            return None

        t = lambda key: i18n.translate(f"call_subagent.detail.{key}", category="tool.messages")
        _status_emoji: Dict[str, str] = {
            "done": "✅", "error": "❌", "interrupted": "⚠️",
            "running": "⏳", "pending": "⏳",
            "not_found": "🔍", "ambiguous": "❓",
        }
        sections = []
        for item in items:
            agent_name = item.get("agent_name", "")
            agent_id = item.get("agent_id", "")
            status = item.get("status", "")
            agent_result = item.get("result") or ""
            error = item.get("error") or ""

            status_emoji = _status_emoji.get(status, "🔄")
            header = f"=== {agent_name} / {agent_id} ===" if agent_name else f"=== {agent_id} ==="
            lines = [header]
            if status:
                lines.append(f"{t('status')}: {status_emoji} {status}")
            if agent_result:
                lines.append(f"\n{t('result')}:\n{agent_result}")
            if error:
                lines.append(f"\n{t('error')}: {error}")
            sections.append("\n".join(lines))

        if not sections:
            return None

        agent_count = len(items)
        command = (
            f"wait_for_subagents ({agent_count} agents)"
            if agent_count > 1
            else f"wait_for_subagents {items[0].get('agent_id', '')}"
        )
        return ToolDetail(
            type=DisplayType.TERMINAL,
            data=TerminalContent(
                command=command,
                output="\n\n".join(sections),
                exit_code=_resolve_terminal_exit_code(items),
            ),
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        action = i18n.translate("wait_for_subagents", category="tool.actions")
        if not result.ok:
            return {
                "action": action,
                "remark": i18n.translate("wait_for_subagents.error", category="tool.messages", error=result.content),
            }
        try:
            results = result.data.get("results", [])
            if len(results) == 1 and results[0].get("agent_name"):
                item = results[0]
                agent_name = item["agent_name"]
                action = i18n.translate("call_subagent.assign", category="tool.messages", agent_name=agent_name)
                status = item.get("status", "")
                if status in {SubagentStatus.PENDING, SubagentStatus.RUNNING}:
                    summary = i18n.translate("call_subagent.running", category="tool.messages", agent_name=agent_name)
                elif status == SubagentStatus.DONE:
                    summary = i18n.translate("call_subagent.done", category="tool.messages", agent_name=agent_name)
                elif status == SubagentStatus.ERROR:
                    summary = i18n.translate(
                        "call_subagent.failed",
                        category="tool.messages",
                        agent_name=agent_name,
                        error=item.get("error", i18n.translate("unknown.message", category="tool.messages")),
                    )
                elif status == SubagentStatus.INTERRUPTED:
                    summary = i18n.translate("call_subagent.interrupted", category="tool.messages", agent_name=agent_name)
                else:
                    summary = f"{agent_name}: {status}"
            else:
                summary = ", ".join(f"{item['agent_id']}: {item['status']}" for item in results)
            return {"action": action, "remark": summary}
        except Exception:
            return {"action": action, "remark": ""}


async def _wait_for_tasks(
    task_refs: dict[asyncio.Task, tuple[str, str]],
    timeout: float,
    tool_context: ToolContext,
) -> None:
    """等待所有子 agent task 完成，支持超时和父 agent 中断信号。
    超时后直接返回（不抛异常），调用方读当前状态即可。
    收到中断信号时抛 CancelledError。
    """
    tasks = set(task_refs.keys())
    agent_context = tool_context.get_extension("agent_context")
    interruption_event = agent_context.get_interruption_event() if agent_context else None

    # 用 wrapper task 等待所有 agent task；父中断时会显式 interrupt 真实子任务。
    async def _wait_all() -> None:
        await asyncio.wait(tasks, return_when=asyncio.ALL_COMPLETED)

    wait_task = asyncio.create_task(_wait_all())
    interrupt_task: asyncio.Task | None = None

    if interruption_event is not None:
        interrupt_task = asyncio.create_task(interruption_event.wait())

    awaitables: set[asyncio.Task] = {wait_task}
    if interrupt_task is not None:
        awaitables.add(interrupt_task)

    try:
        try:
            if timeout < 0:
                done, _ = await asyncio.wait(awaitables, return_when=asyncio.FIRST_COMPLETED)
            else:
                done, _ = await asyncio.wait(awaitables, timeout=timeout, return_when=asyncio.FIRST_COMPLETED)
        finally:
            # 清理 wrapper tasks（不影响实际 agent task）
            wait_task.cancel()
            if interrupt_task is not None:
                interrupt_task.cancel()
    except asyncio.CancelledError:
        if agent_context is not None:
            reason = agent_context.get_interruption_reason() or "Parent agent was interrupted while waiting."
            await asyncio.shield(_interrupt_subagents_and_record_notice(task_refs, agent_context, reason))
        raise

    if interrupt_task is not None and interrupt_task in done:
        reason = agent_context.get_interruption_reason() or "Parent agent was interrupted while waiting."
        await _interrupt_subagents_and_record_notice(task_refs, agent_context, reason)
        raise asyncio.CancelledError("Interrupted while waiting for sub-agents")
    # 超时（wait_task 未完成）→ 直接返回，调用方会读到仍在 running 的状态


async def _interrupt_subagents_and_record_notice(
    task_refs: dict[asyncio.Task, tuple[str, str]],
    agent_context,
    reason: str,
) -> None:
    """中断被等待的子 Agent，并把结果写入父 Agent 的下一轮上下文。"""
    interrupt_results = await asyncio.gather(*(
        _interrupt_and_read_state(agent_name, agent_id, reason)
        for agent_name, agent_id in task_refs.values()
    ))
    agent_context.append_interruption_notice(
        _build_interrupted_subagent_notice(interrupt_results)
    )


async def _interrupt_and_read_state(agent_name: str, agent_id: str, reason: str) -> SubagentQueryResult:
    """中断子 Agent 并读取最终状态，用于把运行时事实带回父 Agent 上下文。"""
    await subagent_session_manager.interrupt_run(
        agent_name,
        agent_id,
        reason=reason,
        timeout=10.0,
    )
    state = await SubagentRuntimeStore.load_state(agent_name, agent_id)
    return SubagentQueryResult(
        agent_id=agent_id,
        agent_name=state.agent_name,
        status=state.status,
        result=state.last_result,
        error=state.last_error,
    )


def _build_interrupted_subagent_notice(results: list[SubagentQueryResult]) -> str:
    lines = [
        "Sub-agent cancellation summary:",
    ]
    for result in results:
        label = f"{result.agent_name}/{result.agent_id}" if result.agent_name else result.agent_id
        suffix = f", reason={result.error}" if result.error else ""
        lines.append(f"- {label}: {result.status}{suffix}")
    lines.append(
        "The wait_for_subagents call was interrupted, and the child sub-agents tied to this parent run were also stopped."
    )
    return "\n".join(lines)


_IN_FLIGHT_STATUSES = {
    SubagentStatus.PENDING,
    SubagentStatus.RUNNING,
}


def _mark_missing_inflight_as_interrupted(state: SubagentSessionState) -> None:
    state.status = SubagentStatus.INTERRUPTED
    state.last_error = state.last_error or "process_restarted_or_task_missing"
    state.finished_at = state.finished_at or utc_now()


def _resolve_terminal_exit_code(items: list[dict[str, Any]]) -> int:
    statuses = {item.get("status", "") for item in items}
    if statuses & {
        SubagentQueryStatus.NOT_FOUND,
        SubagentQueryStatus.AMBIGUOUS,
        SubagentStatus.ERROR,
        SubagentStatus.INTERRUPTED,
    }:
        return 1
    if statuses & _IN_FLIGHT_STATUSES:
        return 124
    return 0


async def _get_last_assistant_message(agent_name: str, agent_id: str) -> Optional[str]:
    """从子 Agent 的聊天历史文件中读取最后一条有内容的 assistant 消息，用于超时时的进度快照。"""
    chat_file = PathManager.get_subagents_chat_history_dir() / f"{agent_name}<{agent_id}>.json"
    try:
        if not await async_exists(chat_file):
            return None
        data = await async_read_json(chat_file)
        if not isinstance(data, list):
            return None
        for msg in reversed(data):
            if not isinstance(msg, dict) or msg.get("role") != "assistant":
                continue
            content = msg.get("content")
            if content and isinstance(content, str) and content.strip():
                content = content.strip()
                if len(content) > _LAST_ACTIVITY_MAX_CHARS:
                    content = content[:_LAST_ACTIVITY_MAX_CHARS] + "..."
                return content
    except Exception:
        pass
    return None


def _build_results_text(results: list[SubagentQueryResult]) -> str:
    if not results:
        return "No sub-agent results found."

    total = len(results)
    sections: list[str] = []

    for i, result in enumerate(results, 1):
        label = f"{result.agent_name}/{result.agent_id}" if result.agent_name else result.agent_id
        parts = [f"[{i}/{total}] {label}: {result.status}"]

        if result.error:
            parts.append(f"Error: {result.error}")

        if result.result:
            parts.append(f"Result:\n```\n{result.result.strip()}\n```")

        if result.last_activity:
            parts.append(f"Last message:\n```\n{result.last_activity.strip()}\n```")

        sections.append("\n".join(parts))

    return "\n\n".join(sections)
