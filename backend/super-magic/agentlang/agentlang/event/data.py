from typing import Dict, List, Optional, Any

from openai.types.chat import ChatCompletionMessage, ChatCompletionMessageToolCall, ChatCompletion

from agentlang.event.common import BaseEventData
from agentlang.interface.context import AgentContextInterface
from agentlang.context.tool_context import ToolContext
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


class BeforeAgentThinkEventData(BaseEventData):
    """智能体思考容器开始事件数据（用于标记思考阶段开始）"""

    agent_context: AgentContextInterface
    model_id: str
    model_name: str
    request_id: str
    request_timestamp: str
    use_stream_mode: bool


class AfterAgentThinkEventData(BaseEventData):
    """智能体思考容器结束事件数据（用于标记思考阶段结束）"""

    agent_context: AgentContextInterface
    model_id: str
    model_name: str
    request_id: str
    request_timestamp: str
    response_timestamp: str
    execution_time: float  # 思考阶段耗时（毫秒）
    use_stream_mode: bool
    success: bool


class BeforeAgentReplyEventData(BaseEventData):
    """智能体回复前事件数据结构"""

    agent_context: AgentContextInterface
    model_id: str
    model_name: str
    request_id: str
    request_timestamp: str
    tool_context: ToolContext

    # 请求相关信息
    messages_count: int  # 消息数量
    tools_count: int     # 工具数量
    use_stream_mode: bool # 是否使用流式模式
    content_type: str = "content"  # 内容类型："reasoning" | "content"


class AfterAgentReplyEventData(BaseEventData):
    """智能体回复后事件数据结构"""

    agent_context: AgentContextInterface
    model_id: str
    model_name: str
    request_id: str
    request_timestamp: str
    response_timestamp: str
    tool_context: ToolContext

    # 响应相关信息
    llm_response_message: Optional[ChatCompletionMessage]  # 大模型响应消息，异常时为None
    response: Optional[ChatCompletion]  # 完整的响应对象，异常时为None
    token_usage: Optional[TokenUsage]
    execution_time: float  # 执行耗时（毫秒）
    use_stream_mode: bool  # 是否使用流式模式
    success: bool  # 是否成功
    error: Optional[str] = None  # 错误信息（异常时）
    content_type: str = "content"  # 内容类型："reasoning" | "content"


class BeforeToolCallEventData(BaseEventData):
    """工具调用前的事件数据结构"""

    tool_call: ChatCompletionMessageToolCall
    tool_context: ToolContext
    tool_name: str
    arguments: Dict[str, object]
    tool_instance: Any  # 工具实例，可以是任何支持执行的工具类型


class PendingToolCallEventData(BaseEventData):
    """工具调用解释等待事件的数据结构"""

    tool_context: ToolContext
    tool_name: str  # 工具名称
    arguments: Dict[str, object]  # 工具参数
    tool_instance: Any  # 工具实例，可以是任何支持执行的工具类型


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
    remark: Optional[str] = None  # Custom termination message from client


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


class ChatHistoryChangedEventData(BaseEventData):
    """聊天历史变更事件的数据结构"""

    agent_name: str
    agent_id: str
    chat_history_dir: str
    file_path: Optional[str] = None  # 具体的聊天历史文件路径


class ErrorEventData(BaseEventData):
    """错误事件的数据结构"""
    exception: Exception
    agent_context: AgentContextInterface
    error_message: str
