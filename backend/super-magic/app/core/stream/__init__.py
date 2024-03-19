"""
流处理接口模块

提供统一的流操作接口类
"""

from app.core.stream.base import Stream
from app.core.stream.stdout_stream import StdoutStream
from app.core.stream.websocket_stream import WebSocketStream

__all__ = ["StdoutStream", "Stream", "WebSocketStream"] 
