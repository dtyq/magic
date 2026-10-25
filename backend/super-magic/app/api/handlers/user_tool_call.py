"""user_tool_call 处理器：解析前端回传并恢复 Agent 推理。

所有 BaseUserToolCallTool 子类共用统一的 dispatch 流程。
工具特定逻辑（结果格式化、超时默认值等）通过 pending.result_builder 注入，无需在此注册 per-tool handler。
"""

import traceback
from typing import Any, Dict

from pydantic import BaseModel, Field, field_validator

from agentlang.logger import get_logger
from app.api.http_dto.response import BaseResponse, create_error_response, create_success_response
from app.core.exceptions.business import ErrorCode

logger = get_logger(__name__)


class UserToolCallPayload(BaseModel):
    """user_tool_call 消息体。

    前端发送格式：
    {
      "type": "user_tool_call",
      "user_tool_call": {
        "name": "ask_user",
        "tool_call_id": "xxx",
        "detail": { ... },
        "extra": { ... }
      }
    }
    """
    name: str
    tool_call_id: str
    detail: Dict[str, Any] = Field(default_factory=dict)
    extra: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("extra", mode="before")
    @classmethod
    def coerce_extra(cls, v: Any) -> Dict[str, Any]:
        # PHP 空数组序列化为 JSON []，兼容处理
        if isinstance(v, list):
            return {}
        return v

    @field_validator("detail", mode="before")
    @classmethod
    def coerce_detail(cls, v: Any) -> Dict[str, Any]:
        if isinstance(v, list):
            return {}
        return v


async def dispatch(payload: UserToolCallPayload) -> BaseResponse:
    """通用分发：根据 tool_call_id 找到 pending，提取 detail 后恢复 Agent 推理。"""
    from app.service.user_tool_call_service import UserToolCallService

    tool_call_id = payload.tool_call_id
    response_status: str = payload.detail.get("response_status", "answered")
    answer: str = payload.detail.get("answer", "")
    raw_remark = payload.detail.get("remark", "")
    # 备注仅作为本次提交的附加上下文，异常类型或纯空白内容按无备注处理。
    remark = raw_remark.strip() if isinstance(raw_remark, str) else ""

    logger.info(
        f"收到 user_tool_call: name={payload.name!r}, tool_call_id={tool_call_id}, "
        f"response_status={response_status}, answer={answer!r}"
    )

    try:
        service = UserToolCallService.get_instance()
        if payload.name == "ask_user" and service.idle_exit_requested:
            # 不能消费即将退出的环境中的问题，也不能把它误报成已结束。
            return create_error_response(
                "执行环境正在恢复，请稍后重试。",
                code=ErrorCode.USER_TOOL_CALL_ENVIRONMENT_CLOSING,
            )
        pending = await service.pop_pending_or_restore_from_latest_history(
            tool_name=payload.name,
            tool_call_id=tool_call_id,
        )
        if not pending:
            logger.warning(
                f"user_tool_call: tool_call_id={tool_call_id} not in pending, "
                "may have timed out or been submitted twice"
            )
            return create_error_response("这个问题已经结束，无法再提交。", code=ErrorCode.USER_TOOL_CALL_NOT_FOUND)

        service.schedule_resume(pending, response_status, answer, remark)
        return create_success_response("已收到你的回答，正在继续处理。")
    except Exception as e:
        logger.error(f"user_tool_call dispatch [{payload.name}] 异常: {e}")
        logger.error(traceback.format_exc())
        return create_error_response("提交失败，请稍后重试。")
