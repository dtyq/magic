"""
事件系统接口定义

定义事件系统的基本接口，解决循环依赖问题
"""

from abc import ABC, abstractmethod
from typing import Any, Callable, TypeVar

from agentlang.event.event import Event, EventType

T = TypeVar('T')

class EventDispatcherInterface(ABC):
    """事件分发器接口，定义事件分发器的基本方法"""
    
    @abstractmethod
    def add_listener(self, event_type: EventType, listener: Callable[[Event[Any]], None]) -> None:
        """添加事件监听器

        Args:
            event_type: 事件类型
            listener: 监听器函数
        """
        pass
    
    @abstractmethod
    async def dispatch(self, event: Event[T]) -> Event[T]:
        """分发事件到所有相关的监听器

        Args:
            event: 要分发的事件

        Returns:
            Event: 处理后的事件对象
        """
        pass 