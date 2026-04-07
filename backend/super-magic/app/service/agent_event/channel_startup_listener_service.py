"""IM 渠道自动连接监听器，在 AFTER_INIT 后按当前沙箱配置触发自动连接。"""
import asyncio

from agentlang.event.data import AfterInitEventData
from agentlang.event.event import Event, EventType
from agentlang.logger import get_logger

from app.core.context.agent_context import AgentContext
from app.service.agent_event.base_listener_service import BaseListenerService

logger = get_logger(__name__)


class ChannelStartupListenerService:

    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        BaseListenerService.register_listeners(agent_context, {
            EventType.AFTER_INIT: ChannelStartupListenerService._handle_after_init,
        })
        logger.info("已注册 IM 渠道自动连接监听器")

    @staticmethod
    async def _handle_after_init(event: Event[AfterInitEventData]) -> None:
        async def _run() -> None:
            try:
                from app.channel.startup import auto_connect_channels_for_current_sandbox
                await auto_connect_channels_for_current_sandbox()
            except Exception as e:
                logger.warning(f"[ChannelStartup] IM 自动连接失败，不影响初始化流程: {e}")

        asyncio.create_task(_run())
