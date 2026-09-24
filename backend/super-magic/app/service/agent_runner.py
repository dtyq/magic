"""
公共 Agent 运行器

提取自 call_subagent，供 cron 等系统级服务直接调用，不依赖 ToolContext。
"""
import asyncio
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, TYPE_CHECKING

from agentlang.logger import get_logger
from agentlang.chat_history.session_config import SessionConfig
from app.core.models.agent_runtime import AgentLifetime, AgentTarget
from app.core.models.agent_session import AgentSessionRef
from app.core.models.media_model import ImageModelSpec, VideoModelSpec
from app.core.models.model_selection_policy import ModelSelectionInput, ModelSelectionPolicy
from app.path_manager import PathManager
from app.tools.subagent_runtime_models import SubagentSessionState, SubagentStatus, utc_now
from app.tools.subagent_runtime_store import SubagentRuntimeStore
from app.tools.subagent_session_manager import subagent_session_manager

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
    from app.magic.agent import Agent
    from app.service.agent_context_snapshot_service import AgentContextSnapshot

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class IsolatedAgentModelRequest:
    """调用方为隔离 Agent 指定的模型；未指定项继续走现有会话和默认模型选择。"""

    text_model_id: Optional[str] = None
    image: ImageModelSpec = field(default_factory=ImageModelSpec.empty)
    video: VideoModelSpec = field(default_factory=VideoModelSpec.empty)

    @classmethod
    def from_values(
        cls,
        *,
        text_model_id: Optional[str] = None,
        image_model_id: Optional[str] = None,
        video_model_id: Optional[str] = None,
        video_generation_config: Optional[dict[str, object]] = None,
    ) -> "IsolatedAgentModelRequest":
        return cls(
            text_model_id=text_model_id,
            image=ImageModelSpec.from_values(model_id=image_model_id),
            video=VideoModelSpec.from_values(
                model_id=video_model_id,
                video_generation_config=video_generation_config,
            ),
        )


@dataclass(frozen=True, slots=True)
class IsolatedAgentRunRequest:
    """一次隔离 Agent 运行所需的身份、输入和可选上下文。

    这个请求把“子 Agent 要运行什么”集中在一个对象里，避免调用方继续增加一长串
    相互关联的参数。两种典型输入如下：

        空白新 Agent:
            snapshot=None, parent_context=None

        fork 后运行:
            snapshot=完整快照, parent_context=可选的父运行环境

    `snapshot` 决定子 Agent 读哪些持久化上下文；`parent_context` 只传递 sandbox、组织和
    subagent 层级等运行边界，不把父 Agent 的 streams、活动任务或取消状态带过去。
    """

    target: AgentTarget
    agent_id: str
    prompt: str
    parent_context: Optional["AgentContext"] = None
    models: IsolatedAgentModelRequest = field(default_factory=IsolatedAgentModelRequest)
    snapshot: Optional["AgentContextSnapshot"] = None
    chat_history_dir: Optional[Path] = None


def apply_isolated_agent_model_selection(
    agent: "Agent",
    parent_context: Optional["AgentContext"] = None,
    models: Optional[IsolatedAgentModelRequest] = None,
) -> None:
    """按请求、父上下文/会话文档、Agent 默认值的优先级应用模型配置。

        本轮显式 model_id
                 ↓ 没有才使用
        父 Agent 当前模型（有 live parent）或目标 session.json（无 parent）
                 ↓ 仍然没有才使用
        Agent 自身配置的默认文本模型

    图片和视频模型还会沿用已有能力配置。例如请求只覆盖图片模型 ID 时，尺寸配置仍
    从父上下文或 session 文档补齐。这个选择发生在 Agent 启动后，但不会改变 fork 的
    三份持久化文件；它只决定本次运行最终使用的模型。
    """
    model_request = models or IsolatedAgentModelRequest()
    current_session_config = agent.chat_history.get_current_session_config()
    last_session_config = agent.chat_history.get_last_session_config()
    parent_model_context = parent_context.model_context if parent_context is not None else None

    selection = ModelSelectionPolicy.resolve(ModelSelectionInput(
        configured_text_model_id=agent.agent_context.model_context.configured_text_model_id,
        request_text_model_id=model_request.text_model_id,
        session_text_model_id=(
            parent_model_context.current_text_model_id
            if parent_model_context is not None
            else current_session_config.model_id or last_session_config.model_id
        ),
        request_image_model=model_request.image,
        session_image_model=(
            parent_model_context.image
            if parent_model_context is not None
            else _session_image_model(current_session_config, last_session_config)
        ),
        request_video_model=model_request.video,
        session_video_model=(
            parent_model_context.video
            if parent_model_context is not None
            else _session_video_model(current_session_config, last_session_config)
        ),
    ))
    agent.agent_context.model_context.apply_selection(selection)
    logger.info(
        "已为隔离 Agent 应用模型选择: "
        f"agent={agent.agent_name}, text={selection.text_model_id}, "
        f"image={selection.image_model_id or '-'}, video={selection.video_model_id or '-'}"
    )


