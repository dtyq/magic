import asyncio
import re
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import SubagentsPhase, ToolDetail
from app.i18n import i18n
from app.path_manager import PathManager
from app.tools.call_subagent import AgentDisplayKind, _display_subject_from_payload
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive
from app.tools.subagent_runtime_models import (
    SubagentQueryResult,
    SubagentQueryStatus,
    SubagentSessionState,
    SubagentStatus,
    utc_now,
)
from app.tools.subagent_runtime_store import SubagentRuntimeStore
from app.tools.subagent_session_manager import SubagentSessionHandle, subagent_session_manager
from app.tools.subagent_wait_progress import (
    IN_FLIGHT_STATUSES,
    LAST_ACTIVITY_MAX_CHARS,
    AgentProgressItem,
    build_progress_detail,
    build_progress_message,
    build_stopping_message,
    get_last_assistant_message,
    load_progress_items,
    result_display_label,
    start_progress_reporting,
    stop_progress_reporting,
)
from app.utils.async_file_utils import async_exists, async_read_json

# 无限等待（timeout=-1）的最大兜底时间：60 分钟
_MAX_INFINITE_WAIT_SECONDS = 3600.0
# 超过此阈值的等待触发定期续期（防止沙盒因闲置被杀）
_KEEP_ALIVE_THRESHOLD = 60.0
# pattern 轮询扫描间隔（大模型输出不快，1s 足够）
_POLL_INTERVAL = 1.0


class WaitForSubagentsParams(BaseToolParams):
    agent_ids: List[str] = Field(
        ...,
        description="Exact final session IDs returned by background call_subagent calls. The parameter name is retained for compatibility."
    )
    timeout: float = Field(
        30.0,
        description="Seconds to wait. Positive values wait up to the limit, 0 returns immediately, and -1 waits for completion.",
    )
    kill: bool = Field(
        False,
        description="Stop all listed sub-agents and return their current results.",
    )
    pattern: Optional[str] = Field(
        None,
        description="Optional Python regex that returns early when a new assistant message matches.",
    )


