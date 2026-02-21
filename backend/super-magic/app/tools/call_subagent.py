import asyncio
import hashlib
import json
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.paths import PathManager
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.tools.subagent_runtime_models import SubagentSessionState
from app.tools.subagent_runtime_store import SubagentRuntimeStore
from app.tools.subagent_session_manager import subagent_session_manager

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
        description="Override the LLM model. Defaults to the model defined in the .agent config."
    )
    background: bool = Field(
        False,
        description=(
            "If true, dispatch sub-agent as background asyncio task and return immediately. "
            "Use get_sub_agent_results(agent_ids=[agent_id]) to poll result later. "
            "Use this for ALL parallel workloads — call multiple agents with background=True "
            "sequentially, they run concurrently regardless of whether the model supports "
            "parallel tool call output. Also used for in-process scheduler tasks."
        )
    )


@tool()
class CallSubagent(BaseTool[CallSubagentParams]):
    """Call another agent to complete a task. Each sub-agent runs with an isolated context and its own chat history."""

    async def execute(self, tool_context: ToolContext, params: CallSubagentParams) -> ToolResult:
        try:
            from app.core.context.agent_context import AgentContext
            from app.magic.agent import Agent

            # 深度检查：子 Agent 不允许再派发子 Agent
            parent: Optional[AgentContext] = tool_context.get_extension("agent_context")
            current_depth = parent.get_subagent_depth() if parent else 0
            tool_call_id = tool_context.tool_call_id or ""
            if current_depth >= _MAX_AGENT_DEPTH:
                return ToolResult(error=(
                    f"Sub-agent spawn depth limit reached ({current_depth}/{_MAX_AGENT_DEPTH}). "
                    "Sub-agents are not allowed to call call_subagent."
                ))

            handle = await subagent_session_manager.get_handle(params.agent_name, params.agent_id)
            async with handle.lock:
                prompt_digest = _digest_prompt(params.prompt)
                state = await SubagentRuntimeStore.load_state(params.agent_name, params.agent_id)
                state.agent_name = params.agent_name
                state.agent_id = params.agent_id
                if state.status == "running" and not handle.is_running():
                    state.status = "interrupted"
                    state.last_error = state.last_error or "process_restarted_or_task_missing"
                    state.finished_at = state.finished_at or _now_iso()
                    state.active_tool_call_id = None
                    async with handle.state_lock:
                        await SubagentRuntimeStore.save_state(state)

                restored_result = _restore_if_same_tool_call(
                    state,
                    tool_call_id,
                    params.background,
                    prompt_digest,
                )
                if restored_result is not None:
                    return ToolResult(content=json.dumps(restored_result, ensure_ascii=False))

                if handle.is_running():
                    interrupted = await subagent_session_manager.interrupt_run(
                        params.agent_name,
                        params.agent_id,
                        reason="同一子 Agent 会话收到新消息，终止当前执行后继续",
                        timeout=10.0,
                    )
                    if not interrupted:
                        state.status = "error"
                        state.last_error = "interrupt_timeout"
                        state.finished_at = _now_iso()
                        state.last_tool_call_id = tool_call_id or state.last_tool_call_id
                        async with handle.state_lock:
                            await SubagentRuntimeStore.save_state(state)
                        return ToolResult(content=json.dumps(_build_payload(
                            state=state,
                            mode=_mode_from_background(params.background),
                            error="interrupt_timeout",
                            resume_hint="Wait for the current sub-agent run to stop, then call call_subagent again.",
                        ), ensure_ascii=False))

                new_agent_context = AgentContext(isolated=True)
                _inherit_parent_context(new_agent_context, parent, depth=current_depth + 1)
                new_agent_context.set_chat_history_dir(str(PathManager.get_subagents_chat_history_dir()))

                if params.model_id:
                    new_agent_context.set_dynamic_model_id(params.model_id)

                agent = Agent(
                    params.agent_name,
                    agent_id=params.agent_id,
                    agent_context=new_agent_context,
                )

                state.created_at = state.created_at or _now_iso()
                state.started_at = _now_iso()
                state.finished_at = None
                state.status = "pending" if params.background else "running"
                state.last_prompt_digest = prompt_digest
                state.last_error = None
                state.last_result = None
                state.active_tool_call_id = tool_call_id or None
                state.interrupt_requested = False
                state.interrupt_reason = None
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
                return ToolResult(content=json.dumps(_build_payload(
                    state=state,
                    mode="background",
                    resume_hint="Sub-agent is running in background. Use get_sub_agent_results(agent_ids) when you need the result.",
                ), ensure_ascii=False))

            result_state = await task
            return ToolResult(content=json.dumps(_build_payload(
                state=result_state,
                mode="sync",
                resume_hint="Pass the same agent_id to call_subagent to continue this conversation.",
            ), ensure_ascii=False))

        except Exception as e:
            logger.exception(f"调用智能体失败: {e!s}")
            return ToolResult(error=f"Failed to call agent: {e!s}")

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
        action = i18n.translate("call_subagent", category="tool.actions")
        if not result.ok:
            return {
                "action": action,
                "remark": i18n.translate("call_subagent.error", category="tool.messages", error=result.content),
            }
        agent_name = (arguments or {}).get("agent_name", "")
        remark = i18n.translate("call_subagent.start", category="tool.messages", agent_name=agent_name) if agent_name \
            else i18n.translate("call_subagent.unknown_agent", category="tool.messages")
        return {"action": action, "remark": remark}


