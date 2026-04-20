"""user_tool_call 处理器：解析前端回传并恢复 Agent 推理。

所有 BaseUserToolCallTool 子类共用统一的 dispatch 流程。
工具特定逻辑（结果格式化、超时默认值等）通过 pending.result_builder 注入，无需在此注册 per-tool handler。
"""

import asyncio
import traceback
from typing import Any, Dict

from pydantic import BaseModel, Field, field_validator

from agentlang.logger import get_logger
from app.api.http_dto.response import BaseResponse, create_error_response, create_success_response

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

    logger.info(
        f"收到 user_tool_call: name={payload.name!r}, tool_call_id={tool_call_id}, "
        f"response_status={response_status}, answer={answer!r}"
    )

    try:
        service = UserToolCallService.get_instance()
        pending = service.pop_pending(tool_call_id)
        if not pending:
            logger.warning(
                f"user_tool_call: tool_call_id={tool_call_id} not in pending, "
                "may have timed out or been submitted twice"
            )
            return create_error_response("问题不存在或已超时")

        pending.timeout_task.cancel()

        asyncio.create_task(
            service.resume_after_user_tool_call(
                pending=pending,
                response_status=response_status,
                answer=answer,
            ),
            name=f"user_tool_call_resume_{tool_call_id}",
        )
        return create_success_response(f"{payload.name} user_tool_call 已接收")
    except Exception as e:
        logger.error(f"user_tool_call dispatch [{payload.name}] 异常: {e}")
        logger.error(traceback.format_exc())
        return create_error_response(f"user_tool_call [{payload.name}] 处理失败")
