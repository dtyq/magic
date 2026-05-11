"""Agent runtime reset service.

本服务统一管理“运行时状态如何重置”，避免 /reset、debug 清理、新会话入口各自拼接清理步骤。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.core.context.agent_context_registry import AgentContextRegistry
from app.service.user_tool_call_service import UserToolCallService

logger = get_logger(__name__)


class ResetReason(StrEnum):
    NEW_SESSION = "new_session"
    LOCAL_DEBUG_CLEAR = "local_debug_clear"


@dataclass
class AgentRuntimeResetResult:
    session: str
    ok: bool = True
    stopped_run: bool = False
    cleared_messages: int = 0
    cleared_pending_tool_calls: int = 0
    horizon_reset: bool = False
    error: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "session": self.session,
            "ok": self.ok,
            "stopped_run": self.stopped_run,
            "cleared_messages": self.cleared_messages,
            "cleared_pending_tool_calls": self.cleared_pending_tool_calls,
            "horizon_reset": self.horizon_reset,
            "error": self.error,
            "details": self.details,
        }


class AgentRuntimeResetService:
    """统一的 Agent 运行时状态重置服务。"""

    @classmethod
    async def reset_session_context(
        cls,
        agent_context: AgentContext,
        *,
        reason: ResetReason,
        stop_run: bool,
        clear_chat_history: bool = True,
        reset_horizon: bool = True,
    ) -> AgentRuntimeResetResult:
        session = agent_context.get_agent_session_label()
        result = AgentRuntimeResetResult(session=session)
        try:
            if stop_run:
                await agent_context.stop_run(reason=reason.value)
                result.stopped_run = True

            agent_context.reset_run_state()
            agent_context.reset_thinking_state()
            agent_context.set_pending_reply_state(None)
            agent_context.set_final_response(None)
            agent_context.set_final_task_state(None)

            result.cleared_pending_tool_calls = (
                UserToolCallService.get_instance().clear_pending_for_context(agent_context)
            )
            agent_context.clear_user_tool_call_pending()

            if clear_chat_history:
                chat_history = getattr(agent_context, "chat_history", None)
                if chat_history is not None:
                    result.cleared_messages = len(chat_history.messages)
                    chat_history.messages.clear()

            if reset_horizon:
                horizon = getattr(agent_context, "horizon", None)
                if horizon is not None:
                    await horizon.on_context_reset()
                    result.horizon_reset = True

            return result
        except Exception as e:
            logger.error(f"Agent runtime reset failed: {session}: {e}", exc_info=True)
            result.ok = False
            result.error = str(e)
            return result

    @classmethod
    async def reset_all_live_contexts_for_local_debug(cls) -> list[AgentRuntimeResetResult]:
        results: list[AgentRuntimeResetResult] = []
        for agent_context in AgentContextRegistry.get_instance().list_contexts():
            result = await cls.reset_session_context(
                agent_context,
                reason=ResetReason.LOCAL_DEBUG_CLEAR,
                stop_run=True,
                clear_chat_history=True,
                reset_horizon=True,
            )
            results.append(result)

        orphan_pending_count = UserToolCallService.get_instance().clear_all_pending()
        if orphan_pending_count and results:
            results[0].details["orphan_pending_tool_calls"] = orphan_pending_count
        elif orphan_pending_count:
            results.append(
                AgentRuntimeResetResult(
                    session="__orphan_user_tool_call__",
                    cleared_pending_tool_calls=orphan_pending_count,
                    details={"orphan_pending_tool_calls": orphan_pending_count},
                )
            )
        return results
