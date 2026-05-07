"""user_tool_call 持久化恢复监听器，在 AFTER_INIT 后恢复服务重启前未完成的超时定时器。"""

from agentlang.event.data import AfterInitEventData
from agentlang.event.event import Event, EventType
from agentlang.logger import get_logger

from app.core.context.agent_context import AgentContext
from app.service.agent_event.base_listener_service import BaseListenerService

logger = get_logger(__name__)


class UserToolCallListenerService:

    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        BaseListenerService.register_listeners(agent_context, {
            EventType.AFTER_INIT: UserToolCallListenerService._handle_after_init,
        })
        logger.info("已注册 user_tool_call 持久化恢复监听器")

    @staticmethod
    async def _handle_after_init(event: Event[AfterInitEventData]) -> None:
        try:
            agent_context = event.data.agent_context
            # 恢复工厂由 BaseUserToolCallTool.__init_subclass__ 在工具模块加载时自动注册，
            # app/tools/__init__.py 在启动阶段已统一导入所有工具，无需在此手动 import。
            from app.service.user_tool_call_service import UserToolCallService
            await UserToolCallService.get_instance().restore_pending_from_disk(agent_context)
            logger.info("user_tool_call pending restore completed")
        except Exception as e:
            logger.warning(f"恢复 user_tool_call 超时定时器失败（不影响正常流程）: {e}")
