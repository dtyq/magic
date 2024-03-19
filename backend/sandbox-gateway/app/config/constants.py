"""
常量定义
"""

# 沙箱容器标签
SANDBOX_LABEL = "sandbox_id"


AGENT_LABEL = "agent_id"
AGENT_LABEL_PREFIX = "sandbox-agent-"

# Qdrant容器标签
QDRANT_LABEL = "qdrant_id"
QDRANT_LABEL_PREFIX = "sandbox-qdrant-"

# WebSocket消息类型
WS_MESSAGE_TYPE_ERROR = "error"
WS_MESSAGE_TYPE_DATA = "data"
WS_MESSAGE_TYPE_STATUS = "status"

# 容器状态
CONTAINER_STATUS_RUNNING = "running"
CONTAINER_STATUS_STOPPED = "stopped"
CONTAINER_STATUS_EXITED = "exited"
CONTAINER_STATUS_CREATED = "created" 