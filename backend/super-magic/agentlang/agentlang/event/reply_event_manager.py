"""
Reply Event Manager

管理 Agent 回复事件的触发和状态管理
"""

from datetime import datetime
from typing import Optional

from openai.types.chat import ChatCompletion
from openai.types.chat.chat_completion_message import ChatCompletionMessage

from agentlang.context.tool_context import ToolContext
from agentlang.event.data import AfterAgentReplyEventData, BeforeAgentReplyEventData
from agentlang.event.event import Event, EventType
from agentlang.interface.context import AgentContextInterface
from agentlang.llms.token_usage.models import TokenUsage
from agentlang.logger import get_logger

logger = get_logger(__name__)


class ReplyEventManager:
    """Reply 事件管理器，纯静态工具类，封装所有 REPLY 事件相关的逻辑"""

    @staticmethod
    async def trigger_before_reply(
        agent_context: AgentContextInterface,
        model_id: str,
        model_name: str,
        request_id: str,
        messages_count: int = 0,
        tools_count: int = 0,
        use_stream_mode: bool = False,
        content_type: str = "content"
    ) -> Optional[str]:
        """触发智能体回复开始前事件

        Args:
            agent_context: Agent上下文
            model_id: 模型ID
            model_name: 模型名称
            request_id: 请求ID
            messages_count: 消息数量
            tools_count: 工具数量
            use_stream_mode: 是否使用流式模式
            content_type: 内容类型 ("reasoning" | "content")

        Returns:
            Optional[str]: 生成的 correlation_id，如果失败则返回 None
        """
        if not agent_context:
            return None

        try:
            # 创建工具上下文
            tool_context = ReplyEventManager._create_tool_context(agent_context)

            # 创建事件数据
            event_data = BeforeAgentReplyEventData(
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
                request_id=request_id,
                request_timestamp=datetime.now().isoformat(),
                tool_context=tool_context,
                messages_count=messages_count,
                tools_count=tools_count,
                use_stream_mode=use_stream_mode,
                content_type=content_type
            )

            # 触发事件（dispatch_event 会自动生成 correlation_id 并设置到 event_data 中）
            event = Event(EventType.BEFORE_AGENT_REPLY, event_data)
            await agent_context.dispatch_event(event.event_type, event_data)

            logger.debug(f"[{request_id}] 成功触发大模型响应开始前事件 (content_type={content_type}, correlation_id={event_data.correlation_id})")

            # 返回生成的 correlation_id
            return event_data.correlation_id

        except Exception as e:
            logger.error(f"[{request_id}] 触发大模型响应开始前事件失败: {e}", exc_info=True)
            return None

    @staticmethod
    async def trigger_after_reply(
        agent_context: AgentContextInterface,
        model_id: str,
        model_name: str,
        request_id: str,
        response: Optional[ChatCompletion] = None,
        execution_time: float = 0.0,
        use_stream_mode: bool = False,
        exception: Optional[Exception] = None,
        content_type: str = "content",
        content: str = "",
        correlation_id: Optional[str] = None,
    ) -> None:
        """触发智能体回复完成后事件

        Args:
            agent_context: Agent上下文
            model_id: 模型ID
            model_name: 模型名称
            request_id: 请求ID
            response: LLM响应（成功时，非流式模式）
            execution_time: 执行耗时（毫秒）
            use_stream_mode: 是否使用流式模式
            exception: 异常（失败时）
            content_type: 内容类型 ("reasoning" | "content")
            content: 累积的内容（流式模式下使用，优先级高于 response）
        """
        if not agent_context:
            return

        try:
            # 创建工具上下文
            tool_context = ReplyEventManager._create_tool_context(agent_context)

            # 提取响应数据
            success, extracted_message, token_usage, error_message = ReplyEventManager._extract_response_data(
                response, exception
            )

            # 确定最终的 llm_response_message
            # 优先使用传入的 content（流式模式），否则使用从 response 提取的
            if content:
                final_message = ChatCompletionMessage(role="assistant", content=content)
                success = True
            else:
                final_message = extracted_message

            # 创建事件数据
            event_data = AfterAgentReplyEventData(
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
                request_id=request_id,
                request_timestamp=datetime.now().isoformat(),
                response_timestamp=datetime.now().isoformat(),
                tool_context=tool_context,
                llm_response_message=final_message,
                response=response,
                token_usage=token_usage,
                execution_time=execution_time,
                use_stream_mode=use_stream_mode,
                success=success,
                error=error_message,
                content_type=content_type,
                # 若调用方显式提供 correlation_id（如 V2 流式降级场景），
                # 直接写入 event_data，dispatch_event 会跳过 CorrelationIdManager 自动消耗
                correlation_id=correlation_id,
            )

            # 触发事件
            event = Event(EventType.AFTER_AGENT_REPLY, event_data)
            await agent_context.dispatch_event(event.event_type, event_data)

            logger.debug(f"[{request_id}] 成功触发大模型响应完成后事件, success: {event_data.success}, content_type={content_type}")

        except Exception as e:
            logger.error(f"[{request_id}] 触发大模型响应完成后事件失败: {e}", exc_info=True)

    @staticmethod
    def _create_tool_context(agent_context: AgentContextInterface) -> ToolContext:
        """创建工具上下文

        Args:
            agent_context: Agent上下文

        Returns:
            ToolContext: 工具上下文实例
        """
        tool_context = ToolContext(metadata=agent_context.get_metadata() if agent_context else {})
        if agent_context:
            tool_context.register_extension("agent_context", agent_context)
        return tool_context

    @staticmethod
    def _extract_response_data(
        response: Optional[ChatCompletion],
        exception: Optional[Exception]
    ) -> tuple[bool, Optional[ChatCompletionMessage], Optional[TokenUsage], Optional[str]]:
        """提取响应数据，包括消息、token使用量和错误信息

        Args:
            response: LLM响应
            exception: 异常（失败时）

        Returns:
            tuple: (success, llm_response_message, token_usage, error_message)
        """
        # 确定成功状态和响应数据
        success = response is not None and exception is None
        llm_response_message = None
        token_usage = None
        error_message = None

        if success and response:
            if response.choices and len(response.choices) > 0:
                llm_response_message = response.choices[0].message
            # 将 CompletionUsage 转换为 TokenUsage
            if response.usage:
                token_usage = TokenUsage.from_response(response.usage)
            else:
                token_usage = None
        elif exception:
            error_message = str(exception)

        return success, llm_response_message, token_usage, error_message
