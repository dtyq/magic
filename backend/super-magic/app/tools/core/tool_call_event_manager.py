"""工具调用事件管理器

管理工具调用相关事件的触发和状态管理
"""

from typing import Any, Dict, Literal, Optional

from agentlang.context.tool_context import ToolContext
from agentlang.event.data import AfterToolCallEventData, BeforeToolCallEventData
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from openai.types.chat import ChatCompletionMessage, ChatCompletionMessageToolCall

from app.core.context.agent_context import AgentContext
from app.core.entity.event.event_context import EventContext
from app.tools.core.tool_factory import tool_factory

logger = get_logger(__name__)


class ToolCallEventManager:
    """工具调用事件管理器，纯静态工具类，封装所有工具调用事件相关的逻辑"""

    @staticmethod
    async def trigger_before_tool_call(
        agent_context: AgentContext,
        tool_call: ChatCompletionMessageToolCall,
        tool_context: ToolContext,
        tool_name: str,
        arguments: Dict[str, Any],
        correlation_id: Optional[str] = None,
    ) -> None:
        """触发工具调用前事件

        Args:
            agent_context: Agent上下文
            tool_call: OpenAI格式的工具调用对象
            tool_context: 工具上下文
            tool_name: 工具名称
            arguments: 工具参数字典
            correlation_id: 关联ID（可选，用于并行执行）
        """
        if not agent_context:
            return

        try:
            # 获取工具实例
            tool_instance = tool_factory.get_tool_instance(tool_name)

            # 允许工具在事件触发前向 tool_context.arguments 注入额外参数
            await tool_instance.set_extra_arguments(tool_context)

            # 创建事件数据（arguments 已包含 set_extra_arguments 写入的字段）
            event_data = BeforeToolCallEventData(
                tool_call=tool_call,
                tool_context=tool_context,
                tool_name=tool_name,
                arguments=arguments,
                tool_instance=tool_instance,
                correlation_id=correlation_id,
            )

            # 触发事件
            await agent_context.dispatch_event(EventType.BEFORE_TOOL_CALL, event_data)

            logger.debug(f"成功触发工具调用前事件: {tool_name}")

        except Exception as e:
            logger.error(f"触发工具调用前事件失败: {tool_name}, 错误: {e}", exc_info=True)

    @staticmethod
    async def trigger_after_tool_call(
        agent_context: AgentContext,
        tool_call: ChatCompletionMessageToolCall,
        tool_context: ToolContext,
        tool_name: str,
        arguments: Dict[str, Any],
        result: ToolResult,
        execution_time: float,
        correlation_id: Optional[str] = None,
    ) -> None:
        """触发工具调用后事件

        Args:
            agent_context: Agent上下文
            tool_call: OpenAI格式的工具调用对象
            tool_context: 工具上下文
            tool_name: 工具名称
            arguments: 工具参数字典
            result: 工具执行结果
            execution_time: 执行时间（秒）
            correlation_id: 关联ID（可选，用于并行执行）
        """
        if not agent_context:
            return

        try:
            # 获取工具实例
            tool_instance = tool_factory.get_tool_instance(tool_name)

            # 创建事件数据
            event_data = AfterToolCallEventData(
                tool_call=tool_call,
                tool_context=tool_context,
                tool_name=tool_name,
                arguments=arguments,
                result=result,
                execution_time=execution_time,
                tool_instance=tool_instance,
                correlation_id=correlation_id,
            )

            # 触发事件
            await agent_context.dispatch_event(EventType.AFTER_TOOL_CALL, event_data)

            logger.debug(f"成功触发工具调用后事件: {tool_name}, 成功: {result.ok}")

        except Exception as e:
            logger.error(f"触发工具调用后事件失败: {tool_name}, 错误: {e}", exc_info=True)

    @staticmethod
    def create_openai_tool_call(
        tool_call_id: str,
        tool_type: Literal["function"],
        tool_name: str,
        arguments: str,
    ) -> ChatCompletionMessageToolCall:
        """创建OpenAI格式的工具调用对象

        Args:
            tool_call_id: 工具调用ID
            tool_type: 工具调用类型（目前仅支持 "function"）
            tool_name: 工具名称
            arguments: 参数字符串

        Returns:
            ChatCompletionMessageToolCall: OpenAI格式的工具调用对象
        """
        from openai.types.chat.chat_completion_message_tool_call import Function

        return ChatCompletionMessageToolCall(
            id=tool_call_id,
            type=tool_type,
            function=Function(name=tool_name, arguments=arguments),
        )

    @staticmethod
    def create_tool_context(
        agent_context: AgentContext,
        tool_call_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
    ) -> ToolContext:
        """创建工具上下文

        Args:
            agent_context: Agent上下文
            tool_call_id: 工具调用ID
            tool_name: 工具名称
            arguments: 工具参数字典

        Returns:
            ToolContext: 工具上下文实例
        """
        # 创建工具上下文，确保传递 agent_context 的 metadata
        tool_context = ToolContext(
            tool_call_id=tool_call_id,
            tool_name=tool_name,
            arguments=arguments,
            metadata=agent_context.get_metadata(),
        )
        # 添加 AgentContext 扩展
        tool_context.register_extension("agent_context", agent_context)
        # 添加EventContext扩展
        tool_context.register_extension("event_context", EventContext())

        return tool_context
