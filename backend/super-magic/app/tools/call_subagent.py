import asyncio
from dataclasses import asdict
import hashlib
from typing import TYPE_CHECKING, Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.path_manager import PathManager
from app.service.agent_runner import _inherit_parent_context
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.tools.subagent_runtime_models import (
    SubagentExecutionMode,
    SubagentPayload,
    SubagentSessionState,
    SubagentStatus,
    utc_now,
)
from app.tools.subagent_runtime_store import SubagentRuntimeStore
from app.tools.subagent_session_manager import subagent_session_manager
from app.core.entity.message.server_message import DisplayType, TerminalContent, ToolDetail

logger = get_logger(__name__)

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
    from app.magic.agent import Agent

# 子 Agent 最大嵌套深度：1 表示只允许主 Agent 调用子 Agent，子 Agent 不能再调用子 Agent
_MAX_AGENT_DEPTH = 1


class CallSubagentParams(BaseToolParams):
    agent_name: str = Field(
        ...,
        description=(
            "Agent type to call. Maps to a .agent config file in the agents/ directory. Available built-in types:\n"
            "- 'magic': General-purpose agent with full tool access (web search, file ops, code execution, etc.). Use for complex multi-step tasks.\n"
            "- 'explore': Read-only codebase exploration. Searches files, reads code, answers structural questions. Cannot modify anything.\n"
            "- 'shell': Shell command execution specialist. Runs scripts, installs deps, performs system operations.\n"
            "Other agent files (e.g. 'data-analyst') can also be used by name."
        )
    )
    agent_id: str = Field(
        ...,
        description="Human-readable session ID, e.g. 'market-research-phase1'. Same ID = resume existing conversation; different ID = fresh start. Used for chat history isolation."
    )
    prompt: str = Field(
        ...,
        description="Complete task description. The sub-agent has NO access to the parent's conversation history — include everything it needs: context, task, success criteria, relevant file paths."
    )
    model_id: Optional[str] = Field(
        None,
        description="Override the model for this sub-agent. Defaults to inheriting the caller's model."
    )
    background: bool = Field(
        False,
        description=(
            "If true, dispatch sub-agent as background asyncio task and return immediately. "
            "Use wait_for_subagents(agent_ids=[agent_id]) to wait for the result. "
            "Use this for ALL parallel workloads — call multiple agents with background=True "
            "sequentially, they run concurrently regardless of whether the model supports "
            "parallel tool call output. Also used for in-process scheduler tasks."
        )
    )


