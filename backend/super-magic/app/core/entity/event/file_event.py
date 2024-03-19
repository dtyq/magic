"""
文件事件相关数据类定义

用于定义与文件操作相关的事件数据结构
"""
from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.event.common import BaseEventData


class FileEventData(BaseEventData):
    """文件事件数据类"""

    filepath: str  # 文件路径
    source: int = 3 # 文件来源 3 容器生成 5 AI 图片生成
    event_type: EventType  # 事件类型
    tool_context: ToolContext  # 工具上下文
    is_screenshot: bool = False  # 是否是截图
