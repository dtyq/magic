from typing import Any, Callable, Dict

from app.core.context.agent_context import AgentContext
from agentlang.event.event import Event, EventType
from agentlang.logger import get_logger

logger = get_logger(__name__)

class BaseListenerService:
    """
    基础事件监听服务，封装通用的事件注册逻辑

    提供通用的事件注册和管理功能，子类只需专注于具体事件的处理逻辑
    """

    @staticmethod
    def register_event_listener(agent_context: AgentContext, event_type: EventType, listener: Callable[[Event[Any]], None]) -> None:
        """
        为代理上下文注册事件监听器

        Args:
            agent_context: 代理上下文对象
            event_type: 事件类型
            listener: 事件监听器函数，接收一个事件参数
        """
        # 检查agent_context是否为None
        if agent_context is None:
            logger.warning("无法注册事件监听器: 代理上下文为None")
            return

        # 向代理上下文直接注册监听器
        agent_context.add_event_listener(event_type, listener)

    @staticmethod
    def register_listeners(agent_context: AgentContext, event_listeners: Dict[EventType, Callable[[Event[Any]], None]]) -> None:
        """
        批量注册多个事件监听器

        Args:
            agent_context: 代理上下文对象
            event_listeners: 事件类型到监听器函数的映射字典
        """
        for event_type, listener in event_listeners.items():
            BaseListenerService.register_event_listener(agent_context, event_type, listener)

        # 显示所有注册的事件类型
        event_types = [str(event_type) for event_type in event_listeners.keys()]
        logger.info(f"已批量注册 {len(event_listeners)} 个事件监听器: {', '.join(event_types)}")
