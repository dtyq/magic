from enum import Enum
from typing import Generic, TypeVar

from agentlang.event.common import BaseEventData


class EventType(str, Enum):
    """事件类型枚举"""

    BEFORE_INIT = "before_init"
    AFTER_INIT = "after_init"
    BEFORE_SAFETY_CHECK = "before_safety_check"
    AFTER_SAFETY_CHECK = "after_safety_check"
    AFTER_CLIENT_CHAT = "after_client_chat"
    BEFORE_LLM_REQUEST = "before_llm_request"  # 请求大模型前的事件 [DEPRECATED: 不再触发]
    AFTER_LLM_REQUEST = "after_llm_request"  # 请求大模型后的事件 [DEPRECATED: 不再触发]
    BEFORE_AGENT_THINK = "before_agent_think"  # 智能体思考开始前的事件（思考容器）
    AFTER_AGENT_THINK = "after_agent_think"  # 智能体思考结束后的事件（思考容器）
    BEFORE_AGENT_REPLY = "before_agent_reply"  # 智能体回复前的事件
    AFTER_AGENT_REPLY = "after_agent_reply"  # 智能体回复后的事件
    BEFORE_TOOL_CALL = "before_tool_call"  # 工具调用前的事件
    BEFORE_TOOL_CALL_EXPLANATION = "before_tool_call_explanation"  # 工具调用前解释事件
    PENDING_TOOL_CALL = "pending_tool_call"  # 工具调用等待事件
    AFTER_TOOL_CALL = "after_tool_call"  # 工具调用后的事件
    AGENT_SUSPENDED = "agent_suspended"  # agent终止事件
    BEFORE_MAIN_AGENT_RUN = "before_main_agent_run"  # 主 agent 运行前的事件
    AFTER_MAIN_AGENT_RUN = "after_main_agent_run"  # 主 agent 运行后的事件

    # 工具调用子事件
    FILE_CREATED = "file_created"  # 文件创建事件
    FILE_UPDATED = "file_updated"  # 文件更新事件
    FILE_DELETED = "file_deleted"  # 文件删除事件
    BEFORE_FILE_CREATED = "before_file_created"  # 文件创建前事件
    BEFORE_FILE_UPDATED = "before_file_updated"  # 文件更新前事件
    BEFORE_FILE_DELETED = "before_file_deleted"  # 文件删除前事件

    # 聊天历史相关事件
    CHAT_HISTORY_CHANGED = "chat_history_changed"  # 聊天历史变更事件

    ERROR = "error"  # 错误事件


T = TypeVar("T", bound=BaseEventData)


class Event(Generic[T]):
    """事件基类，所有事件都应该继承这个类"""

    def __init__(self, event_type: EventType, data: BaseEventData):
        """初始化事件

        Args:
            event_type: 事件类型
            data: 事件携带的数据，可以是字典或BaseEventData的子类实例
        """
        self._event_type = event_type
        self._data = data

    @property
    def event_type(self) -> EventType:
        """获取事件类型"""
        return self._event_type

    @property
    def data(self) -> T:
        """获取事件数据"""
        return self._data


class StoppableEvent(Event[T]):
    """可停止的事件，实现了停止传播的功能"""

    def __init__(self, event_type: EventType, data: BaseEventData):
        """初始化可停止事件

        Args:
            event_type: 事件类型
            data: 事件携带的数据
        """
        super().__init__(event_type, data)
        self._propagation_stopped = False

    def stop_propagation(self) -> None:
        """停止事件传播"""
        self._propagation_stopped = True

    def is_propagation_stopped(self) -> bool:
        """检查事件是否已停止传播

        Returns:
            bool: 如果事件已停止传播返回True，否则返回False
        """
        return self._propagation_stopped
