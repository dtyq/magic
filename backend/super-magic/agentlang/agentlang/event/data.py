from typing import Any, Dict, List, Optional

from openai.types.chat import ChatCompletionMessage, ChatCompletionMessageToolCall

from agentlang.context.tool_context import ToolContext
from agentlang.event.common import BaseEventData
from agentlang.interface.context import AgentContextInterface
from agentlang.tools.tool_result import ToolResult
from agentlang.llms.token_usage.models import TokenUsage


class BeforeInitEventData(BaseEventData):
    """初始化前事件的数据结构"""

    tool_context: ToolContext


class AfterInitEventData(BaseEventData):
    """初始化后事件的数据结构"""

    tool_context: ToolContext
    agent_context: Optional[AgentContextInterface] = None
    success: bool
    error: Optional[str] = None


class BeforeLlmRequestEventData(BaseEventData):
    """请求大模型前的事件数据结构"""

    model_name: str
    chat_history: List[Dict[str, object]]
    tools: Optional[List[Dict[str, object]]] = None
    tool_context: ToolContext


class AfterLlmResponseEventData(BaseEventData):
    """请求大模型后的事件数据结构"""

    model_name: str
    request_time: float  # 请求耗时（秒）
    success: bool
    error: Optional[str] = None
    tool_context: ToolContext
    llm_response_message: ChatCompletionMessage  # 大模型返回的消息内容
    show_in_ui: bool = True  # 是否在UI中显示
    token_usage: Optional[TokenUsage] = None


class BeforeToolCallEventData(BaseEventData):
    """工具调用前的事件数据结构"""

    tool_call: ChatCompletionMessageToolCall
    tool_context: ToolContext
    tool_name: str
    arguments: Dict[str, object]
    tool_instance: Any  # 工具实例，可以是任何支持执行的工具类型
    llm_response_message: ChatCompletionMessage  # 大模型返回的消息内容


class AfterToolCallEventData(BaseEventData):
    """工具调用后的事件数据结构"""

    tool_call: ChatCompletionMessageToolCall
    tool_context: ToolContext
    tool_name: str
    arguments: Dict[str, object]
    result: ToolResult
    execution_time: float  # 执行耗时（秒）
    tool_instance: Any  # 工具实例，可以是任何支持执行的工具类型


class AgentSuspendedEventData(BaseEventData):
    """agent终止事件的数据结构"""

    agent_context: AgentContextInterface


class BeforeMainAgentRunEventData(BaseEventData):
    """主 agent 运行前的事件数据结构"""

    agent_context: AgentContextInterface
    agent_name: str
    query: str


class AfterMainAgentRunEventData(BaseEventData):
    """主 agent 运行后的事件数据结构"""

    agent_context: AgentContextInterface
    agent_name: str
    agent_state: str
    query: str


class ErrorEventData(BaseEventData):
    """错误事件的数据结构"""
    exception: Exception
    agent_context: AgentContextInterface
    error_message: str
