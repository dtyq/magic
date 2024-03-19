# agentlang/agentlang/streaming/__init__.py
"""流式推送模块

该模块提供了轻量化的流式数据推送功能，支持Socket.IO等推送方式。

核心特性：
- 轻量化设计：最小化组件和依赖
- 按需加载：驱动在使用时才创建
- 快速失败：推送失败直接丢弃，不重试
- 异步推送：不阻塞主流程
"""

from .interface import StreamingInterface
from .manager import create_driver, list_available_drivers
from .models import ChunkData, ChunkDelta, ChunkMetadata, StreamingResult
from .drivers.socketio.config import SocketIODriverConfig
from .exceptions import StreamingException, DriverNotAvailableException, PushFailedException
from .message_builder import MessageBuilderInterface

# 有条件地导入 SocketIODriver
try:
    from .drivers.socketio.driver import SocketIODriver
    _socketio_available = True
except ImportError:
    SocketIODriver = None
    _socketio_available = False

__all__ = [
    "StreamingInterface",
    "create_driver",
    "list_available_drivers",
    "ChunkData",
    "ChunkDelta",
    "ChunkMetadata",
    "StreamingResult",
    "SocketIODriverConfig",
    "StreamingException",
    "DriverNotAvailableException",
    "PushFailedException",
    "MessageBuilderInterface"
]

if _socketio_available:
    __all__.append("SocketIODriver")
