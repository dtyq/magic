"""
Regular Call Processor for LLM non-streaming operations.

This module handles all non-streaming LLM call logic, including request preparation
and response handling.

Event triggering logic matches streaming mode:
- reasoning_content: triggers REPLY events with content_type="reasoning"
- content: triggers AFTER_AGENT_THINK (marks end of thinking), then REPLY events with content_type="content"
- tool_calls only: no REPLY events (AFTER_AGENT_THINK handled by agent.py finally)
"""

import time
from typing import Any, Dict, Optional

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletion

from agentlang.interface.context import AgentContextInterface
from agentlang.llms.token_usage.models import ContextInputBreakdown
from agentlang.event.reply_event_manager import ReplyEventManager
from agentlang.event.think_event_manager import ThinkEventManager
from agentlang.logger import get_logger

logger = get_logger(__name__)

class RegularCallProcessor:
    """Handles regular (non-streaming) LLM calls."""

    @staticmethod
    async def call_without_stream(
        client: AsyncOpenAI,
        llm_config,
        request_params: Dict[str, Any],
        model_id: str,
        agent_context: Optional[AgentContextInterface] = None,
        request_id: Optional[str] = None,
        enable_llm_response_events: bool = True,
        timeout_seconds: Optional[int] = None,
        input_breakdown: ContextInputBreakdown | None = None,
    ) -> ChatCompletion:
        """使用非流式调用LLM的方法。

        Args:
            client: OpenAI客户端
            llm_config: LLM配置
            request_params: 请求参数
            model_id: 模型ID
            agent_context: Agent上下文
            request_id: 请求ID
            enable_llm_response_events: 是否启用LLM响应事件
            timeout_seconds: 本次请求超时（秒），None 时沿用客户端全局配置

        Returns:
            ChatCompletion响应
        """
        # 移除流式参数，确保使用真正的非流式调用
        if "stream" in request_params:
            del request_params["stream"]
        if "stream_options" in request_params:
            del request_params["stream_options"]

        # 添加请求ID到请求头
        if request_id:
            extra_headers = request_params.get("extra_headers", {})
            extra_headers["x-request-id"] = request_id
            request_params["extra_headers"] = extra_headers

        # 记录开始时间
        start_time = time.time()

        # 非流式 fallback 使用独立超时（覆盖客户端全局配置）
        create_kwargs = {**request_params}
        if timeout_seconds is not None:
            create_kwargs["timeout"] = timeout_seconds

        # 发送非流式请求
        response: ChatCompletion = await client.chat.completions.create(**create_kwargs)

        # 计算执行时间
        end_time = time.time()
        elapsed_time = (end_time - start_time) * 1000  # 转换为毫秒

        # 非流式 fallback 重新启用后，重试轮次也应该维持完整的 reply 生命周期。
        should_trigger_events = enable_llm_response_events and agent_context

        if should_trigger_events:
            # 触发事件（与流式模式逻辑一致）
            await RegularCallProcessor._trigger_response_events(
                response=response,
                agent_context=agent_context,
                model_id=model_id,
                model_name=llm_config.name,
                request_id=request_id,
                elapsed_time=elapsed_time,
                input_breakdown=input_breakdown,
            )

        return response

    @staticmethod
    async def _trigger_response_events(
        response: ChatCompletion,
        agent_context: AgentContextInterface,
        model_id: str,
        model_name: str,
        request_id: Optional[str],
        elapsed_time: float,
        input_breakdown: ContextInputBreakdown | None = None,
    ) -> None:
        """解析完整响应，并按 V1 分阶段或 V2 原子协议触发事件。"""
        try:
            # 获取响应消息
            message = response.choices[0].message if response.choices else None
            if not message:
                logger.warning(f"[{request_id}] 响应中没有消息，跳过事件触发")
                return

            # 提取内容
            reasoning_content = getattr(message, 'reasoning_content', None)
            content = message.content
            has_tool_calls = bool(message.tool_calls)

            # 判断是否有有效内容（非空非 whitespace）
            has_reasoning = bool(reasoning_content and reasoning_content.strip())
            has_content = bool(content and content.strip())

            logger.debug(
                f"[{request_id}] 非流式响应分析: "
                f"has_reasoning={has_reasoning}, has_content={has_content}, has_tool_calls={has_tool_calls}"
            )

            if agent_context.get_message_version() == "v2":
                await RegularCallProcessor._trigger_v2_atomic_reply_event(
                    response=response,
                    agent_context=agent_context,
                    model_id=model_id,
                    model_name=model_name,
                    request_id=request_id,
                    elapsed_time=elapsed_time,
                    has_reasoning=has_reasoning,
                    has_content=has_content,
                    has_tool_calls=has_tool_calls,
                    input_breakdown=input_breakdown,
                )
                return

            await RegularCallProcessor._trigger_v1_phased_reply_events(
                response=response,
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
                request_id=request_id,
                elapsed_time=elapsed_time,
                reasoning_content=reasoning_content,
                has_reasoning=has_reasoning,
                has_content=has_content,
                has_tool_calls=has_tool_calls,
            )

        except Exception as event_error:
            logger.error(f"[{request_id}] 非流式响应事件触发失败: {event_error}", exc_info=True)
            # 事件触发失败不应该阻止响应返回

    @staticmethod
    async def _trigger_v2_atomic_reply_event(
        response: ChatCompletion,
        agent_context: AgentContextInterface,
        model_id: str,
        model_name: str,
        request_id: Optional[str],
        elapsed_time: float,
        has_reasoning: bool,
        has_content: bool,
        has_tool_calls: bool,
        input_breakdown: ContextInputBreakdown | None = None,
    ) -> None:
        """按 V2 协议用完整 Assistant message 原子触发一次回复完成事件。"""
        if not (has_reasoning or has_content or has_tool_calls):
            logger.warning(f"[{request_id}] V2 非流式响应没有有效字段，跳过 Reply 事件")
            return

        if has_reasoning:
            await ThinkEventManager.trigger_before_think(
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
            )
            logger.debug(f"[{request_id}] V2 非流式：检测到 reasoning_content，触发 BEFORE_AGENT_THINK")

        if has_content or (has_reasoning and not has_tool_calls):
            await ThinkEventManager.trigger_after_think(
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
                request_id=request_id,
            )
            logger.debug(f"[{request_id}] V2 非流式：触发 AFTER_AGENT_THINK")
        elif has_reasoning and has_tool_calls:
            logger.debug(f"[{request_id}] V2 非流式：reasoning + tool_calls，保持思考生命周期")

        correlation_id = RegularCallProcessor._resolve_v2_reply_correlation_id(
            agent_context=agent_context,
            request_id=request_id,
        )
        await ReplyEventManager.trigger_after_reply(
            agent_context=agent_context,
            model_id=model_id,
            model_name=model_name,
            request_id=request_id,
            response=response,
            execution_time=elapsed_time,
            use_stream_mode=False,
            content_type="content",
            correlation_id=correlation_id,
            input_breakdown=input_breakdown,
        )
        logger.debug(f"[{request_id}] V2 非流式：原子 AFTER_AGENT_REPLY 已触发，correlation_id={correlation_id}")

    @staticmethod
    def _resolve_v2_reply_correlation_id(
        agent_context: AgentContextInterface,
        request_id: Optional[str],
    ) -> Optional[str]:
        """解析 V2 普通非流式或流式降级场景使用的稳定关联 ID。"""
        from agentlang.event import get_correlation_manager

        correlation_manager = get_correlation_manager()
        correlation_scope_id = getattr(agent_context, "context_id", None)
        stream_fallback_cid = correlation_manager.pop_stream_fallback_cid(correlation_scope_id)
        if stream_fallback_cid:
            logger.info(
                f"[{request_id}] V2 非流式回复复用流式 correlation_id={stream_fallback_cid}"
            )
            return stream_fallback_cid
        return request_id

    @staticmethod
    async def _trigger_v1_phased_reply_events(
        response: ChatCompletion,
        agent_context: AgentContextInterface,
        model_id: str,
        model_name: str,
        request_id: Optional[str],
        elapsed_time: float,
        reasoning_content: Optional[str],
        has_reasoning: bool,
        has_content: bool,
        has_tool_calls: bool,
    ) -> None:
        """保持 V1 reasoning/content 分阶段 Reply 事件语义。"""
        if has_reasoning:
            await ThinkEventManager.trigger_before_think(
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
            )
            logger.debug(f"[{request_id}] V1 非流式：检测到 reasoning_content，触发 BEFORE_AGENT_THINK")

            await ReplyEventManager.trigger_before_reply(
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
                request_id=request_id,
                use_stream_mode=False,
                content_type="reasoning",
            )
            await ReplyEventManager.trigger_after_reply(
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
                request_id=request_id,
                response=response if not has_content else None,
                execution_time=elapsed_time,
                use_stream_mode=False,
                content_type="reasoning",
                content=reasoning_content or "",
            )
            logger.debug(f"[{request_id}] V1 非流式：reasoning REPLY 事件已触发")

        if has_content:
            await ThinkEventManager.trigger_after_think(
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
                request_id=request_id,
            )
            logger.debug(f"[{request_id}] V1 非流式：检测到 content，触发 AFTER_AGENT_THINK")

            await ReplyEventManager.trigger_before_reply(
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
                request_id=request_id,
                use_stream_mode=False,
                content_type="content",
            )
            await ReplyEventManager.trigger_after_reply(
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
                request_id=request_id,
                response=response,
                execution_time=elapsed_time,
                use_stream_mode=False,
                content_type="content",
            )
            logger.debug(f"[{request_id}] V1 非流式：content REPLY 事件已触发")

        if has_tool_calls and not has_reasoning and not has_content:
            logger.debug(f"[{request_id}] V1 非流式：只有 tool_calls，不触发 THINK 或 REPLY 事件")

        if has_reasoning and not has_content and not has_tool_calls:
            await ThinkEventManager.trigger_after_think(
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
                request_id=request_id,
            )
            logger.debug(f"[{request_id}] V1 非流式：只有 reasoning，触发 AFTER_AGENT_THINK")
        elif has_reasoning and has_tool_calls and not has_content:
            logger.debug(f"[{request_id}] V1 非流式：reasoning + tool_calls，保持思考生命周期")
