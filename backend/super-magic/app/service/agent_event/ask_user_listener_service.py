"""ask_user 持久化恢复监听器，在 AFTER_INIT 后恢复服务重启前未完成的超时定时器。"""

from agentlang.event.data import AfterInitEventData
from agentlang.event.event import Event, EventType
from agentlang.logger import get_logger

from app.core.context.agent_context import AgentContext
from app.service.agent_event.base_listener_service import BaseListenerService

logger = get_logger(__name__)


class AskUserListenerService:

    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        BaseListenerService.register_listeners(agent_context, {
            EventType.AFTER_INIT: AskUserListenerService._handle_after_init,
        })
        logger.info("已注册 ask_user 持久化恢复监听器")

    @staticmethod
    async def _handle_after_init(event: Event[AfterInitEventData]) -> None:
        try:
            agent_context = event.data.agent_context
            from app.service.ask_user_service import AskUserService
            await AskUserService.get_instance().restore_pending_from_disk(agent_context)
            logger.info("ask_user pending restore completed")
        except Exception as e:
            logger.warning(f"恢复 ask_user 超时定时器失败（不影响正常流程）: {e}")
