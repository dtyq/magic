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

        # Qwen3 enable_thinking 参数检查和处理，非 stream 模式必须设置为 false，通过 extra_body 传入
        if llm_config.name.startswith("qwen3"):
            request_params["extra_body"] = {"enable_thinking": False}

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
                elapsed_time=elapsed_time
            )

        return response

    @staticmethod
    async def _trigger_response_events(
        response: ChatCompletion,
        agent_context: AgentContextInterface,
        model_id: str,
        model_name: str,
        request_id: Optional[str],
        elapsed_time: float
    ) -> None:
        """根据响应内容触发相应的事件。

        事件触发逻辑与流式模式一致：
        - 场景一：只有 reasoning -> 触发 reasoning REPLY 事件，AFTER_THINK 由 finally 保底
        - 场景二：只有 content -> 触发 AFTER_THINK + content REPLY 事件
        - 场景三：只有 tool_calls -> 无 REPLY 事件，AFTER_THINK 由 finally 保底
        - 场景四：reasoning + tool_calls -> 触发 reasoning REPLY 事件，AFTER_THINK 由 finally 保底
        - 场景五：content + tool_calls -> 触发 AFTER_THINK + content REPLY 事件
        - 场景六：reasoning + content -> 触发 reasoning REPLY + AFTER_THINK + content REPLY 事件
        - 场景七：reasoning + content + tool_calls -> 同场景六

        Args:
            response: LLM响应
            agent_context: Agent上下文
            model_id: 模型ID
            model_name: 模型名称
            request_id: 请求ID
            elapsed_time: 执行时间（毫秒）
        """
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

            # ===== 处理 reasoning_content =====
            if has_reasoning:
                # 1. 触发 BEFORE_AGENT_THINK（内部会检查是否已在思考中）
                await ThinkEventManager.trigger_before_think(
                    agent_context=agent_context,
                    model_id=model_id,
                    model_name=model_name
                )
                logger.debug(f"[{request_id}] 非流式：检测到 reasoning_content，触发 BEFORE_AGENT_THINK")

                # 2. 触发 before_agent_reply(content_type=reasoning)
                await ReplyEventManager.trigger_before_reply(
                    agent_context=agent_context,
                    model_id=model_id,
                    model_name=model_name,
                    request_id=request_id,
                    use_stream_mode=False,
                    content_type="reasoning"
                )

                # 3. 触发 after_agent_reply(content_type=reasoning)
                # 如果后续还有 content，则 reasoning 不传 response（避免重复 token_usage）
                # 只有当 reasoning 是最后一个事件时，才传 response
                await ReplyEventManager.trigger_after_reply(
                    agent_context=agent_context,
                    model_id=model_id,
                    model_name=model_name,
                    request_id=request_id,
                    response=response if not has_content else None,
                    execution_time=elapsed_time,
                    use_stream_mode=False,
                    content_type="reasoning",
                    content=reasoning_content
                )
                logger.debug(f"[{request_id}] 非流式：reasoning REPLY 事件已触发")

            # ===== 处理 content（思考结束的唯一标志）=====
            if has_content:
                # 1. 触发 AFTER_AGENT_THINK（content 的出现标志着思考结束）
                await ThinkEventManager.trigger_after_think(
                    agent_context=agent_context,
                    model_id=model_id,
                    model_name=model_name,
                    request_id=request_id
                )
                logger.debug(f"[{request_id}] 非流式：检测到 content，触发 AFTER_AGENT_THINK")

                # 2. 触发 before_agent_reply(content_type=content)
                await ReplyEventManager.trigger_before_reply(
                    agent_context=agent_context,
                    model_id=model_id,
                    model_name=model_name,
                    request_id=request_id,
                    use_stream_mode=False,
                    content_type="content"
                )

                # 3. 触发 after_agent_reply(content_type=content)
                await ReplyEventManager.trigger_after_reply(
                    agent_context=agent_context,
                    model_id=model_id,
                    model_name=model_name,
                    request_id=request_id,
                    response=response,
                    execution_time=elapsed_time,
                    use_stream_mode=False,
                    content_type="content"
                )
                logger.debug(f"[{request_id}] 非流式：content REPLY 事件已触发")

            # ===== 只有 tool_calls 的情况 =====
            # 没有 reasoning_content，不触发任何 THINK 事件
            # 注意：不触发 REPLY 事件（无文本内容）
            if has_tool_calls and not has_reasoning and not has_content:
                logger.debug(f"[{request_id}] 非流式：只有 tool_calls（无文本内容），不触发任何 THINK 事件")

            # ===== 补充：处理结束时触发 AFTER_AGENT_THINK（如果有思考但未触发）=====
            # 覆盖场景：
            # - 场景一：只有 reasoning（无 content，无 tool_calls）
            # 注意：场景四（reasoning + tool_calls）不在此触发，因为工具调用属于思考过程，
            #       思考应该持续到下一轮（或者在后续检测到 content 时结束）
            # 如果已触发过（如场景六/七中检测到 content 时），会自动跳过
            if has_reasoning and not has_content and not has_tool_calls:
                await ThinkEventManager.trigger_after_think(
                    agent_context=agent_context,
                    model_id=model_id,
                    model_name=model_name,
                    request_id=request_id
                )
                logger.debug(f"[{request_id}] 非流式：只有 reasoning（无 content，无 tool_calls），触发 AFTER_AGENT_THINK")
            elif has_reasoning and has_tool_calls and not has_content:
                logger.debug(f"[{request_id}] 非流式：有 reasoning + tool_calls（无 content），思考继续，不触发 AFTER_AGENT_THINK")

        except Exception as event_error:
            logger.error(f"[{request_id}] 非流式响应事件触发失败: {event_error}", exc_info=True)
            # 事件触发失败不应该阻止响应返回
