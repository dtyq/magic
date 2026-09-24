import asyncio
import hashlib
from dataclasses import asdict, dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Dict, Optional

from pydantic import Field, field_validator, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, TerminalContent, ToolDetail
from app.core.models.agent_runtime import AgentLifetime, AgentProviderType, AgentTarget
from app.core.models.agent_session import AgentSessionRef
from app.core.subagent_delegation import is_custom_agent_code
from app.i18n import i18n
from app.path_manager import PathManager
from app.service.agent_runner import (
    IsolatedAgentModelRequest,
    _inherit_parent_context,
    apply_isolated_agent_model_selection,
)
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

logger = get_logger(__name__)

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
    from app.magic.agent import Agent

# 子 Agent 最大嵌套深度：1 表示只允许主 Agent 调用子 Agent，子 Agent 不能再调用子 Agent
_MAX_AGENT_DEPTH = 1


@dataclass(frozen=True)
class AgentDisplaySubject:
    kind: "AgentDisplayKind"
    name: str


class AgentDisplayKind(StrEnum):
    AGENT = "agent"
    CREW = "crew"


@dataclass(frozen=True)
class AgentTargetResolution:
    target: AgentTarget
    warning: Optional[str] = None


def _localize_agent_name(agent_name: str) -> str:
    """将 agent_name 翻译为当前语言的展示名称（如 magic → 通用智能体），未命中时原样返回。"""
    return i18n.translate(agent_name, category="tool.agent_names")


def _resolve_agent_target(
    params: "CallSubagentParams",
    parent: Optional["AgentContext"],
) -> AgentTargetResolution:
    """解析实际运行目标；fork 必须继承父 Agent 的运行时身份。

    这是保证“龙虾 fork 出去还是龙虾”的入口：

        fork=false -> 使用请求中的 agent_name 解析目标
        fork=true  -> 使用父 Agent 的完整 AgentTarget（provider + name）

    fork 时即使模型填了另一个名称，也不能把运行模式偷偷切成普通 Agent；最多返回
    warning 告知名称被忽略。上下文快照负责复制内容，AgentTarget 负责保留运行身份，
    两者缺一不可。
    """
    if not params.fork or parent is None:
        return AgentTargetResolution(target=AgentTarget.from_name(params.agent_name))

    parent_target = parent.get_agent_target()
    if parent_target is None:
        parent_target = AgentTarget.from_name(parent.agent_name)

    requested_name = params.agent_name.strip()
    if not requested_name or requested_name == parent_target.agent_name:
        return AgentTargetResolution(target=parent_target)

    try:
        requested_target = AgentTarget.from_name(requested_name)
    except ValueError:
        requested_target = None

    if requested_target == parent_target:
        return AgentTargetResolution(target=parent_target)

    warning = (
        f"Warning: fork=true uses the current agent `{parent_target.agent_name}`; "
        f"requested agent_name `{requested_name}` was ignored."
    )
    return AgentTargetResolution(target=parent_target, warning=warning)


def _append_warning(content: str, warning: Optional[str]) -> str:
    if not warning:
        return content
    return f"{content}\n{warning}"


class CallSubagentParams(BaseToolParams):
    agent_name: str = Field(
        ...,
        description="Agent name or marketplace code. Leave empty only when fork=true to inherit the current Agent."
    )
    agent_id: str = Field(
        ...,
        description="Human-readable base ID for a new session, or the exact final ID returned earlier when resuming.",
    )
    task_label: str = Field(
        ...,
        description="Short user-facing task label in the user's language. It is not the Agent name or session ID.",
    )
    prompt: str = Field(
        ...,
        description="Task instruction. Use a self-contained prompt for a blank session; use a directive for fork or resume.",
    )
    model_id: Optional[str] = Field(
        None,
        description="Override the model for this sub-agent. Defaults to inheriting the caller's model."
    )
    background: bool = Field(
        False,
        description="Run in the background and return immediately. Wait using the returned final agent_id."
    )
    fork: bool = Field(
        False,
        description="Create a new session with the current Agent's full context. Cannot combine with resume.",
    )
    resume: bool = Field(
        False,
        description="Continue an existing session by its exact returned final agent_id. False creates a new session.",
    )

    @model_validator(mode="after")
    def validate_lifecycle_intent(self) -> "CallSubagentParams":
        if self.fork and self.resume:
            raise ValueError("fork and resume cannot both be true")
        return self

    @field_validator("task_label")
    @classmethod
    def validate_task_label(cls, value: str) -> str:
        label = value.strip()
        if not label:
            raise ValueError("task_label must not be empty")
        if "\n" in label or "\r" in label:
            raise ValueError("task_label must be a single line")
        return label

    @field_validator("agent_id")
    @classmethod
    def validate_agent_id(cls, value: str) -> str:
        agent_id = value.strip()
        if not agent_id:
            raise ValueError("agent_id must not be empty")
        if "\n" in agent_id or "\r" in agent_id:
            raise ValueError("agent_id must be a single line")
        return agent_id