async def run_isolated_agent(
    request: IsolatedAgentRunRequest,
) -> Optional[str]:
    """运行普通隔离 Agent。"""
    return await _run_isolated_agent(request, capture_compact_history_result=False)


async def run_compaction_agent(
    request: IsolatedAgentRunRequest,
) -> Optional[str]:
    """运行后台压缩 Agent，捕获 compact_chat_history 结果并禁止再次压缩。"""
    try:
        return await _run_isolated_agent(request, capture_compact_history_result=True)
    finally:
        if request.chat_history_dir is not None:
            from app.utils.async_file_utils import async_rmtree
            try:
                await async_rmtree(request.chat_history_dir)
            except Exception as error:
                logger.warning(f"后台压缩临时目录删除失败: {error}")


async def _run_isolated_agent(
    request: IsolatedAgentRunRequest,
    *,
    capture_compact_history_result: bool,
) -> Optional[str]:
    """
    运行一个隔离 sub-agent，等待完成并返回结果。
    不依赖 ToolContext，可直接由内部服务调用。

    parent_context 为 None 时（cron 等系统级调用场景），
    内部创建独立的 root context，从全局配置读取必要参数，
    不继承任何运行时父 context。

    普通和后台压缩入口共用本实现。压缩入口会捕获 compact_chat_history
    的 summary，并禁止已接近阈值的 fork Agent 再次触发压缩。

    启动顺序很重要：

        snapshot != None
            1. 先把快照写成目标会话的三份正式文件
            2. 再 acquire Agent，让 Agent 从目标文件正常加载
            3. 最后执行 prompt

        snapshot == None
            直接 acquire 一个空白或已有会话；不会凭空复制父 Agent 的历史。

    因此普通子 Agent、后台压缩 Agent 和 cron Agent 都复用同一条“写文件后启动”的
    路径；不同点只在 prompt、模型选择和压缩结果捕获方式。
    """
    from app.core.context.agent_context import AgentContext
    from app.service.agent_runtime import AgentRuntime
    from app.service.agent_context_snapshot_service import AgentContextSnapshotService

    target_session = AgentSessionRef(
        target=request.target,
        agent_id=request.agent_id,
        chat_history_dir=request.chat_history_dir or PathManager.get_subagent_chat_history_dir(
            request.target.agent_name, request.agent_id,
        ),
    )
    if request.snapshot is not None:
        await AgentContextSnapshotService().materialize(request.snapshot, target_session)

    new_context = AgentContext(isolated=True)
    if request.parent_context is not None:
        _inherit_parent_context(
            new_context,
            request.parent_context,
            depth=request.parent_context.get_subagent_depth() + 1,
        )
    else:
        _init_root_context(new_context)

    new_context.set_chat_history_dir(str(target_session.chat_history_dir))
    if request.models.image.model_id:
        new_context.set_dynamic_image_model_id(request.models.image.model_id)

    agent: Optional["Agent"] = None
    task: Optional[asyncio.Task] = None
    try:
        agent = await AgentRuntime.get_instance().acquire(
            target=request.target,
            lifetime=AgentLifetime.TRANSIENT,
            context=new_context,
            agent_id=request.agent_id,
        )
        apply_isolated_agent_model_selection(
            agent=agent,
            parent_context=request.parent_context,
            models=request.models,
        )
        if capture_compact_history_result:
            agent.enable_compact_history_capture()

        # 后台压缩 fork 的上下文已接近阈值，不能让它再次启动压缩任务
        if capture_compact_history_result:
            agent.compaction_config.enable_compaction = False

        handle = await subagent_session_manager.get_handle(
            request.target.agent_name,
            request.agent_id,
        )

        async with handle.lock:
            task = asyncio.create_task(
                _run_subagent_task(
                    agent=agent,
                    prompt=request.prompt,
                    handle=handle,
                    capture_compact_history_result=capture_compact_history_result,
                    chat_history_dir=target_session.chat_history_dir,
                )
            )
            handle.task = task
            handle.agent_context = new_context
            state = await task
    except asyncio.CancelledError:
        if agent is not None and task is None:
            agent.close()
        raise
    except Exception:
        if agent is not None and task is None:
            agent.close()
        raise

    return state.last_result


