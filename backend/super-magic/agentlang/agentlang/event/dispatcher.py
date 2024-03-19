import traceback
from typing import Any, Callable, Dict, Iterable, List, Optional, TypeVar

from agentlang.event.event import Event, EventType, StoppableEvent
from agentlang.event.common import BaseEventData
from agentlang.event.interface import EventDispatcherInterface
from agentlang.logger import get_logger

logger = get_logger(__name__)

T = TypeVar('T')  # 暂时解除与 BaseEventData 的绑定，以避免循环导入

class ListenerProvider:
    """监听器提供者，负责管理和提供事件监听器"""

    def __init__(self):
        """初始化监听器提供者"""
        self._listeners: Dict[EventType, List[Callable[[Event[Any]], None]]] = {}

    def add_listener(self, event_type: EventType, listener: Callable[[Event[Any]], None]) -> None:
        """添加事件监听器

        Args:
            event_type: 事件类型
            listener: 监听器函数，接收一个事件参数
        """
        if event_type not in self._listeners:
            self._listeners[event_type] = []

        # Check if listener already exists to prevent duplicate registration
        if listener in self._listeners[event_type]:
            logger.info(f"监听器已存在，跳过重复注册: {event_type}, 监听器: {listener.__name__}")
            return

        self._listeners[event_type].append(listener)
        logger.debug(f"已添加事件监听器: {event_type}, 监听器: {listener.__name__}")

    def get_listeners_for_event(self, event: Event[Any]) -> Iterable[Callable[[Event[Any]], None]]:
        """获取指定事件的所有监听器

        Args:
            event: 事件实例

        Returns:
            Iterable[Callable]: 监听器函数列表
        """
        return self._listeners.get(event.event_type, [])


class EventDispatcher(EventDispatcherInterface):
    """事件分发器，负责分发事件到对应的监听器"""

    def __init__(self, provider: Optional[ListenerProvider] = None):
        """初始化事件分发器

        Args:
            provider: 监听器提供者实例，如果不提供则创建一个新的
        """
        self._provider = provider or ListenerProvider()

    def add_listener(self, event_type: EventType, listener: Callable[[Event[Any]], None]) -> None:
        """添加事件监听器

        Args:
            event_type: 事件类型
            listener: 监听器函数
        """
        self._provider.add_listener(event_type, listener)

    async def dispatch(self, event: Event[T]) -> Event[T]:
        """分发事件到所有相关的监听器

        按照顺序同步调用所有监听器，如果是可停止事件，会在每个监听器调用前检查是否需要停止传播。
        如果事件数据中包含工具上下文引用，可以通过工具上下文访问到共享的事件上下文。

        Args:
            event: 要分发的事件

        Returns:
            Event: 处理后的事件对象
        """
        listeners = self._provider.get_listeners_for_event(event)

        for listener in listeners:
            # 如果是可停止事件且已停止传播，则立即返回
            if isinstance(event, StoppableEvent) and event.is_propagation_stopped():
                logger.info(f"事件 {event.event_type} 传播已停止")
                break

            try:
                # 获取监听器的名称
                listener_name = self._get_listener_name(listener)

                # 调用监听器
                await listener(event)

                # 记录处理成功信息
                logger.debug(f"监听器 {listener_name} 成功处理事件 {event.event_type}")
            except Exception as e:
                # 打印调用栈
                traceback.print_exc()
                listener_name = self._get_listener_name(listener)
                logger.error(f"执行事件监听器时出错: {listener_name}, 错误: {e}")
                # 继续执行其他监听器，但记录错误
                continue

        return event

    def _get_listener_name(self, listener: Callable) -> str:
        """获取监听器的名称，用于日志记录

        尝试获取函数名，如果是方法则包含类名

        Args:
            listener: 监听器函数或方法

        Returns:
            str: 监听器的名称
        """
        if hasattr(listener, "__qualname__"):
            return listener.__qualname__
        elif hasattr(listener, "__name__"):
            return listener.__name__
        else:
            return str(listener)
