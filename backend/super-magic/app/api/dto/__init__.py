"""
数据传输对象(DTO)包，用于定义WebSocket消息格式
"""

from .base import (
    WebSocketMessage,
)

__all__ = [
    # WebSocket消息验证模型
    "WebSocketMessage",
    # 代理相关消息
    "StartDTO",
    "FinishDTO",
    "ErrorDTO",
    "ThinkingDTO",
    # 工具相关消息
    "ToolUsedDTO",
    "FileToolDTO",
    "SearchToolDTO",
    "BrowserToolDTO",
    "PythonToolDTO",
    "TerminateToolDTO",
]