@tool()
class CallSubagent(BaseTool[CallSubagentParams]):
    """Call another agent to complete a task. Each sub-agent runs with an isolated context and its own chat history."""

    async def execute(self, tool_context: ToolContext, params: CallSubagentParams) -> ToolResult:
        new_agent_context: Optional["AgentContext"] = None
        agent: Optional["Agent"] = None
        task: Optional[asyncio.Task] = None
        try:
            from app.core.context.agent_context import AgentContext
            from app.magic.agent import Agent

            # 深度检查：子 Agent 不允许再派发子 Agent
            parent: Optional[AgentContext] = tool_context.get_extension("agent_context")
            current_depth = parent.get_subagent_depth() if parent else 0
            tool_call_id = tool_context.tool_call_id or ""
            if current_depth >= _MAX_AGENT_DEPTH:
                return ToolResult.error((
                    f"Sub-agent spawn depth limit reached ({current_depth}/{_MAX_AGENT_DEPTH}). "
                    "Sub-agents are not allowed to call call_subagent."
                ))

            handle = await subagent_session_manager.get_handle(params.agent_name, params.agent_id)
            async with handle.lock:
                prompt_digest = _digest_prompt(params.prompt)
                state = await SubagentRuntimeStore.load_state(params.agent_name, params.agent_id)
                state.agent_name = params.agent_name
                state.agent_id = params.agent_id
                if state.status == SubagentStatus.RUNNING and not handle.is_running():
                    _mark_missing_running_as_interrupted(state)
                    async with handle.state_lock:
                        await SubagentRuntimeStore.save_state(state)

                restored_result = _restore_if_same_tool_call(
                    state,
                    tool_call_id,
                    params.background,
                    prompt_digest,
                )
                if restored_result is not None:
                    return _success_result(restored_result)

                if handle.is_running():
                    interrupted = await subagent_session_manager.interrupt_run(
                        params.agent_name,
                        params.agent_id,
                        reason="同一子 Agent 会话收到新消息，终止当前执行后继续",
                        timeout=10.0,
                    )
                    if not interrupted:
                        _mark_interrupt_timeout(state, tool_call_id)
                        async with handle.state_lock:
                            await SubagentRuntimeStore.save_state(state)
                        return _success_result(_build_payload(
                            state=state,
                            mode=_mode_from_background(params.background),
                            error="interrupt_timeout",
                            resume_hint="Wait for the current sub-agent run to stop, then call call_subagent again.",
                        ))

                new_agent_context = AgentContext(isolated=True)
                _inherit_parent_context(new_agent_context, parent, depth=current_depth + 1)
                new_agent_context.set_chat_history_dir(str(PathManager.get_subagents_chat_history_dir()))

                if params.model_id:
                    new_agent_context.set_dynamic_model_id(params.model_id)
                elif parent and parent.has_dynamic_model_id():
                    # 未指定模型时，继承调用方 Agent 的动态模型 ID
                    new_agent_context.set_dynamic_model_id(parent.get_dynamic_model_id())

                agent = Agent(
                    params.agent_name,
                    agent_id=params.agent_id,
                    agent_context=new_agent_context,
                )

                _prepare_state_for_dispatch(
                    state=state,
                    prompt_digest=prompt_digest,
                    tool_call_id=tool_call_id,
                    background=params.background,
                )
                async with handle.state_lock:
                    await SubagentRuntimeStore.save_state(state)

                task = asyncio.create_task(
                    _run_subagent(
                        agent=agent,
                        prompt=params.prompt,
                        tool_call_id=tool_call_id,
                        mode=_mode_from_background(params.background),
                        handle=handle,
                    )
                )
                handle.task = task
                handle.agent_context = new_agent_context

            if params.background:
                return _success_result(_build_payload(
                    state=state,
                    mode=SubagentExecutionMode.BACKGROUND,
                    resume_hint="Sub-agent is running in background. Use wait_for_subagents(agent_ids) to block until it finishes.",
                ))

            result_state = await task
            return _success_result(_build_payload(
                state=result_state,
                mode=SubagentExecutionMode.SYNC,
                resume_hint="Pass the same agent_id to call_subagent to continue this conversation.",
            ))

        except Exception as e:
            if agent is not None and task is None:
                agent.close()
            logger.exception(f"调用智能体失败: {e!s}")
            return ToolResult.error(
                _build_call_subagent_error_text(
                    agent_name=params.agent_name,
                    agent_id=params.agent_id,
                ),
                extra_info={
                    "agent_name": params.agent_name,
                    "agent_id": params.agent_id,
                    "error": str(e),
                },
            )

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        args = arguments or {}
        agent_name = args.get("agent_name", "")
        agent_id = args.get("agent_id", "")
        action = (
            i18n.translate("call_subagent.assign", category="tool.messages", agent_name=agent_name)
            if agent_name
            else i18n.translate("call_subagent", category="tool.actions")
        )
        status_text = i18n.translate("call_subagent.status.accepted", category="tool.messages")
        return {"action": action, "remark": _build_status_remark(agent_id, status_text)}

    async def get_before_tool_detail(
        self, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        args = arguments or {}
        agent_name = args.get("agent_name", "")
        agent_id = args.get("agent_id", "")
        prompt = args.get("prompt", "")
        background = args.get("background", False)
        model_id = args.get("model_id")

        if not prompt:
            return None

        t = lambda key: i18n.translate(f"call_subagent.detail.{key}", category="tool.messages")
        lines = []
        if agent_name:
            lines.append(f"{t('sub_agent')}: {agent_name}")
        if agent_id:
            lines.append(f"{t('session_id')}: {agent_id}")
        mode_text = t("mode_background") if background else t("mode_sync")
        lines.append(f"{t('mode')}: {mode_text}")
        if model_id:
            lines.append(f"{t('model')}: {model_id}")
        lines.append(f"\n{t('task')}:\n{prompt}")

        command = f"call_subagent {agent_name}/{agent_id}" if agent_name and agent_id else f"call_subagent {agent_name or agent_id}"
        return ToolDetail(
            type=DisplayType.TERMINAL,
            data=TerminalContent(
                command=command,
                output="\n".join(lines),
                exit_code=0,
            ),
        )

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        args = arguments or {}
        agent_name = args.get("agent_name", "")
        agent_id = args.get("agent_id", "")

        if result.ok:
            data = result.data if isinstance(result.data, dict) else {}
            status = data.get("status", "")
            agent_result = data.get("result") or ""
            error = data.get("error") or ""
            resume_hint = data.get("resume_hint") or ""
        else:
            # Python 级异常（如配置错误、网络异常），错误信息在 extra_info
            extra = result.extra_info or {}
            status = "error"
            agent_result = ""
            error = extra.get("error") or result.content or ""
            resume_hint = ""

        return _build_subagent_tool_detail(agent_name, agent_id, status, agent_result, error, resume_hint)

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
调用多个子智能体并行处理任务时，必须在每个子智能体的 prompt 中明确写清楚它的输出目标，
子智能体之间没有共享上下文，无法相互感知，也无法从对话历史中推断目标对象。
目标对象不写清楚，子智能体会自行猜测，通常的结果是它创建了一个不该创建的新对象。

根据任务性质，有三种典型场景需要区别对待：

1. 共享容器（画布、PPT 等）：由独立元素组成，多个子智能体可以并行往同一个容器里添加各自负责的内容。
   必须把同一个容器标识（如 project_path、文件路径）传给所有子智能体，并说明每个子智能体负责哪一部分。
   不得让子智能体自行创建或选择容器。

2. 单一文件（报告、文档等）：整个文件是一个整体，不支持并发写入。
   要么交给一个子智能体完整完成，要么让各子智能体分别生成各自负责的草稿段落，
   最后指定一个子智能体将所有段落合并进同一个文件。

3. 各自独立输出（不同主题的调研报告、不同内容的画布等）：每个子智能体生成自己的独立产物，互不干扰。
   为每个子智能体单独指定其输出目标，不需要协调或合并。
-->
When dispatching multiple sub-agents in parallel, always specify each agent's output target explicitly in its prompt. Sub-agents share no context — they cannot sense each other or infer targets from conversation history. If the output target is missing, the sub-agent will guess, and will usually create a new object it shouldn't.

Three patterns to follow based on task type:

1. Shared container (canvas, presentation slides, etc.): composed of independent elements; agents can work in parallel. Pass the same container identifier (e.g. project path) to every agent, and tell each one which part it owns. Do not let agents create or choose their own container.

2. Single file (report, document, etc.): the whole file is one unit; concurrent writes conflict. Either assign the full task to one agent, or have each agent draft its assigned section independently, then designate one agent to merge everything into the final file.

3. Fully independent outputs (separate reports per topic, separate canvases per theme, etc.): each agent produces its own distinct deliverable. Specify each agent's output target separately. No coordination needed.

<!--zh
子智能体可能在结果里包含产物文件路径。向用户汇报时，将这些路径转为 [@file_path:路径] 格式，
前端会渲染为可点击蓝色链接。
示例：调研报告已完成：[@file_path:reports/market-research.md]
-->
Sub-agents may include output file paths in their results. When reporting to the user, present those paths as [@file_path:path] — the frontend renders them as clickable blue links.
Example: Research report is ready: [@file_path:reports/market-research.md]
"""

    async def get_before_tool_call_friendly_content(
        self, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> str:
        return ""

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        args = arguments or {}
        agent_name = args.get("agent_name", "")
        agent_id = args.get("agent_id", "")
        action = (
            i18n.translate("call_subagent.assign", category="tool.messages", agent_name=agent_name)
            if agent_name
            else i18n.translate("call_subagent", category="tool.actions")
        )

        if not result.ok:
            status_text = i18n.translate("call_subagent.status.failed", category="tool.messages")
            return {"action": action, "remark": _build_status_remark(agent_id, status_text)}

        payload = result.data if isinstance(result.data, dict) else {}
        status = payload.get("status", "")

        _status_key_map = {
            SubagentStatus.PENDING: "call_subagent.status.running",
            SubagentStatus.RUNNING: "call_subagent.status.running",
            SubagentStatus.DONE: "call_subagent.status.done",
            SubagentStatus.ERROR: "call_subagent.status.failed",
            SubagentStatus.INTERRUPTED: "call_subagent.status.interrupted",
        }
        status_key = _status_key_map.get(status, "call_subagent.status.accepted")
        status_text = i18n.translate(status_key, category="tool.messages")
        return {"action": action, "remark": _build_status_remark(agent_id, status_text)}


def _mode_from_background(background: bool) -> SubagentExecutionMode:
    return SubagentExecutionMode.BACKGROUND if background else SubagentExecutionMode.SYNC


def _digest_prompt(prompt: str) -> str:
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()


def _mark_missing_running_as_interrupted(state: SubagentSessionState) -> None:
    state.status = SubagentStatus.INTERRUPTED
    state.last_error = state.last_error or "process_restarted_or_task_missing"
    state.finished_at = state.finished_at or utc_now()
    state.active_tool_call_id = None


def _mark_interrupt_timeout(state: SubagentSessionState, tool_call_id: str) -> None:
    state.status = SubagentStatus.ERROR
    state.last_error = "interrupt_timeout"
    state.finished_at = utc_now()
    state.last_tool_call_id = tool_call_id or state.last_tool_call_id


def _prepare_state_for_dispatch(
    state: SubagentSessionState,
    prompt_digest: str,
    tool_call_id: str,
    background: bool,
) -> None:
    state.started_at = utc_now()
    state.finished_at = None
    state.status = SubagentStatus.PENDING if background else SubagentStatus.RUNNING
    state.last_prompt_digest = prompt_digest
    state.last_error = None
    state.last_result = None
    state.active_tool_call_id = tool_call_id or None
    state.interrupt_requested = False
    state.interrupt_reason = None


def _restore_if_same_tool_call(
    state: SubagentSessionState,
    tool_call_id: str,
    background: bool,
    prompt_digest: str,
) -> Optional[SubagentPayload]:
    if not tool_call_id:
        return None
    if (
        state.active_tool_call_id == tool_call_id
        and state.status in {SubagentStatus.PENDING, SubagentStatus.RUNNING}
        and state.last_prompt_digest == prompt_digest
    ):
        return _build_payload(
            state=state,
            mode=_mode_from_background(background),
            resume_hint="This tool call is already in progress for the same agent_id.",
        )
    if (
        state.last_tool_call_id == tool_call_id
        and state.cached_tool_result
        and state.last_prompt_digest == prompt_digest
    ):
        return state.cached_tool_result
    if state.active_tool_call_id == tool_call_id and state.status == SubagentStatus.INTERRUPTED:
        return _build_payload(
            state=state,
            mode=_mode_from_background(background),
            resume_hint="The previous sub-agent run was interrupted. Send a new prompt to continue the conversation.",
        )
    return None


def _build_payload(
    state: SubagentSessionState,
    mode: SubagentExecutionMode,
    error: Optional[str] = None,
    resume_hint: Optional[str] = None,
) -> SubagentPayload:
    return SubagentPayload(
        agent_name=state.agent_name,
        agent_id=state.agent_id,
        status=state.status,
        mode=mode,
        result=state.last_result,
        error=error or state.last_error,
        resume_hint=resume_hint,
    )


def _success_result(payload: SubagentPayload) -> ToolResult:
    return ToolResult(
        content=_build_payload_text(payload),
        data=asdict(payload),
    )


def _build_payload_text(payload: SubagentPayload) -> str:
    lines = [
        f"Sub-agent `{payload.agent_name}` with agent_id `{payload.agent_id}` is `{payload.status}`.",
        f"Execution mode: `{payload.mode}`.",
    ]
    if payload.result:
        lines.append(f"Result:\n{payload.result}")
    if payload.error:
        lines.append(f"Error: {payload.error}")
    if payload.resume_hint:
        lines.append(f"Next step: {payload.resume_hint}")
    return "\n".join(lines)


def _build_call_subagent_error_text(agent_name: str, agent_id: str) -> str:
    return (
        f"Unable to assign the task to sub-agent `{agent_name}` with agent_id `{agent_id}`. "
        "Check the agent configuration and runtime state, then try again."
    )


async def _run_subagent(
    agent: "Agent",
    prompt: str,
    tool_call_id: str,
    mode: SubagentExecutionMode,
    handle,
) -> SubagentSessionState:
    state = await SubagentRuntimeStore.load_state(agent.agent_name, agent.id)
    state.agent_name = agent.agent_name
    state.agent_id = agent.id
    _mark_running(state)
    async with handle.state_lock:
        await SubagentRuntimeStore.save_state(state)
    current_task = asyncio.current_task()

    try:
        result = await agent.run(prompt)
        _mark_done(
            state=state,
            result=result or "",
            tool_call_id=tool_call_id,
            mode=mode,
        )
        async with handle.state_lock:
            await SubagentRuntimeStore.save_state(state)
        return state
    except asyncio.CancelledError:
        _mark_cancelled(
            state=state,
            reason=agent.agent_context.get_interruption_reason() or "cancelled",
            tool_call_id=tool_call_id,
            mode=mode,
        )
        async with handle.state_lock:
            await SubagentRuntimeStore.save_state(state)
        return state
    except Exception as e:
        _mark_failed(
            state=state,
            error=str(e),
            tool_call_id=tool_call_id,
            mode=mode,
        )
        async with handle.state_lock:
            await SubagentRuntimeStore.save_state(state)
        logger.exception(f"子 Agent {agent.agent_name}:{agent.id} 执行失败")
        return state
    finally:
        if agent.agent_context.is_interruption_requested():
            state.interrupt_requested = True
            state.interrupt_reason = agent.agent_context.get_interruption_reason()
            async with handle.state_lock:
                await SubagentRuntimeStore.save_state(state)
        agent.close()
        if current_task is not None:
            await subagent_session_manager.clear_run(agent.agent_name, agent.id, current_task)


def _mark_running(state: SubagentSessionState) -> None:
    state.status = SubagentStatus.RUNNING
    state.started_at = state.started_at or utc_now()
    state.interrupt_requested = False
    state.interrupt_reason = None


def _mark_done(
    state: SubagentSessionState,
    result: str,
    tool_call_id: str,
    mode: SubagentExecutionMode,
) -> None:
    state.status = SubagentStatus.DONE
    state.last_result = result
    state.last_error = None
    state.finished_at = utc_now()
    state.active_tool_call_id = None
    state.last_tool_call_id = tool_call_id or state.last_tool_call_id
    state.cached_tool_result = _build_payload(
        state=state,
        mode=mode,
        resume_hint="Pass the same agent_id to call_subagent to continue this conversation.",
    )


def _mark_cancelled(
    state: SubagentSessionState,
    reason: str,
    tool_call_id: str,
    mode: SubagentExecutionMode,
) -> None:
    state.status = SubagentStatus.INTERRUPTED
    state.last_error = reason
    state.finished_at = utc_now()
    state.interrupt_requested = True
    state.interrupt_reason = reason
    state.active_tool_call_id = None
    state.last_tool_call_id = tool_call_id or state.last_tool_call_id

    # reason == "cancelled" 表示 Task 被直接 cancel（用户点击终止），子 Agent context
    # 未设置 interruption_reason，不应提示主 Agent 自动重试
    is_user_cancel = not reason or reason == "cancelled"
    resume_hint = (
        "This sub-agent was stopped by user request. Do not call call_subagent again automatically — wait for the user's next instruction."
        if is_user_cancel
        else "Send a new prompt with the same agent_id to continue the conversation."
    )
    state.cached_tool_result = _build_payload(
        state=state,
        mode=mode,
        resume_hint=resume_hint,
    )


def _mark_failed(
    state: SubagentSessionState,
    error: str,
    tool_call_id: str,
    mode: SubagentExecutionMode,
) -> None:
    state.status = SubagentStatus.ERROR
    state.last_error = error
    state.finished_at = utc_now()
    state.active_tool_call_id = None
    state.last_tool_call_id = tool_call_id or state.last_tool_call_id
    state.cached_tool_result = _build_payload(
        state=state,
        mode=mode,
        resume_hint="Inspect the error and call call_subagent again with the same agent_id if needed.",
    )


def _build_status_remark(agent_id: str, status_text: str) -> str:
    """拼接 remark：agent_id · 状态文案。"""
    if agent_id:
        return f"{agent_id} · {status_text}"
    return status_text


_STATUS_EMOJI: Dict[str, str] = {
    "done": "✅",
    "error": "❌",
    "interrupted": "⚠️",
    "running": "⏳",
    "pending": "⏳",
    "idle": "💤",
}


def _build_subagent_tool_detail(
    agent_name: str,
    agent_id: str,
    status: str,
    agent_result: str,
    error: str,
    resume_hint: str,
) -> Optional[ToolDetail]:
    """构建子智能体终端风格详情卡片，供 before/after detail 复用。"""
    t = lambda key: i18n.translate(f"call_subagent.detail.{key}", category="tool.messages")
    status_emoji = _STATUS_EMOJI.get(status, "🔄")
    lines = []
    if agent_name:
        lines.append(f"{t('sub_agent')}: {agent_name}")
    if agent_id:
        lines.append(f"{t('session_id')}: {agent_id}")
    if status:
        lines.append(f"{t('status')}: {status_emoji} {status}")
    if agent_result:
        lines.append(f"\n{t('result')}:\n{agent_result}")
    if error:
        lines.append(f"\n{t('error')}: {error}")
    if resume_hint:
        lines.append(f"\n{t('next_step')}: {resume_hint}")
    content = "\n".join(lines)
    if not content.strip():
        return None
    exit_code = 1 if status == "error" else 0
    command = f"call_subagent {agent_name}/{agent_id}" if agent_name and agent_id else f"call_subagent {agent_name or agent_id}"
    return ToolDetail(
        type=DisplayType.TERMINAL,
        data=TerminalContent(
            command=command,
            output=content,
            exit_code=exit_code,
        ),
    )
