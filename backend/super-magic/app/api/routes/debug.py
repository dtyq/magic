"""Local debug-only maintenance routes."""

from fastapi import APIRouter

from agentlang.logger import get_logger
from agentlang.utils.file import clear_directory_contents
from app.api.http_dto.response import BaseResponse, create_error_response, create_success_response
from app.core.config.debug_config import is_local_debug_mode_enabled
from app.path_manager import PathManager

router = APIRouter(prefix="/v1/debug", tags=["本地调试"])
logger = get_logger(__name__)


@router.post("/clear-chat-history", response_model=BaseResponse)
async def clear_debug_chat_history() -> BaseResponse:
    """Clear local debug chat history on disk and in live agent memory."""
    if not is_local_debug_mode_enabled():
        return create_error_response(message="本地调试清理接口未启用")

    from app.service.agent_runtime_reset_service import AgentRuntimeResetService

    reset_results = await AgentRuntimeResetService.reset_all_live_contexts_for_local_debug()
    chat_history_dir = PathManager.get_chat_history_dir()
    ok = await clear_directory_contents(chat_history_dir)
    if not ok:
        logger.error(f"清理 .chat_history 失败: {chat_history_dir}")
        return create_error_response(message="清理历史对话记录失败")

    result_data = {"contexts": [item.to_dict() for item in reset_results]}
    failed_results = [item for item in reset_results if not item.ok]
    if failed_results:
        return create_error_response(
            message="历史文件已清理，但部分运行时状态重置失败",
            data=result_data,
        )

    return create_success_response(
        message="历史对话记录和运行时状态已清理",
        data=result_data,
    )
