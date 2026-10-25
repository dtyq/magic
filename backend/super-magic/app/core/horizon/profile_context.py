"""Horizon 中的运行身份及用户变化；构建文本不会触发网络请求。"""

import html
from enum import StrEnum
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict

from app.core.entity.user_context import UserAccountDataStatus, UserContext, UserContextSnapshot

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext


class AgentExecutionRole(StrEnum):
    MAIN_AGENT = "main_agent"
    SUBAGENT = "subagent"


class AgentIdentityState(BaseModel):
    model_config = ConfigDict(frozen=True)

    runtime_kind: str
    runtime_agent: str
    session_id: str
    execution_role: AgentExecutionRole
    user_facing_name: str = ""
    profile_role: str = ""
    parent_session: str = ""
    managed_agent_code: str = ""


def build_agent_identity(context: "AgentContext") -> AgentIdentityState | None:
    target = context.get_agent_target()
    if target is None:
        return None
    return AgentIdentityState(
        runtime_kind=target.provider_type.value,
        runtime_agent=target.agent_name,
        session_id=context.get_agent_id() or "",
        execution_role=AgentExecutionRole.SUBAGENT if context.get_subagent_depth() > 0 else AgentExecutionRole.MAIN_AGENT,
        user_facing_name=context.get_user_facing_agent_name(target),
        profile_role=context.get_agent_profile().role,
        parent_session=context.get_subagent_parent_agent_id() or "",
        managed_agent_code=(context.get_agent_code() or "") if target.agent_name == "crew-creator" else "",
    )


# 子 Agent 的工作边界随身份块注入：派活提示词写得再差，这段也一定在场。
# 例：并行派 3 个子 Agent 各写一章，都发现总览页过期。
# 没有边界时，3 个都去重建总览页，还各自建一套脚本目录；有边界时，3 个只写自己的章，在最终回复里报告总览页过期。
_SUBAGENT_BOUNDARY_LINES = (
    "You are a delegated subagent. User messages in this session are tasks from the parent agent, "
    "not a conversation with the end user, and you cannot talk to the user.",
    "Do exactly the delegated task. Anything the task does not state is out of scope.",
    "Do not create files, directories, scripts, helper tools, or caches the task did not ask for. "
    "If you truly need a temporary file, delete it before you finish.",
    "Do not repair, rebuild, reformat, or improve anything outside your assigned target, even when it looks "
    "broken, outdated, duplicated, or inconsistent. Report it instead of fixing it.",
    "Other subagents may be working in the same workspace at the same time. Files you did not create may be "
    "mid-write or incomplete; that is not a reason to take over. Only the parent agent has the full plan.",
    "Doing more than asked is not better. Finishing exactly the assigned scope is the success condition.",
    "End with what you completed, the paths of key deliverable files the user would care about "
    "(not temporary or intermediate files), and anything you noticed but deliberately left untouched.",
)

# fork 会话继承了父 Agent 的完整历史，模型容易把自己当成那个在和用户对话的主 Agent，
# 接着兑现历史里的承诺、继续没做完的事。这段只在 fork 时追加。
_INHERITED_HISTORY_LINES = (
    "This session inherited the parent agent's conversation history as background reference only.",
    "You are not the agent that talked to the user in that history. Its unfinished items, promises, and plans "
    "belong to the parent agent. Only the latest delegated task is yours.",
)


def render_agent_identity(identity: AgentIdentityState, inherited_history: bool = False) -> str:
    lines = [
        f"Runtime kind: {identity.runtime_kind}",
        f"Runtime agent: {identity.runtime_agent}",
        f"Session ID: {identity.session_id}",
        f"Execution role: {identity.execution_role.value}",
        f"User-facing name: {identity.user_facing_name or 'not provided'}",
    ]
    if identity.user_facing_name:
        lines.append("Use the user-facing name when introducing yourself.")
    if identity.profile_role:
        lines.append(f"Profile role: {identity.profile_role}")
    if identity.execution_role == AgentExecutionRole.SUBAGENT:
        lines.append(f"Parent session: {identity.parent_session or 'not provided'}")
        lines.extend(_SUBAGENT_BOUNDARY_LINES)
        if inherited_history:
            lines.extend(_INHERITED_HISTORY_LINES)
    if identity.runtime_agent == "crew-creator":
        lines.append("You create or edit digital employees. The managed employee is not your own runtime identity.")
        if identity.managed_agent_code:
            lines.append(f"Managed agent code: {identity.managed_agent_code}")
    elif identity.runtime_agent == "skill-creator":
        lines.append("Your role is to create or edit Skills.")
    return "<agent_identity>\n" + html.escape("\n".join(lines), quote=False) + "\n</agent_identity>"


def _business_values(context: UserContext | None) -> dict[str, object]:
    if context is None:
        return {}
    return context.model_dump(mode="json", exclude={
        "captured_at": True,
        "subscription": {"captured_at"},
        "points": {"captured_at"},
    })


def render_user_context(
    current: UserContextSnapshot | None,
    baseline: UserContextSnapshot | None,
) -> str:
    from app.service.user_context_service import UserContextService, format_context_time
    if current is None:
        return ""
    same_subject = baseline is not None and (
        current.user_id == baseline.user_id and current.organization_code == baseline.organization_code
    )
    if same_subject and baseline is not None and current.status == baseline.status:
        if _business_values(current.context) == _business_values(baseline.context):
            return ""

    lines = [f"Service user: {current.user_id or 'unavailable'}; organization: {current.organization_code or 'unavailable'}."]
    if current.status == UserAccountDataStatus.UNAVAILABLE:
        lines.append(f"Profile refresh failed at {format_context_time(current.attempted_at)}.")
        if current.context is not None:
            lines.append("The following is the last successful snapshot, with its original query times; it is not a fresh result.")
            lines.append(UserContextService.format_content(current.context))
        else:
            lines.append("No authenticated user profile is available. Do not treat a previous session's profile as current.")
    elif current.context is not None:
        if baseline is not None and same_subject:
            if baseline.status == UserAccountDataStatus.UNAVAILABLE:
                lines.append("The user query is available again.")
            if baseline.context is not None:
                old, new = baseline.context, current.context
                removed = [
                    name for name, value in new.user.model_dump().items()
                    if not value and old.user.model_dump().get(name)
                ]
                if removed:
                    lines.append("Profile fields removed or no longer provided: " + ", ".join(removed) + ".")
                if (
                    old.points.status == new.points.status == UserAccountDataStatus.AVAILABLE
                    and old.points.scope == new.points.scope
                    and old.points.available != new.points.available
                ):
                    lines.append(f"Visible points changed: {old.points.available:,} → {new.points.available:,}.")
        else:
            lines.append("This is the current service user's complete profile; earlier subjects must not be treated as current.")
        lines.append(UserContextService.format_content(current.context))

    tag = "user_context_changed" if same_subject else "user_context"
    return f"<{tag}>\n" + html.escape("\n".join(lines), quote=False) + f"\n</{tag}>"
