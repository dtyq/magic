"""
流接口基类

定义流操作的统一接口，用于读写数据
"""

from abc import ABC, abstractmethod
from typing import List, Optional

from agentlang.event.event import EventType


class Stream(ABC):
    """Stream interface for reading and writing data.
    
    This abstract base class defines the interface for stream operations,
    providing a consistent API for both reading and writing operations.
    
    Methods:
        read: Read data from the stream
        write: Write data to the stream
    """

    def __init__(self):
        """初始化Stream基类
        
        初始化事件过滤列表
        """
        # 默认处理所有事件
        self._ignored_events: List[EventType] = []

    def ignore_events(self, event_types: List[EventType]) -> None:
        """配置此流应该忽略的事件类型
        
        Args:
            event_types: 要忽略的事件类型列表
        """
        self._ignored_events.extend(event_types)

    def should_ignore_event(self, event_type: EventType) -> bool:
        """检查此流是否应该处理特定事件类型
        
        Args:
            event_type: 要检查的事件类型
            
        Returns:
            bool: 如果应该处理返回True，否则返回False
        """
        return event_type in self._ignored_events

    @abstractmethod
    def read(self, size: Optional[int] = None) -> str:
        """Read data from the stream.
        
        Args:
            size: Optional number of bytes/items to read. If None, reads all available data.
            
        Returns:
            The string data read from the stream.
            
        Raises:
            EOFError: When end of stream is reached.
            IOError: When stream read operation fails.
        """
        pass

    @abstractmethod
    def write(self, data: str, data_type: str = "json") -> int:
        """Write data to the stream.
        
        Args:
            data: The string data to write to the stream.
            data_type: The type of data to write to the stream.
        Returns:
            The number of bytes/items written.
            
        Raises:
            IOError: When stream write operation fails.
        """
        pass 