def _inherit_parent_context(
    child: "AgentContext",
    parent: Optional["AgentContext"],
    depth: int,
) -> None:
    """从父 Agent 继承必要配置，is_main_agent 保持 False，streaming 保持隔离。

    继承的是“运行环境边界”，不是“父任务本身”：

        继承: sandbox_id, organization_code, subagent_depth, parent_agent_name
        不继承: streams, task_id, streaming_sinks, 当前 tool call 和取消信号

    这样子 Agent 可以在同一工作区和组织权限下工作，但不会把输出写进父 Agent 的
    流，也不会因为父 Agent 的一次取消操作而共享同一个运行句柄。
    """
    if not parent:
        return
    if sandbox_id := parent.get_sandbox_id():
        child.set_sandbox_id(sandbox_id)
    if org_code := parent.get_organization_code():
        child.set_organization_code(org_code)
    child.set_subagent_depth(depth)
    child.set_subagent_parent_agent_name(parent.agent_name)
    child.set_subagent_parent_agent_id(parent.get_agent_id())
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


def _session_image_model(current: SessionConfig, last: SessionConfig) -> ImageModelSpec:
    model_id = current.image_model_id or last.image_model_id
    sizes = current.image_model_sizes if current.image_model_sizes is not None else last.image_model_sizes
    return ImageModelSpec.from_values(model_id=model_id, sizes=sizes)


def _session_video_model(current: SessionConfig, last: SessionConfig) -> VideoModelSpec:
    model_id = current.video_model_id or last.video_model_id
    video_generation_config = (
        current.video_generation_config
        if current.video_generation_config is not None
        else last.video_generation_config
    )
    return VideoModelSpec.from_values(
        model_id=model_id,
        video_generation_config=video_generation_config,
    )


async def _run_subagent_task(
    agent: "Agent",
    prompt: str,
    handle,
    capture_compact_history_result: bool = False,
    chat_history_dir: Optional[Path] = None,
) -> SubagentSessionState:
    """
    运行 sub-agent 并管理状态持久化。
    与 call_subagent._run_subagent 的区别：无 tool_call_id / mode / cached_tool_result，
    适合系统级调用（不需要工具调用幂等缓存）。
    """
    state = await SubagentRuntimeStore.load_state(agent.agent_name, agent.id, chat_history_dir)
    state.agent_name = agent.agent_name
    state.agent_id = agent.id
    state.parent_agent_name = agent.agent_context.get_subagent_parent_agent_name()
    state.parent_agent_id = agent.agent_context.get_subagent_parent_agent_id()
    _mark_running(state)
    async with handle.state_lock:
        await SubagentRuntimeStore.save_state(state, chat_history_dir)
    current_task = asyncio.current_task()

    try:
        result = await agent.run(prompt)
        if capture_compact_history_result:
            captured_summary = agent.get_captured_compact_summary()
            if captured_summary:
                state.status = SubagentStatus.DONE
                state.last_result = captured_summary
                state.last_error = None
            else:
                state.status = SubagentStatus.ERROR
                state.last_result = ""
                state.last_error = "compact_chat_history was not called with a valid summary"
        else:
            state.status = SubagentStatus.DONE
            state.last_result = result or ""
            state.last_error = None
        state.finished_at = utc_now()
        state.active_tool_call_id = None
        async with handle.state_lock:
            await SubagentRuntimeStore.save_state(state, chat_history_dir)
        return state
    except asyncio.CancelledError:
        state.status = SubagentStatus.INTERRUPTED
        state.last_error = agent.agent_context.get_interruption_reason() or "cancelled"
        state.finished_at = utc_now()
        state.active_tool_call_id = None
        async with handle.state_lock:
            await SubagentRuntimeStore.save_state(state, chat_history_dir)
        raise
    except Exception as e:
        state.status = SubagentStatus.ERROR
        state.last_error = str(e)
        state.finished_at = utc_now()
        state.active_tool_call_id = None
        async with handle.state_lock:
            await SubagentRuntimeStore.save_state(state, chat_history_dir)
        logger.exception(f"sub-agent {agent.agent_name}:{agent.id} failed")
        return state
    finally:
        if agent.agent_context.is_interruption_requested():
            state.interrupt_requested = True
            state.interrupt_reason = agent.agent_context.get_interruption_reason()
            async with handle.state_lock:
                await SubagentRuntimeStore.save_state(state, chat_history_dir)
        agent.close()
        if current_task is not None:
            await subagent_session_manager.clear_run(agent.agent_name, agent.id, current_task)
        from app.service.chat_history_cleanup_service import ChatHistoryCleanupService
        ChatHistoryCleanupService.trigger()


def _mark_running(state: SubagentSessionState) -> None:
    state.status = SubagentStatus.RUNNING
    state.started_at = state.started_at or utc_now()
    state.interrupt_requested = False
    state.interrupt_reason = None
