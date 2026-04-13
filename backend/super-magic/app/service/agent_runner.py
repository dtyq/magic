"""
公共 Agent 运行器

提取自 call_subagent，供 cron 等系统级服务直接调用，不依赖 ToolContext。
"""
import asyncio
from typing import Optional, TYPE_CHECKING

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.tools.subagent_runtime_models import SubagentSessionState, SubagentStatus, utc_now
from app.tools.subagent_runtime_store import SubagentRuntimeStore
from app.tools.subagent_session_manager import subagent_session_manager

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
    from app.magic.agent import Agent

logger = get_logger(__name__)


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


def _init_root_context(context: "AgentContext") -> None:
    """
    为系统级调用（cron 等）初始化最小 root context。
    从全局配置读取 sandbox_id，不依赖任何运行时父 context。
    """
    from agentlang.config.config import config
    sandbox_id = str(config.get("sandbox.id", "") or "")
    if sandbox_id:
        context.set_sandbox_id(sandbox_id)
    context.set_subagent_depth(0)


async def _run_subagent_task(
    agent: "Agent",
    prompt: str,
    handle,
) -> SubagentSessionState:
    """
    运行 sub-agent 并管理状态持久化。
    与 call_subagent._run_subagent 的区别：无 tool_call_id / mode / cached_tool_result，
    适合系统级调用（不需要工具调用幂等缓存）。
    """
    state = await SubagentRuntimeStore.load_state(agent.agent_name, agent.id)
    state.agent_name = agent.agent_name
    state.agent_id = agent.id
    _mark_running(state)
    async with handle.state_lock:
        await SubagentRuntimeStore.save_state(state)
    current_task = asyncio.current_task()

    try:
        result = await agent.run(prompt)
        state.status = SubagentStatus.DONE
        state.last_result = result or ""
        state.last_error = None
        state.finished_at = utc_now()
        state.active_tool_call_id = None
        async with handle.state_lock:
            await SubagentRuntimeStore.save_state(state)
        return state
    except asyncio.CancelledError:
        state.status = SubagentStatus.INTERRUPTED
        state.last_error = agent.agent_context.get_interruption_reason() or "cancelled"
        state.finished_at = utc_now()
        state.active_tool_call_id = None
        async with handle.state_lock:
            await SubagentRuntimeStore.save_state(state)
        return state
    except Exception as e:
        state.status = SubagentStatus.ERROR
        state.last_error = str(e)
        state.finished_at = utc_now()
        state.active_tool_call_id = None
        async with handle.state_lock:
            await SubagentRuntimeStore.save_state(state)
        logger.exception(f"sub-agent {agent.agent_name}:{agent.id} failed")
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


async def run_isolated_agent(
    agent_name: str,
    agent_id: str,
    prompt: str,
    parent_context: Optional["AgentContext"] = None,
    model_id: Optional[str] = None,
    image_model_id: Optional[str] = None,
) -> Optional[str]:
    """
    运行一个隔离 sub-agent，等待完成并返回结果。
    不依赖 ToolContext，可直接由内部服务调用。

    parent_context 为 None 时（cron 等系统级调用场景），
    内部创建独立的 root context，从全局配置读取必要参数，
    不继承任何运行时父 context。
    """
    from app.core.context.agent_context import AgentContext
    from app.magic.agent import Agent

    new_context = AgentContext(isolated=True)
    if parent_context is not None:
        _inherit_parent_context(new_context, parent_context, depth=parent_context.get_subagent_depth() + 1)
    else:
        _init_root_context(new_context)

    new_context.set_chat_history_dir(str(PathManager.get_subagents_chat_history_dir()))
    if model_id:
        new_context.set_dynamic_model_id(model_id)
    elif parent_context is not None and parent_context.has_dynamic_model_id():
        # 未指定模型时，继承父 Agent 的动态模型 ID
        new_context.set_dynamic_model_id(parent_context.get_dynamic_model_id())
    if image_model_id:
        new_context.set_dynamic_image_model_id(image_model_id)

    agent: Optional["Agent"] = None
    task: Optional[asyncio.Task] = None
    try:
        agent = Agent(agent_name, agent_id=agent_id, agent_context=new_context)
        handle = await subagent_session_manager.get_handle(agent_name, agent_id)

        async with handle.lock:
            task = asyncio.create_task(
                _run_subagent_task(agent=agent, prompt=prompt, handle=handle)
            )
            handle.task = task
            handle.agent_context = new_context
            state = await task
    except Exception:
        if agent is not None and task is None:
            agent.close()
        raise

    return state.last_result
