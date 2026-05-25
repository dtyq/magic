"""mcp @tool() 共用的强类型结构体。"""

from enum import StrEnum


class McpServerStatus(StrEnum):
    """服务器连接状态。"""

    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    FAILED = "failed"