def _inherit_parent_context(
    child: "AgentContext",
    parent: Optional["AgentContext"],
    depth: int,
) -> None:
    """从父 Agent 继承必要配置，is_main_agent 保持 False，streaming 保持隔离。"""
    if not parent:
        return
    if sandbox_id := parent.get_sandbox_id():
        child.set_sandbox_id(sandbox_id)
    if org_code := parent.get_organization_code():
        child.set_organization_code(org_code)
    child.set_subagent_depth(depth)
    child.set_subagent_parent_agent_name(parent.get_agent_name())
    # 不继承 streams、task_id、streaming_sinks，保持子 Agent 事件完全隔离


def _mode_from_background(background: bool) -> str:
    return "background" if background else "sync"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _digest_prompt(prompt: str) -> str:
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()


def _restore_if_same_tool_call(
    state: SubagentSessionState,
    tool_call_id: str,
    background: bool,
    prompt_digest: str,
) -> Optional[Dict[str, Any]]:
    if not tool_call_id:
        return None
    if (
        state.active_tool_call_id == tool_call_id
        and state.status in {"pending", "running"}
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
    if state.active_tool_call_id == tool_call_id and state.status == "interrupted":
        return _build_payload(
            state=state,
            mode=_mode_from_background(background),
            resume_hint="The previous sub-agent run was interrupted. Send a new prompt to continue the conversation.",
        )
    return None


def _build_payload(
    state: SubagentSessionState,
    mode: str,
    error: Optional[str] = None,
    resume_hint: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "agent_name": state.agent_name,
        "agent_id": state.agent_id,
        "status": state.status,
        "mode": mode,
        "result": state.last_result,
        "error": error or state.last_error,
        "resume_hint": resume_hint,
    }


async def _run_subagent(
    agent: "Agent",
    prompt: str,
    tool_call_id: str,
    mode: str,
    handle,
) -> SubagentSessionState:
    state = await SubagentRuntimeStore.load_state(agent.agent_name, agent.id)
    state.agent_name = agent.agent_name
    state.agent_id = agent.id
    state.status = "running"
    state.started_at = state.started_at or _now_iso()
    state.interrupt_requested = False
    state.interrupt_reason = None
    async with handle.state_lock:
        await SubagentRuntimeStore.save_state(state)
    current_task = asyncio.current_task()

    try:
        result = await agent.run(prompt)
        state.status = "done"
        state.last_result = result or ""
        state.last_error = None
        state.finished_at = _now_iso()
        state.active_tool_call_id = None
        state.last_tool_call_id = tool_call_id or state.last_tool_call_id
        state.cached_tool_result = _build_payload(
            state=state,
            mode=mode,
            resume_hint="Pass the same agent_id to call_subagent to continue this conversation.",
        )
        async with handle.state_lock:
            await SubagentRuntimeStore.save_state(state)
        return state
    except asyncio.CancelledError:
        state.status = "interrupted"
        state.last_error = agent.agent_context.get_interruption_reason() or "cancelled"
        state.finished_at = _now_iso()
        state.interrupt_requested = True
        state.interrupt_reason = state.last_error
        state.active_tool_call_id = None
        state.last_tool_call_id = tool_call_id or state.last_tool_call_id
        state.cached_tool_result = _build_payload(
            state=state,
            mode=mode,
            resume_hint="Send a new prompt with the same agent_id to continue the conversation.",
        )
        async with handle.state_lock:
            await SubagentRuntimeStore.save_state(state)
        return state
    except Exception as e:
        state.status = "error"
        state.last_error = str(e)
        state.finished_at = _now_iso()
        state.active_tool_call_id = None
        state.last_tool_call_id = tool_call_id or state.last_tool_call_id
        state.cached_tool_result = _build_payload(
            state=state,
            mode=mode,
            resume_hint="Inspect the error and call call_subagent again with the same agent_id if needed.",
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
        if current_task is not None:
            await subagent_session_manager.clear_run(agent.agent_name, agent.id, current_task)
