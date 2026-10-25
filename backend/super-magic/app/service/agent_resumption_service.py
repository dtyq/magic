"""恢复已持久化的 Agent resumption，并提交一次内部继续运行。"""

from __future__ import annotations

import asyncio
import uuid
from typing import TYPE_CHECKING

from agentlang.logger import get_logger
from app.core.entity.message.client_message import ChatClientMessage, ContextType
from app.core.horizon.models import ResumptionTrigger

if TYPE_CHECKING:
    from app.service.agent_dispatcher import AgentDispatcher

logger = get_logger(__name__)


class AgentResumptionService:
    """在主 Agent 工作区恢复完成后，主动续跑一项持久化 resumption。"""

    @classmethod
    async def resume_pending(cls, dispatcher: "AgentDispatcher") -> None:
        context = dispatcher.agent_context
        if context is None or not context.is_interactive_main_agent_context():
            return
        if not dispatcher.is_workspace_initialized:
            return

        last_message = await dispatcher.get_last_dispatch_message()
        if not last_message:
            return

        # MOCK DEMO：恢复上一条 dispatch 配置，再把 prompt 改为内部 /resume。
        # 原始用户消息已经在 ChatHistory 中，/resume 不应再次写成用户消息。
        run_id = f"resumption-{uuid.uuid4().hex}"
        resumption = await context.horizon.assign_resumption(
            trigger=ResumptionTrigger.RUNTIME_READY,
            run_id=run_id,
        )
        if resumption is None:
            return

        try:
            message = ChatClientMessage(**last_message)
            message.prompt = "/resume"
            message.context_type = ContextType.CONTINUE
            message.message_id = f"agent-resumption-{uuid.uuid4().hex}"
            message.update_session = False
            await dispatcher.submit_message(
                message,
                resumption_id=resumption.id,
                resumption_run_id=run_id,
            )
            logger.info(
                "已提交 Agent resumption: resumption_id=%s run_id=%s",
                resumption.id,
                run_id,
            )
        except asyncio.CancelledError:
            await context.horizon.release_resumption(
                resumption.id,
                "Agent resumption submission was cancelled",
            )
            raise
        except Exception as error:
            await context.horizon.release_resumption(
                resumption.id,
                f"Agent resumption submission failed: {error}",
            )
            logger.warning(
                "提交 Agent resumption 失败: resumption_id=%s error=%s",
                resumption.id,
                error,
            )


__all__ = ["AgentResumptionService"]
