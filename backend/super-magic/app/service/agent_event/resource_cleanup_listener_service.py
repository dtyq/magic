"""
资源清理监听器服务，用于清理agent context里面的attachments
"""

from agentlang.event.data import AfterMainAgentRunEventData
from agentlang.event.event import Event, EventType
from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.service.agent_event.base_listener_service import BaseListenerService

logger = get_logger(__name__)


class ResourceCleanupListenerService:
    """
    资源清理监听器服务，用于清理agent context里面的attachments
    """

    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        """为代理上下文注册资源清理事件监听器"""
        event_listeners = {
            EventType.AFTER_MAIN_AGENT_RUN: ResourceCleanupListenerService._handle_after_main_agent_run,
        }

        BaseListenerService.register_listeners(agent_context, event_listeners)
        logger.info("已为代理上下文注册资源清理事件监听器")

    @staticmethod
    async def _handle_after_main_agent_run(event: Event[AfterMainAgentRunEventData]) -> None:
        """处理主agent完成事件，清理agent context中的attachments"""
        try:
            agent_context = event.data.agent_context
            logger.info(f"开始清理agent context attachments，agent: {event.data.agent_name}")

            # 调用agent context的clear_attachments方法
            agent_context.clear_attachments()

            logger.info("agent context attachments清理完成")

        except Exception as e:
            logger.error(f"清理agent context attachments过程中发生异常: {e}", exc_info=True)
