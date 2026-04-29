"""Local debug-only maintenance routes."""

from fastapi import APIRouter

from agentlang.logger import get_logger
from agentlang.utils.file import clear_directory_contents
from app.api.http_dto.response import BaseResponse, create_error_response, create_success_response
from app.core.context.agent_context_registry import AgentContextRegistry
from app.core.config.debug_config import is_local_debug_mode_enabled
from app.path_manager import PathManager

router = APIRouter(prefix="/v1/debug", tags=["本地调试"])
logger = get_logger(__name__)


async def _reset_live_agent_contexts() -> list[dict[str, object]]:
    """Reset in-memory agent state so cleared history cannot be written back."""
    reset_results: list[dict[str, object]] = []
    for agent_context in AgentContextRegistry.get_instance().list_contexts():
        session_label = agent_context.get_agent_session_label()
        result: dict[str, object] = {"session": session_label, "ok": True}
        try:
            await agent_context.stop_run(reason="local debug clear chat history")
            agent_context.reset_run_state()
            agent_context.reset_thinking_state()
            agent_context.clear_user_tool_call_pending()
            agent_context.set_pending_reply_state(None)
            agent_context.set_final_response(None)
            agent_context.set_final_task_state(None)

            chat_history = getattr(agent_context, "chat_history", None)
            if chat_history is not None:
                message_count = len(chat_history.messages)
                chat_history.messages.clear()
                result["cleared_messages"] = message_count

            horizon = getattr(agent_context, "horizon", None)
            if horizon is not None:
                await horizon.on_context_reset()
                result["horizon_reset"] = True
        except Exception as e:
            logger.error(f"重置内存中的 AgentContext 失败: {session_label}: {e}", exc_info=True)
            result["ok"] = False
            result["error"] = str(e)
        reset_results.append(result)
    return reset_results


@router.post("/clear-chat-history", response_model=BaseResponse)
async def clear_debug_chat_history() -> BaseResponse:
    """Clear local debug chat history on disk and in live agent memory."""
    if not is_local_debug_mode_enabled():
        return create_error_response(message="本地调试清理接口未启用")

    from app.service.user_tool_call_service import UserToolCallService

    cleared_pending_tool_calls = UserToolCallService.get_instance().clear_all_pending()
    reset_results = await _reset_live_agent_contexts()
    chat_history_dir = PathManager.get_chat_history_dir()
    ok = await clear_directory_contents(chat_history_dir)
    if not ok:
        logger.error(f"清理 .chat_history 失败: {chat_history_dir}")
        return create_error_response(message="清理历史对话记录失败")

    failed_results = [item for item in reset_results if not item.get("ok")]
    if failed_results:
        return create_error_response(
            message="历史文件已清理，但部分运行时状态重置失败",
            data={"contexts": reset_results, "cleared_pending_tool_calls": cleared_pending_tool_calls},
        )

    return create_success_response(
        message="历史对话记录和运行时状态已清理",
        data={"contexts": reset_results, "cleared_pending_tool_calls": cleared_pending_tool_calls},
    )