# Full model-facing usage guidance: agents/skills/subagents/SKILL.md
@tool(code_mode_only=True)
class WaitForSubagents(BaseTool[WaitForSubagentsParams]):
    """Wait for or stop background Agents."""

    def is_visible_in_context(self, agent_context: "AgentContext") -> bool:
        return not agent_context.is_subagent_context()

    async def check_execution_permission(
        self,
        tool_context: ToolContext,
        params: WaitForSubagentsParams,
    ) -> Optional[ToolResult]:
        agent_context = tool_context.get_extension("agent_context")
        if agent_context is not None and agent_context.is_subagent_context():
            return ToolResult.error(
                "Sub-agents cannot wait for sibling or nested sub-agents. "
                "Return your current findings to the parent agent instead."
            )
        return None

    async def execute(self, tool_context: ToolContext, params: WaitForSubagentsParams) -> ToolResult:
        # Phase 1: resolve agent_ids to handles or immediate error results
        resolved: list[ResolvedAgent] = []
        for item in await load_progress_items(params.agent_ids):
            agent_id = item.agent_id
            if item.status == SubagentQueryStatus.NOT_FOUND:
                resolved.append(ResolvedAgent(item, error_result=SubagentQueryResult(
                    agent_id=agent_id,
                    status=SubagentQueryStatus.NOT_FOUND,
                    session_id=agent_id,
                    error=f"No sub-agent session found with id: {agent_id}",
                )))
                continue
            if item.status == SubagentQueryStatus.AMBIGUOUS:
                resolved.append(ResolvedAgent(item, error_result=SubagentQueryResult(
                    agent_id=agent_id,
                    status=SubagentQueryStatus.AMBIGUOUS,
                    session_id=agent_id,
                    error=f"Multiple sub-agent sessions found with id: {agent_id}. agent_id must be unique.",
                )))
                continue
            handle = await subagent_session_manager.get_handle(item.agent_name, agent_id)
            resolved.append(ResolvedAgent(item, handle=handle))

        # Phase 2: kill 或 wait
        running_task_refs: dict[asyncio.Task, tuple[str, str]] = {
            entry.handle.task: (entry.progress.agent_name, entry.progress.agent_id)
            for entry in resolved
            if entry.handle is not None
            and entry.handle.is_running()
            and entry.handle.task is not None
        }

        if params.kill:
            # kill 语义：终止所有仍在运行的子 Agent
            if running_task_refs:
                await asyncio.gather(*(
                    subagent_session_manager.interrupt_run(
                        agent_name, agent_id,
                        reason="Killed by parent agent via wait_for_subagents(kill=True)",
                        timeout=15.0,
                    )
                    for agent_name, agent_id in running_task_refs.values()
                ))
            wait_result = None
        elif running_task_refs and params.timeout != 0:
            # 编译 pattern
            compiled_pattern: Optional[re.Pattern] = None
            if params.pattern:
                try:
                    compiled_pattern = re.compile(params.pattern)
                except re.error as e:
                    return ToolResult.error(
                        f"Invalid pattern: {e}. Pattern must be valid Python regex syntax."
                    )
            progress_items = [entry.progress for entry in resolved]
            progress_task = start_progress_reporting(
                self,
                tool_context,
                _build_wait_action([item.display_payload() for item in progress_items]),
                progress_items,
                {entry.progress.agent_id: entry.handle for entry in resolved if entry.handle is not None},
            )
            try:
                wait_result = await _wait_for_tasks(
                    running_task_refs, params.timeout, tool_context, compiled_pattern,
                )
            finally:
                await stop_progress_reporting(progress_task)
        else:
            wait_result = None

        # Phase 3: read final state for each resolved agent
        results: list[SubagentQueryResult] = []
        for entry in resolved:
            if entry.error_result is not None:
                results.append(entry.error_result)
                continue
            handle = entry.handle
            agent_name = entry.progress.agent_name
            agent_id = entry.progress.agent_id
            async with handle.state_lock:
                state = await SubagentRuntimeStore.load_state(agent_name, agent_id)
                # 子 agent task 已停但状态仍是进行中，说明任务已丢失或进程已重启。
                if state.status in IN_FLIGHT_STATUSES and not handle.is_running():
                    _mark_missing_inflight_as_interrupted(state)
                    await SubagentRuntimeStore.save_state(state)
            # 超时但仍在运行时，附上最近一条 assistant 消息作为进度快照
            last_activity = None
            matched_content = None
            if state.status in IN_FLIGHT_STATUSES:
                # pattern 匹配的 agent 用 matched_content，其余用 last_activity
                if (
                    wait_result is not None
                    and wait_result.reason == "pattern_matched"
                    and wait_result.matched_agent_id == agent_id
                ):
                    matched_content = wait_result.matched_content
                else:
                    last_activity = await get_last_assistant_message(state.agent_name, agent_id)
            results.append(SubagentQueryResult(
                agent_id=agent_id,
                agent_name=state.agent_name,
                session_id=agent_id,
                task_label=state.task_label,
                display_name=state.display_name,
                status=state.status,
                result=state.last_result,
                error=state.last_error,
                last_activity=last_activity,
                matched_content=matched_content,
            ))

        return ToolResult(
            content=_build_results_text(results, wait_result),
            data={"results": [asdict(result) for result in results]},
        )

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        args = arguments or {}
        items = await load_progress_items(_agent_ids_from_arguments(args))
        action = _build_wait_action([item.display_payload() for item in items])
        if not items:
            return {"action": action, "remark": ""}
        remark = build_stopping_message(items) if args.get("kill") else build_progress_message(items)
        return {"action": action, "remark": remark}

    async def get_before_tool_detail(
        self, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        items = await load_progress_items(_agent_ids_from_arguments(arguments or {}))
        return build_progress_detail(items, elapsed_seconds=0, phase=SubagentsPhase.WAITING)

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        if not result.ok:
            return None

        data = result.data if isinstance(result.data, dict) else {}
        results = data.get("results", [])
        if not results:
            return None

        # 会话状态里有开始和结束时间，结果里没有；再读一次小文件换每行的耗时
        items = await load_progress_items([str(item.get("agent_id") or "") for item in results])
        for item, query_result in zip(items, results):
            _apply_query_result(item, query_result)
        return build_progress_detail(
            items,
            elapsed_seconds=int(result.execution_time or 0),
            phase=SubagentsPhase.SETTLED,
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
            action = _build_wait_action(results)
            if len(results) == 1 and results[0].get("agent_name"):
                item = results[0]
                label = result_display_label(item)
                status = item.get("status", "")
                if status in {SubagentStatus.PENDING, SubagentStatus.RUNNING}:
                    summary = i18n.translate("call_subagent.running", category="tool.messages", agent_name=label)
                elif status == SubagentStatus.DONE:
                    summary = i18n.translate("call_subagent.done", category="tool.messages", agent_name=label)
                elif status == SubagentStatus.ERROR:
                    summary = i18n.translate(
                        "call_subagent.failed",
                        category="tool.messages",
                        agent_name=label,
                        error=item.get("error", i18n.translate("unknown.message", category="tool.messages")),
                    )
                elif status == SubagentStatus.INTERRUPTED:
                    summary = i18n.translate("call_subagent.interrupted", category="tool.messages", agent_name=label)
                else:
                    summary = f"{label}: {status}"
            else:
                summary = ", ".join(f"{result_display_label(item)}: {item['status']}" for item in results)
            return {"action": action, "remark": summary}
        except Exception:
            return {"action": action, "remark": ""}


@dataclass
class ResolvedAgent:
    """Phase 1 的解析结果：要么拿到可等待的会话 handle，要么拿到立即返回的错误。

    progress 同时是进度卡片的数据源，等待期间由刷新任务原地更新状态。
    """

    progress: AgentProgressItem
    handle: Optional[SubagentSessionHandle] = None
    error_result: Optional[SubagentQueryResult] = None


def _agent_ids_from_arguments(arguments: Dict[str, Any]) -> list[str]:
    """before 钩子拿到的是未经校验的原始参数，类型不对时按没有处理。"""
    agent_ids = arguments.get("agent_ids")
    if not isinstance(agent_ids, list):
        return []
    return [str(agent_id) for agent_id in agent_ids if agent_id]


def _apply_query_result(item: AgentProgressItem, query_result: dict[str, Any]) -> None:
    """结果卡以 execute 的最终结果为准，会话文件只补开始和结束时间。"""
    item.status = str(query_result.get("status") or item.status)
    item.result = query_result.get("result")
    item.error = query_result.get("error")
    item.last_activity = (
        query_result.get("matched_content") or query_result.get("last_activity")
        if item.is_in_flight
        else None
    )


@dataclass
class WaitResult:
    """_wait_for_tasks 的返回值，描述等待结束的原因。"""
    reason: str  # "all_completed" | "timeout" | "pattern_matched"
    matched_agent_id: Optional[str] = None
    matched_agent_name: Optional[str] = None
    matched_content: Optional[str] = None


async def _wait_for_tasks(
    task_refs: dict[asyncio.Task, tuple[str, str]],
    timeout: float,
    tool_context: ToolContext,
    pattern: Optional[re.Pattern] = None,
) -> WaitResult:
    """等待所有子 agent task 完成，支持超时、pattern 匹配和父 agent 中断信号。
    - 超时后直接返回 reason="timeout"
    - pattern 匹配时返回 reason="pattern_matched"
    - 所有 task 完成时返回 reason="all_completed"
    - 收到中断信号时抛 CancelledError
    timeout < 0 视为无限等待，兜底上限 60 分钟。
    """
    tasks = set(task_refs.keys())
    agent_context = tool_context.get_extension("agent_context")
    interruption_event = agent_context.get_interruption_event() if agent_context else None

    # 无限等待时使用 60 分钟兜底
    effective_timeout = _MAX_INFINITE_WAIT_SECONDS if timeout < 0 else timeout

    # 用 wrapper task 等待所有 agent task；父中断时会显式 interrupt 真实子任务。
    async def _wait_all() -> None:
        await asyncio.wait(tasks, return_when=asyncio.ALL_COMPLETED)

    wait_task = asyncio.create_task(_wait_all())
    interrupt_task: asyncio.Task | None = None

    if interruption_event is not None:
        interrupt_task = asyncio.create_task(interruption_event.wait())

    # 长时间等待时定期续期活跃时间，防止沙盒因闲置被杀
    keep_alive_task = (
        start_tool_keep_alive(tool_context) if effective_timeout > _KEEP_ALIVE_THRESHOLD else None
    )

    awaitables: set[asyncio.Task] = {wait_task}
    if interrupt_task is not None:
        awaitables.add(interrupt_task)

    try:
        result = WaitResult(reason="timeout")  # 默认
        try:
            if pattern is not None:
                # ── 增量轮询模式：每 _POLL_INTERVAL 扫描新消息 ──────
                message_offsets = await _get_initial_message_counts(task_refs)
                loop = asyncio.get_event_loop()
                deadline = loop.time() + effective_timeout
                while True:
                    remaining = deadline - loop.time()
                    if remaining <= 0:
                        break
                    poll_wait = min(_POLL_INTERVAL, remaining)
                    done, _ = await asyncio.wait(
                        awaitables, timeout=poll_wait,
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                    if interrupt_task is not None and interrupt_task in done:
                        break  # 下方统一处理中断
                    if wait_task in done:
                        result = WaitResult(reason="all_completed")
                        break
                    # 增量扫描子 Agent 新消息
                    match = await _scan_messages_for_pattern(task_refs, pattern, message_offsets)
                    if match:
                        agent_id, agent_name, content = match
                        result = WaitResult(
                            reason="pattern_matched",
                            matched_agent_id=agent_id,
                            matched_agent_name=agent_name,
                            matched_content=content,
                        )
                        break
            else:
                # ── 事件驱动模式（无 pattern，零开销等待）──────────
                done, _ = await asyncio.wait(
                    awaitables, timeout=effective_timeout,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                if wait_task in done:
                    result = WaitResult(reason="all_completed")
                # else: timeout (default)
        finally:
            # 清理 wrapper tasks（不影响实际 agent task）
            wait_task.cancel()
            if interrupt_task is not None:
                interrupt_task.cancel()

        # 中断检查（两种模式共用）
        if interrupt_task is not None and (
            interrupt_task.done() or (interruption_event and interruption_event.is_set())
        ):
            reason = agent_context.get_interruption_reason() or "Parent agent was interrupted while waiting."
            await _interrupt_subagents_and_record_notice(task_refs, agent_context, reason)
            raise asyncio.CancelledError("Interrupted while waiting for sub-agents")

        return result

    except asyncio.CancelledError:
        if agent_context is not None:
            reason = agent_context.get_interruption_reason() or "Parent agent was interrupted while waiting."
            await asyncio.shield(_interrupt_subagents_and_record_notice(task_refs, agent_context, reason))
        raise
    finally:
        stop_tool_keep_alive(keep_alive_task)


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
        session_id=agent_id,
        agent_name=state.agent_name,
        task_label=state.task_label,
        display_name=state.display_name,
        status=state.status,
        result=state.last_result,
        error=state.last_error,
    )


def _build_interrupted_subagent_notice(results: list[SubagentQueryResult]) -> str:
    lines = [
        "Sub-agent cancellation summary:",
    ]
    for result in results:
        label = _query_result_label(result)
        suffix = f", reason={result.error}" if result.error else ""
        lines.append(f"- {label}: {result.status}{suffix}")
    lines.append(
        "The wait_for_subagents call was interrupted, and the child sub-agents tied to this parent run were also stopped."
    )
    return "\n".join(lines)


def _mark_missing_inflight_as_interrupted(state: SubagentSessionState) -> None:
    state.status = SubagentStatus.INTERRUPTED
    state.last_error = state.last_error or "process_restarted_or_task_missing"
    state.finished_at = state.finished_at or utc_now()


def _build_wait_action(items: list[dict[str, Any]]) -> str:
    if items and all(
        _display_subject_from_payload(str(item.get("agent_name") or ""), item).kind == AgentDisplayKind.CREW
        for item in items
    ):
        return i18n.translate("wait_for_subagents.crew", category="tool.actions")
    return i18n.translate("wait_for_subagents", category="tool.actions")


def _query_result_label(result: SubagentQueryResult) -> str:
    task_label = (result.task_label or "").strip()
    if task_label:
        return task_label
    if result.display_name:
        return result.display_name
    if result.agent_name:
        return f"{result.agent_name}/{result.agent_id}"
    return result.agent_id


async def _get_initial_message_counts(
    task_refs: dict[asyncio.Task, tuple[str, str]],
) -> dict[str, int]:
    """获取每个运行中子 Agent 的当前消息总数，作为增量扫描的起始偏移。
    返回 {agent_id: message_count}。
    """
    counts: dict[str, int] = {}
    for task, (agent_name, agent_id) in task_refs.items():
        if task.done():
            continue
        chat_file = PathManager.get_subagent_chat_history_dir(agent_name, agent_id) / f"{agent_name}<{agent_id}>.json"
        try:
            if await async_exists(chat_file):
                data = await async_read_json(chat_file)
                counts[agent_id] = len(data) if isinstance(data, list) else 0
            else:
                counts[agent_id] = 0
        except Exception:
            counts[agent_id] = 0
    return counts


async def _scan_messages_for_pattern(
    task_refs: dict[asyncio.Task, tuple[str, str]],
    pattern: re.Pattern,
    message_offsets: dict[str, int],
) -> Optional[tuple[str, str, str]]:
    """增量扫描运行中子 Agent 的 assistant 消息，返回首个匹配的 (agent_id, agent_name, matched_content)。
    只扫描 index >= offset 的新增消息中 role=assistant 的条目。
    如果检测到上下文压缩（消息数 < offset），重置 offset 到当前长度以跳过压缩摘要。
    已结束的 agent 跳过（结果由 Phase 3 读取）。
    """
    for task, (agent_name, agent_id) in task_refs.items():
        if task.done():
            continue
        chat_file = PathManager.get_subagent_chat_history_dir(agent_name, agent_id) / f"{agent_name}<{agent_id}>.json"
        try:
            if not await async_exists(chat_file):
                continue
            data = await async_read_json(chat_file)
        except Exception:
            continue
        if not isinstance(data, list):
            continue
        offset = message_offsets.get(agent_id, 0)
        current_len = len(data)
        if current_len < offset:
            # 上下文压缩：消息数减少，重置 offset 到当前长度
            # 压缩后内容为 [system_msg, summary_user_msg]，跳过它们
            offset = current_len
            message_offsets[agent_id] = offset
        for msg in data[offset:]:
            if (
                isinstance(msg, dict)
                and msg.get("role") == "assistant"
                and isinstance(msg.get("content"), str)
                and msg["content"].strip()
                and pattern.search(msg["content"])
            ):
                content = msg["content"].strip()
                if len(content) > LAST_ACTIVITY_MAX_CHARS:
                    content = content[:LAST_ACTIVITY_MAX_CHARS] + "..."
                return (agent_id, agent_name, content)
    return None


def _build_results_text(
    results: list[SubagentQueryResult],
    wait_result: Optional["WaitResult"] = None,
) -> str:
    if not results:
        return "No sub-agent results found."

    total = len(results)
    sections: list[str] = []

    for i, result in enumerate(results, 1):
        label = _query_result_label(result)
        parts = [f"[{i}/{total}] {label}: {result.status}"]
        session_id = result.session_id or result.agent_id
        if result.agent_name or session_id:
            parts.append(f"Sub-agent: {result.agent_name or ''}/{session_id}")
            if result.agent_name and session_id:
                # 等待结果可能在创建调用之后的另一轮才进入上下文，因此再次写出最终 ID，
                # 防止模型只记住最初请求的基础名称而无法正确恢复该会话。
                parts.append(
                    f"To continue this exact session, call call_subagent with "
                    f"session_id `{session_id}`, resume=true, and fork=false."
                )

        if result.error:
            parts.append(f"Error: {result.error}")

        if result.result:
            parts.append(f"Result:\n```\n{result.result.strip()}\n```")

        # pattern 匹配的消息（与 last_activity 互斥）
        if result.matched_content:
            parts.append(f"Pattern matched:\n```\n{result.matched_content.strip()}\n```")
        elif result.last_activity:
            parts.append(f"Last message:\n```\n{result.last_activity.strip()}\n```")

        sections.append("\n".join(parts))

    # 尾部决策引导：告诉模型仍在运行的 agent 必须被处理
    running_labels = [_query_result_label(r) for r in results if r.status in IN_FLIGHT_STATUSES]
    if running_labels:
        reason = wait_result.reason if wait_result else None
        labels_str = ", ".join(running_labels)
        if reason == "pattern_matched":
            sections.append(
                f"--- {len(running_labels)} agent(s) still running after pattern match ({labels_str}). "
                "A pattern match is progress, not completion. Call wait_for_subagents again "
                "and process the final results before finishing the parent task. "
                "Use kill=True only when the delegated work is no longer needed."
            )
        elif reason == "timeout":
            sections.append(
                f"--- {len(running_labels)} agent(s) still running after timeout ({labels_str}). "
                "Timeout is not failure or completion — the agents are still working. "
                "Call wait_for_subagents again and process the final results before "
                "finishing the parent task. Use kill=True only when the delegated work "
                "is no longer needed."
            )
        else:
            # timeout=0 快照或其他场景
            sections.append(
                f"--- {len(running_labels)} agent(s) still running ({labels_str}). "
                "Use wait_for_subagents with timeout > 0 and process the final results "
                "before finishing the parent task. Use kill=True only when the delegated "
                "work is no longer needed."
            )

    return "\n\n".join(sections)
