from typing import Any, Dict, List, Optional

from openai.types.chat import ChatCompletionMessage, ChatCompletionMessageToolCall
from pydantic import Field

from app.core.context.agent_context import AgentContext
from app.core.entity.message.client_message import ChatClientMessage
from agentlang.event.common import BaseEventData
from agentlang.event.data import BeforeToolCallEventData, AfterToolCallEventData


class McpServerConfigSummary:
    """MCP 服务器配置摘要信息"""

    def __init__(self, name: str, type: str, source: str, label_name: str = "", label_names: Optional[list[str]] = None):
        self.name = name
        self.type = type
        self.source = source
        self.label_name = label_name
        self.label_names = label_names or []

    def __str__(self):
        return f"{self.name} ({self.type}, 来源: {self.source})"


def _create_fake_mcp_tool_call():
    """创建虚拟的MCP工具调用"""
    from openai.types.chat.chat_completion_message_tool_call import Function
    return ChatCompletionMessageToolCall(
        id='mcp_init',
        function=Function(name='mcp_init', arguments='{}'),
        type='function'
    )


def _create_fake_mcp_tool_context():
    """创建虚拟的MCP工具上下文"""
    from agentlang.context.tool_context import ToolContext
    # 创建基础的工具上下文，agent_context扩展将在实例化后添加
    return ToolContext(metadata={})


def _create_fake_mcp_tool_result():
    """创建虚拟的MCP工具结果"""
    from agentlang.tools.tool_result import ToolResult
    return ToolResult(content="MCP初始化完成", ok=True)


class AfterClientChatEventData(BaseEventData):
    """客户端聊天后的事件数据结构"""

    agent_context: AgentContext
    client_message: ChatClientMessage


class BeforeMcpInitEventData(BeforeToolCallEventData):
    """MCP 初始化前事件的数据结构"""

    # 父类字段的默认值
    tool_call: ChatCompletionMessageToolCall = Field(default_factory=_create_fake_mcp_tool_call)
    tool_context: Any = Field(default_factory=_create_fake_mcp_tool_context)
    tool_name: str = Field(default="mcp_init")
    arguments: Dict[str, Any] = Field(default_factory=dict)
    tool_instance: Any = Field(default=None)

    # 子类特有字段
    server_count: int  # 待初始化的 MCP 服务器数量
    server_configs: List[McpServerConfigSummary]  # 服务器配置摘要列表
    agent_context: AgentContext  # 代理上下文

    def model_post_init(self, __context: Any) -> None:
        """在模型初始化后设置tool_context的扩展"""
        if hasattr(self, 'agent_context') and self.agent_context:
            # 更新tool_context的metadata和扩展
            self.tool_context.update_metadata(self.agent_context.get_metadata())
            self.tool_context.register_extension("agent_context", self.agent_context)

            # 添加EventContext扩展
            from app.core.entity.event.event_context import EventContext
            self.tool_context.register_extension("event_context", EventContext())


class AfterMcpInitEventData(AfterToolCallEventData):
    """MCP 初始化后事件的数据结构"""

    # 父类字段的默认值
    tool_call: ChatCompletionMessageToolCall = Field(default_factory=_create_fake_mcp_tool_call)
    tool_context: Any = Field(default_factory=_create_fake_mcp_tool_context)
    tool_name: str = Field(default="mcp_init")
    arguments: Dict[str, Any] = Field(default_factory=dict)
    result: Any = Field(default_factory=_create_fake_mcp_tool_result)
    execution_time: float = Field(default=0.0)
    tool_instance: Any = Field(default=None)

    # 子类特有字段
    success: bool  # 是否成功
    initialized_count: int  # 成功初始化的 MCP 服务器数量
    total_count: int  # 总的 MCP 服务器数量
    server_configs: List[McpServerConfigSummary]  # 服务器配置摘要列表
    server_results: Optional[List[Any]] = None  # 服务器初始化结果详情
    error: Optional[str] = None  # 错误信息（如果有的话）
    agent_context: AgentContext  # 代理上下文

    def model_post_init(self, __context: Any) -> None:
        """在模型初始化后设置tool_context的扩展"""
        if hasattr(self, 'agent_context') and self.agent_context:
            # 更新tool_context的metadata和扩展
            self.tool_context.update_metadata(self.agent_context.get_metadata())
            self.tool_context.register_extension("agent_context", self.agent_context)

            # 添加EventContext扩展
            from app.core.entity.event.event_context import EventContext
            self.tool_context.register_extension("event_context", EventContext())