# Full model-facing usage guidance: agents/skills/subagents/SKILL.md
@tool(code_mode_only=True)
class CallSubagent(BaseTool[CallSubagentParams]):
    """Delegate a task to another Agent."""

    def is_visible_in_context(self, agent_context: "AgentContext") -> bool:
        return not agent_context.is_subagent_context()

    async def check_execution_permission(
        self,
        tool_context: ToolContext,
        params: CallSubagentParams,
    ) -> Optional[ToolResult]:
        parent = tool_context.get_extension("agent_context")
        if parent is not None and parent.is_subagent_context():
            return ToolResult.error(
                "Sub-agents cannot spawn other sub-agents. Complete the delegated task directly, "
                "or explain to the parent agent what additional delegation is needed."
            )
        return None

    async def execute(self, tool_context: ToolContext, params: CallSubagentParams) -> ToolResult:
        new_agent_context: Optional["AgentContext"] = None
        agent: Optional["Agent"] = None
        task: Optional[asyncio.Task] = None
        target_warning: Optional[str] = None
        try:
            from app.core.context.agent_context import AgentContext
            from app.service.agent_context_snapshot_service import AgentContextSnapshotService
            from app.service.agent_runtime import AgentRuntime
            from app.service.agent_session_id_service import AgentSessionIdService

            parent: Optional[AgentContext] = tool_context.get_extension("agent_context")
            target_resolution = _resolve_agent_target(params, parent)
            target = target_resolution.target
            target_warning = target_resolution.warning
            params.agent_name = target.agent_name

            # 深度检查：子 Agent 不允许再派发子 Agent
            current_depth = parent.get_subagent_depth() if parent else 0
            tool_call_id = tool_context.tool_call_id or ""
            if current_depth >= _MAX_AGENT_DEPTH:
                return ToolResult.error(_append_warning(
                    (
                        f"Sub-agent spawn depth limit reached ({current_depth}/{_MAX_AGENT_DEPTH}). "
                        "Sub-agents are not allowed to call call_subagent."
                    ),
                    target_warning,
                ))

            requested_agent_id = params.agent_id

            # 生命周期决策表：
            #
            #   fork  resume  输入 agent_id        实际行为
            #   ----  ------  ------------------  ------------------------------
            #   false false   基础名称/任意名称    新建空白会话，分配新的最终 ID
            #   true  false   基础名称              fork 当前完整上下文，分配新的最终 ID
            #   false true    已返回的完整 ID       继续这条已有会话
            #   true  true    任意                  拒绝，不能同时“新建”和“继续”
            #
            # `resume` 不能由“同名文件是否存在”推断。模型可能为一个新任务复用旧名称；
            # 若自动继续，会把无关任务写入旧会话。显式意图使新建和继续都可预测。
            # 例如：`market-research` 已经存在时，resume=false 仍创建 `market-research-2`；
            # 只有传入 `market-research-1` 且 resume=true，才会继续第一条会话。
            if params.resume:
                if not await AgentSessionIdService.session_exists(
                    params.agent_name,
                    requested_agent_id,
                ):
                    return ToolResult.error(_append_warning(
                        (
                            f"Cannot resume Agent session {params.agent_name}<{requested_agent_id}> "
                            "because it does not exist. Use resume=false to create a new session."
                        ),
                        target_warning,
                    ))
                params.agent_id = requested_agent_id
            else:
                params.agent_id = await AgentSessionIdService.allocate(
                    params.agent_name,
                    requested_agent_id,
                    request_id=tool_call_id or None,
                )

            handle = await subagent_session_manager.get_handle(params.agent_name, params.agent_id)
            async with handle.lock:
                prompt_digest = _digest_prompt(params.prompt)
                state = await SubagentRuntimeStore.load_state(params.agent_name, params.agent_id)
                state.agent_name = params.agent_name
                state.agent_id = params.agent_id
                state.parent_agent_name = parent.agent_name if parent is not None else None
                state.parent_agent_id = parent.get_agent_id() if parent is not None else None
                state.requested_agent_id = requested_agent_id
                state.resumed = params.resume
                state.task_label = params.task_label
                state.warning = target_resolution.warning
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
                            resume_hint=(
                                "Wait for the current sub-agent run to stop, then call call_subagent again "
                                "with this exact agent_id and resume=true."
                            ),
                        ))

                target_session = AgentSessionRef(
                    target=target,
                    agent_id=params.agent_id,
                    chat_history_dir=PathManager.get_subagent_chat_history_dir(
                        target.agent_name,
                        params.agent_id,
                    ),
                )
                if params.fork:
                    # fork 是“带着父 Agent 当前上下文创建新会话”，不是绑定或覆盖旧会话。
                    # snapshot service 会在任何目标文件已存在时拒绝本次创建。
                    if parent is None:
                        raise RuntimeError("fork=true requires a live parent AgentContext")
                    snapshot_service = AgentContextSnapshotService()
                    context_snapshot = await snapshot_service.capture(parent)
                    await snapshot_service.materialize(context_snapshot, target_session)

                new_agent_context = AgentContext(isolated=True)
                _inherit_parent_context(new_agent_context, parent, depth=current_depth + 1)
                new_agent_context.set_chat_history_dir(str(target_session.chat_history_dir))

                agent = await AgentRuntime.get_instance().acquire(
                    target=target,
                    lifetime=AgentLifetime.TRANSIENT,
                    context=new_agent_context,
                    agent_id=params.agent_id,
                )
                if target.provider_type == AgentProviderType.CREW:
                    profile_name = new_agent_context.get_agent_profile().name.strip()
                    state.display_name = profile_name or params.agent_name
                else:
                    state.display_name = None
                apply_isolated_agent_model_selection(
                    agent=agent,
                    parent_context=parent,
                    models=IsolatedAgentModelRequest(text_model_id=params.model_id),
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

                parent_context_id = parent.context_id if parent else ""
                child_ref = None
                if parent_context_id and parent is not None:
                    child_ref = await subagent_session_manager.register_child_run(
                        parent_context_id,
                        params.agent_name,
                        params.agent_id,
                    )

                    async def _interrupt_child_on_parent_stop() -> None:
                        await subagent_session_manager.interrupt_run(
                            params.agent_name,
                            params.agent_id,
                            reason=parent.get_interruption_reason() or "parent agent stopped",
                            timeout=10.0,
                        )

                    parent.register_run_cleanup(
                        f"subagent:{params.agent_name}:{params.agent_id}",
                        _interrupt_child_on_parent_stop,
                    )

                if parent_context_id and child_ref is not None:
                    def _schedule_unregister(_task: asyncio.Task) -> None:
                        asyncio.create_task(
                            subagent_session_manager.unregister_child_run(parent_context_id, child_ref)
                        )

                    task.add_done_callback(_schedule_unregister)

            if params.background:
                return _success_result(_build_payload(
                    state=state,
                    mode=SubagentExecutionMode.BACKGROUND,
                    resume_hint=(
                        "Sub-agent is running in background. Use wait_for_subagents(agent_ids) to block until it finishes. "
                        "For a later turn, pass this exact agent_id with resume=true."
                    ),
                ))

            result_state = await task
            return _success_result(_build_payload(
                state=result_state,
                mode=SubagentExecutionMode.SYNC,
                resume_hint="Pass this exact agent_id with resume=true to continue this conversation.",
            ))

        except asyncio.CancelledError:
            if agent is not None and task is None:
                agent.close()
            raise
        except Exception as e:
            if agent is not None and task is None:
                agent.close()
            logger.exception(f"调用智能体失败: {e!s}")
            if _contains_file_not_found_error(e):
                error_text = _build_subagent_not_available_text(params.agent_name)
            else:
                error_text = _build_call_subagent_error_text(
                    agent_name=params.agent_name,
                    agent_id=params.agent_id,
                )
            return ToolResult.error(
                _append_warning(error_text, target_warning),
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
        task_label = args.get("task_label", "")
        subject = _resolve_display_subject(agent_name)
        action = _build_subagent_action(subject)
        status_text = i18n.translate("call_subagent.status.accepted", category="tool.messages")
        return {"action": action, "remark": _build_status_remark(task_label, subject.name, agent_id, status_text)}

    async def get_before_tool_detail(
        self, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        args = arguments or {}
        agent_name = args.get("agent_name", "")
        agent_id = args.get("agent_id", "")
        task_label = args.get("task_label", "")
        prompt = args.get("prompt", "")
        background = args.get("background", False)
        model_id = _resolve_subagent_display_model_id(tool_context, args.get("model_id"))

        if not prompt:
            return None

        t = lambda key: i18n.translate(f"call_subagent.detail.{key}", category="tool.messages")
        subject = _resolve_display_subject(agent_name)
        lines = []
        if subject.name:
            lines.append(f"{t(_detail_subject_key(subject))}: {subject.name}")
        if task_label:
            lines.append(f"{t('task_label')}: {task_label}")
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
        task_label = args.get("task_label", "")

        if result.ok:
            data = result.data if isinstance(result.data, dict) else {}
            status = data.get("status", "")
            task_label = data.get("task_label") or task_label
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
            data = {}

        subject = _resolve_display_subject(agent_name, payload=data)
        return _build_subagent_tool_detail(
            agent_name,
            agent_id,
            task_label,
            subject,
            status,
            agent_result,
            error,
            resume_hint,
        )

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
        task_label = args.get("task_label", "")
        payload = result.data if result.ok and isinstance(result.data, dict) else None
        subject = _resolve_display_subject(agent_name, payload=payload)
        action = _build_subagent_action(subject)

        if not result.ok:
            status_text = i18n.translate("call_subagent.status.failed", category="tool.messages")
            return {"action": action, "remark": _build_status_remark(task_label, subject.name, agent_id, status_text)}

        payload = payload or {}
        task_label = payload.get("task_label") or task_label
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
        return {"action": action, "remark": _build_status_remark(task_label, subject.name, agent_id, status_text)}


def _mode_from_background(background: bool) -> SubagentExecutionMode:
    return SubagentExecutionMode.BACKGROUND if background else SubagentExecutionMode.SYNC


def _digest_prompt(prompt: str) -> str:
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()


def _resolve_subagent_display_model_id(tool_context: ToolContext, explicit_model_id: Optional[str]) -> Optional[str]:
    if isinstance(explicit_model_id, str) and explicit_model_id.strip():
        return explicit_model_id.strip()
    parent: Optional["AgentContext"] = tool_context.get_extension("agent_context") if tool_context else None
    if parent is None:
        return None
    # 展示模型表示用户选择或继承到的入口模型。子 Agent 会独立走运行时模型解析，
    # 这里不提前替换成父 Agent 解析后的 provider 模型，避免 UI/日志失去用户选择语义。
    return parent.model_context.current_text_model_id


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
        if not state.cached_tool_result.task_label:
            state.cached_tool_result.task_label = state.task_label
        if not state.cached_tool_result.display_name:
            state.cached_tool_result.display_name = state.display_name
        state.cached_tool_result.warning = state.warning
        return state.cached_tool_result
    if state.active_tool_call_id == tool_call_id and state.status == SubagentStatus.INTERRUPTED:
        return _build_payload(
            state=state,
            mode=_mode_from_background(background),
            resume_hint=(
                "The previous sub-agent run was interrupted. Send a new prompt with this exact agent_id "
                "and resume=true to continue the conversation."
            ),
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
        requested_agent_id=state.requested_agent_id,
        resumed=state.resumed,
        task_label=state.task_label,
        display_name=state.display_name,
        result=state.last_result,
        error=error or state.last_error,
        resume_hint=resume_hint,
        warning=state.warning,
    )


def _success_result(payload: SubagentPayload) -> ToolResult:
    return ToolResult(
        content=_build_payload_text(payload),
        data=asdict(payload),
    )


def _build_payload_text(payload: SubagentPayload) -> str:
    # 基础 ID 只是请求名，最终 ID 才是下一次 wait/resume 使用的真实地址。
    # 同时输出两者，是为了处理 `research` 被系统分配为 `research-3` 的场景。
    if payload.resumed:
        identity_line = (
            f"Resumed sub-agent `{payload.agent_name}` with agent_id `{payload.agent_id}`. "
            "This is the existing session requested by the call."
        )
    else:
        requested_id = payload.requested_agent_id or payload.agent_id
        identity_line = (
            f"Created a new sub-agent session for `{payload.agent_name}`. "
            f"Requested agent_id base: `{requested_id}`. "
            f"Assigned final agent_id: `{payload.agent_id}`. "
            f"Use this exact final ID with resume=true for any later continuation."
        )

    lines = [
        identity_line,
        f"Task: `{payload.task_label or payload.agent_id}`.",
        f"Status: `{payload.status}`.",
        f"Execution mode: `{payload.mode}`.",
    ]
    if payload.warning:
        lines.append(payload.warning)
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


def _build_subagent_not_available_text(agent_name: str) -> str:
    return (
        f"Sub-agent `{agent_name}` is not available locally and is not a valid marketplace custom Agent code. "
        "Use a built-in agent name such as magic, explore, shell, or search; "
        "or call find_agents to choose a Crew digital employee, then pass its SMA-... code directly to call_subagent."
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
        raise
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
        from app.service.chat_history_cleanup_service import ChatHistoryCleanupService
        ChatHistoryCleanupService.trigger()


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
        resume_hint="Pass this exact agent_id with resume=true to continue this conversation.",
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
        else "Send a new prompt with this exact agent_id and resume=true to continue the conversation."
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
        resume_hint="Inspect the error and use this exact agent_id with resume=true if the same session should continue.",
    )


def _build_status_remark(
    task_label: Optional[str],
    subject_name: str,
    agent_id: str,
    status_text: str,
) -> str:
    """拼接 remark：任务标签优先，其次展示名和 agent_id。"""
    label = (task_label or "").strip()
    subject = (subject_name or "").strip()
    fallback = label or subject or agent_id
    if label and subject:
        return f"{label} · {subject} · {status_text}"
    if fallback:
        return f"{fallback} · {status_text}"
    return status_text


def _contains_file_not_found_error(error: BaseException) -> bool:
    """Return whether an error or its chained cause is a missing Agent definition."""
    current: BaseException | None = error
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        if isinstance(current, FileNotFoundError):
            return True
        current = current.__cause__ or current.__context__
    return False


def _display_subject(
    agent_name: str,
    display_name: Optional[str] = None,
) -> AgentDisplaySubject:
    if is_custom_agent_code(agent_name):
        return AgentDisplaySubject(
            kind=AgentDisplayKind.CREW,
            name=(display_name or "").strip() or agent_name.strip(),
        )
    return AgentDisplaySubject(kind=AgentDisplayKind.AGENT, name=_localize_agent_name(agent_name) if agent_name else "")


def _display_subject_from_payload(
    agent_name: str,
    payload: Optional[dict[str, Any]],
) -> AgentDisplaySubject:
    display_name = payload.get("display_name") if payload else None
    return _display_subject(
        agent_name,
        display_name if isinstance(display_name, str) else None,
    )


def _resolve_display_subject(
    agent_name: str,
    payload: Optional[dict[str, Any]] = None,
) -> AgentDisplaySubject:
    return _display_subject_from_payload(agent_name, payload)


def _build_subagent_action(subject: AgentDisplaySubject) -> str:
    """Return the action label for a call_subagent invocation."""
    if subject.kind == AgentDisplayKind.CREW:
        return i18n.translate("call_subagent.crew", category="tool.actions")
    if subject.name:
        return i18n.translate(
            "call_subagent.assign",
            category="tool.messages",
            agent_name=subject.name,
        )
    return i18n.translate("call_subagent", category="tool.actions")


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
    task_label: str,
    subject: AgentDisplaySubject,
    status: str,
    agent_result: str,
    error: str,
    resume_hint: str,
) -> Optional[ToolDetail]:
    """构建子智能体终端风格详情卡片，供 before/after detail 复用。"""
    t = lambda key: i18n.translate(f"call_subagent.detail.{key}", category="tool.messages")
    status_emoji = _STATUS_EMOJI.get(status, "🔄")
    agent_label = subject.name or (_localize_agent_name(agent_name) if agent_name else "")
    lines = []
    if agent_label:
        lines.append(f"{t(_detail_subject_key(subject))}: {agent_label}")
    if task_label:
        lines.append(f"{t('task_label')}: {task_label}")
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


def _detail_subject_key(subject: AgentDisplaySubject) -> str:
    return "crew" if subject.kind == AgentDisplayKind.CREW else "sub_agent"
