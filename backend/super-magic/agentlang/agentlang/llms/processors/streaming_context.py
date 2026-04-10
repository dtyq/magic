"""
Streaming Context Module

流式处理上下文模块，定义流式处理的输入上下文、输出结果数据结构，以及流式响应处理器。
"""

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Dict, List, Literal, Optional, cast

# OpenAI finish_reason literal type
FinishReason = Literal["stop", "length", "tool_calls", "content_filter", "function_call"]

from openai.types.chat import ChatCompletion, ChatCompletionChunk
from openai.types.chat.chat_completion import Choice
from openai.types.chat.chat_completion_message import ChatCompletionMessage
from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall, Function
from openai.types.completion_usage import CompletionUsage

from agentlang.config.config import config
from agentlang.exceptions import StreamChunkTimeoutError, StreamInterruptedError, STREAMING_PASSTHROUGH_EXCEPTIONS
from agentlang.interface.context import AgentContextInterface
from agentlang.logger import get_logger
from agentlang.event.reply_event_manager import ReplyEventManager
from agentlang.event.think_event_manager import ThinkEventManager

from .processor_config import ProcessorConfig
from .streaming_util import StreamingState, StreamingHelper
from .streaming_log_util import StreamingLogger, SLOW_CHUNK_THRESHOLD, VERY_SLOW_CHUNK_THRESHOLD
from .chunk_processor import ChunkProcessor

logger = get_logger(__name__)

DEFAULT_TIMEOUT = int(config.get("llm.api_timeout", 1800))
# 后续 chunk 超时的全局兜底值（正常路径由 ProcessorConfig.stream_chunk_timeout_seconds 覆盖）
CHUNK_TIMEOUT = int(config.get("llm.chunk_timeout", 10))


@dataclass
class StreamProcessContext:
    """
    流式处理上下文。

    封装流式处理所需的所有上下文信息，包括请求标识、配置和可选的运行时信息。
    """

    # Request identifiers
    request_id: str
    model_id: str
    correlation_id: str

    # Configuration
    processor_config: ProcessorConfig

    # Optional context
    agent_context: Optional[AgentContextInterface] = None

    # Optional runtime info
    http_request_start_time: Optional[float] = None

    # Event control
    enable_llm_response_events: bool = True
    retry_count: int = 0

    @property
    def should_trigger_events(self) -> bool:
        """Check if reply events should be triggered for the current stream."""
        return self.enable_llm_response_events

    def get_non_human_options(self):
        """Get non-human options from agent context"""
        if self.agent_context:
            return self.agent_context.get_non_human_options()
        return None

    def get_thinking_correlation_id(self) -> Optional[str]:
        """Get thinking correlation ID from agent context"""
        if self.agent_context:
            return self.agent_context.get_thinking_correlation_id()
        return None


@dataclass
class StreamProcessResult:
    """
    流式处理结果。

    封装流式处理的所有输出数据。
    """

    # Collected stream chunks
    collected_chunks: List[ChatCompletionChunk] = field(default_factory=list)

    # Text content
    completion_text: str = ""
    reasoning_content: str = ""

    # Tool calls
    tool_calls: Dict[int, Dict[str, Any]] = field(default_factory=dict)

    # Completion info
    finish_reason: Optional[str] = None
    usage: Optional[CompletionUsage] = None


class StreamResponseHandler:
    """
    流式响应处理器。

    负责处理流式响应的核心逻辑，包括：
    - 处理流式 chunks
    - 构建完整的 ChatCompletion 响应
    """

    @staticmethod
    async def _trigger_after_agent_think_with_config(
        processor_config: ProcessorConfig,
        model_id: str,
        agent_context: Optional[AgentContextInterface],
        request_id: str
    ) -> None:
        """从 ProcessorConfig 获取模型信息并触发 AFTER_AGENT_THINK 事件的辅助方法"""
        trigger_model_id = processor_config.model_id if processor_config.model_id else model_id
        trigger_model_name = processor_config.model_name if processor_config.model_name else model_id

        await ThinkEventManager.trigger_after_think(
            agent_context=agent_context,
            model_id=trigger_model_id,
            model_name=trigger_model_name,
            request_id=request_id
        )

    @staticmethod
    def build_completion_response(
        result: "StreamProcessResult",
        llm_config
    ) -> ChatCompletion:
        """构建完整的 ChatCompletion 响应

        Args:
            result: 流式处理结果
            llm_config: LLM 配置

        Returns:
            ChatCompletion: 完整的响应对象
        """
        # 构建工具调用列表
        message_tool_calls: Optional[List[ChatCompletionMessageToolCall]] = None
        if result.tool_calls:
            message_tool_calls = [
                ChatCompletionMessageToolCall(
                    id=tc["id"],
                    type=tc["type"],
                    function=Function(
                        name=tc["function"]["name"],
                        arguments=tc["function"]["arguments"]
                    )
                )
                for tc in sorted(result.tool_calls.values(), key=lambda x: list(result.tool_calls.keys()).index(next(k for k, v in result.tool_calls.items() if v == x)))
            ]

        # 构建响应消息
        response_message: ChatCompletionMessage = ChatCompletionMessage(
            role="assistant",
            content=result.completion_text if result.completion_text else None,
            tool_calls=message_tool_calls
        )

        # 将 reasoning_content 作为额外属性附加到 message 对象（用于思考模型）
        if result.reasoning_content:
            setattr(response_message, 'reasoning_content', result.reasoning_content)

        # 构建选择项
        choices: List[Choice] = [
            Choice(
                index=0,
                message=response_message,
                finish_reason=cast(FinishReason, result.finish_reason or 'stop')
            )
        ]

        # 如果没有 usage 信息，创建一个空的
        usage = result.usage
        if not usage:
            usage = CompletionUsage(
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0
            )

        # 构建完整的 ChatCompletion 响应
        response: ChatCompletion = ChatCompletion(
            id=result.collected_chunks[0].id if result.collected_chunks else "chatcmpl-unknown",
            choices=choices,
            created=result.collected_chunks[0].created if result.collected_chunks else 0,
            model=result.collected_chunks[0].model if result.collected_chunks else llm_config.name,
            object="chat.completion",
            usage=usage
        )

        return response

    @staticmethod
    async def process_stream_chunks(
        stream: AsyncIterator[ChatCompletionChunk],
        streaming_driver,
        context: "StreamProcessContext"
    ) -> "StreamProcessResult":
        """处理流式响应，收集chunks并构建最终响应数据

        包含开始消息推送、流式chunk处理和完成消息推送的完整流程

        Args:
            stream: LLM 返回的异步流式响应对象
            streaming_driver: 流式推送驱动实例
            context: 流式处理上下文

        Returns:
            StreamProcessResult: 流式处理结果
        """
        # Extract frequently used values from context
        request_id = context.request_id
        model_id = context.model_id
        correlation_id = context.correlation_id
        processor_config = context.processor_config
        agent_context = context.agent_context
        http_request_start_time = context.http_request_start_time

        # 判断是否应该触发事件（首次调用且启用事件）
        should_trigger_events = context.should_trigger_events

        # 直接从 agent_context 获取非人类限流配置
        non_human_options = context.get_non_human_options()

        # 记录流式处理开始时间
        stream_start_time = time.time()
        # 使用HTTP请求开始时间作为基准时间（如果提供的话）
        base_time = http_request_start_time if http_request_start_time else stream_start_time
        last_chunk_time = stream_start_time  # 记录上一个块的时间，初始化为当前开始时间
        StreamingLogger.log_stream_start(request_id, correlation_id)

        # 初始化流式状态管理
        parent_correlation_id = agent_context.get_thinking_correlation_id() if agent_context else None
        state = StreamingState(parent_correlation_id=parent_correlation_id, last_content_time=time.time())
        include_full_content = processor_config.stream_end_include_full_content

        # 流式消息的 correlation_id 跟踪（在 before_agent_reply 事件触发后更新）
        # reasoning 和 content 各自有独立的 correlation_id
        reasoning_stream_correlation_id = correlation_id  # 默认使用传入的 correlation_id
        content_stream_correlation_id = correlation_id    # 默认使用传入的 correlation_id

        # 收集流式响应
        collected_chunks: List[ChatCompletionChunk] = []
        finish_reason: Optional[str] = None
        usage: Optional[CompletionUsage] = None

        # 流处理整体超时兜底（保留宽松上限，防止极端情况下进程永久挂起）
        stream_timeout = DEFAULT_TIMEOUT + 60

        # 首包 deadline：http_request_start_time + 首包窗口；响应头返回后，首个 chunk 只使用剩余预算
        first_chunk_timeout = processor_config.stream_first_chunk_timeout_seconds
        first_chunk_deadline = (
            (http_request_start_time or stream_start_time) + first_chunk_timeout
            if first_chunk_timeout else None
        )
        chunk_timeout = processor_config.stream_chunk_timeout_seconds or CHUNK_TIMEOUT

        last_chunk = None  # 保存最后一个 chunk 用于日志输出（仅用于日志）

        try:
            # 使用asyncio.wait_for为整个流处理添加超时
            async def process_stream():
                nonlocal state, collected_chunks, finish_reason, usage
                nonlocal last_chunk_time, base_time, last_chunk
                nonlocal reasoning_stream_correlation_id, content_stream_correlation_id

                # 并行任务机制：同时等待chunk和中断事件
                stream_iter = aiter(stream)
                while True:
                    # 首个 chunk 使用首包剩余预算，后续 chunk 使用固定超时
                    if state.received_chunk_count == 0 and first_chunk_deadline is not None:
                        remaining = max(first_chunk_deadline - time.time(), 0.001)
                        effective_chunk_timeout = remaining
                    else:
                        effective_chunk_timeout = chunk_timeout

                    # 创建chunk等待任务
                    chunk_task = asyncio.create_task(
                        asyncio.wait_for(anext(stream_iter), timeout=effective_chunk_timeout),
                        name=f"chunk_wait_{state.received_chunk_count}"
                    )

                    # 创建中断监听任务（如果有agent_context）
                    interrupt_task = None
                    if agent_context:
                        interrupt_event = agent_context.get_interruption_event()
                        interrupt_task = asyncio.create_task(
                            interrupt_event.wait(),
                            name=f"interrupt_listen_{state.received_chunk_count}"
                        )

                    try:
                        # 等待任一任务完成
                        if interrupt_task:
                            done, pending = await asyncio.wait(
                                [chunk_task, interrupt_task],
                                return_when=asyncio.FIRST_COMPLETED
                            )
                        else:
                            # 没有中断监听，只等待chunk
                            done, pending = {chunk_task}, set()
                            await chunk_task

                        # 取消未完成的任务
                        for task in pending:
                            task.cancel()
                            try:
                                await task
                            except asyncio.CancelledError:
                                pass

                        # 检查是哪个任务完成了
                        if interrupt_task and interrupt_task in done:
                            # 中断任务完成 = 收到中断信号，标记后退出
                            StreamingLogger.log_stream_interrupted(request_id, state, correlation_id)
                            state.interrupted_by_signal = True
                            break

                        if chunk_task in done:
                            # Chunk任务完成 = 收到新chunk
                            try:
                                chunk = chunk_task.result()
                                state.increment_chunk_count()

                                # 计算当前chunk的时间指标
                                chunk_time = time.time()
                                # 从HTTP请求开始到当前chunk的总耗时
                                total_latency = chunk_time - base_time
                                # 当前chunk与上一个chunk之间的间隔时间
                                interval_time = chunk_time - last_chunk_time

                                # 更新 chunk 间隔统计
                                state.update_chunk_interval_stats(interval_time, SLOW_CHUNK_THRESHOLD, VERY_SLOW_CHUNK_THRESHOLD)

                                # 记录 chunk 日志（包含慢速检测、详细信息、进度日志）
                                StreamingLogger.log_chunk_received(
                                    request_id, state, interval_time, total_latency, correlation_id, chunk
                                )

                                # 更新上一个块的时间
                                last_chunk_time = chunk_time

                                # 类型检查：确保chunk是ChatCompletionChunk类型
                                if not isinstance(chunk, ChatCompletionChunk):
                                    state.record_invalid_chunk()
                                    StreamingLogger.log_invalid_chunk(request_id, state, type(chunk))
                                    # 连续收到过多无效chunk时退出
                                    if state.is_max_invalid_chunk_reached():
                                        StreamingLogger.log_invalid_chunk(request_id, state, type(chunk), should_stop=True)
                                        break
                                    continue

                                # 重置无效chunk计数
                                state.reset_invalid_chunk_count()
                                # 只有类型正确的chunk才进行处理
                                collected_chunks.append(chunk)
                                # 保存最后一个chunk用于日志输出
                                last_chunk = chunk

                                # 处理单个 chunk（直接修改 state 中的 tool_calls 相关字段）
                                chunk_result = ChunkProcessor.process(chunk, state, finish_reason)
                                temp_text = chunk_result.text
                                chunk_content_type = chunk_result.text_type
                                has_tool_call = chunk_result.has_tool_call
                                finish_reason = chunk_result.finish_reason

                                # 根据内容类型累积到对应的变量
                                has_content = False
                                has_reasoning_content = False
                                if chunk_content_type == "reasoning":
                                    state.reasoning_text += temp_text
                                    has_reasoning_content = len(temp_text) > 0
                                elif chunk_content_type == "content":
                                    state.content_text += temp_text
                                    has_content = len(temp_text) > 0

                                # ===== 处理 reasoning_content（第一个非空 chunk）=====
                                if has_reasoning_content and not state.reasoning_reply_started:
                                    # 1. 触发 BEFORE_AGENT_THINK（内部会检查是否已在思考中）
                                    if agent_context and should_trigger_events:
                                        await ThinkEventManager.trigger_before_think(
                                            agent_context=agent_context,
                                            model_id=model_id,
                                            model_name=processor_config.model_name or model_id
                                        )
                                        logger.debug(f"[{request_id}] 流式：检测到 reasoning_content，触发 BEFORE_AGENT_THINK")
                                        StreamingLogger.log_thinking_detected(request_id)

                                    # 2. 触发 before_agent_reply(content_type=reasoning)（重试时跳过）
                                    if should_trigger_events:
                                        event_correlation_id = await ReplyEventManager.trigger_before_reply(
                                            agent_context=agent_context,
                                            model_id=model_id,
                                            model_name=processor_config.model_name or model_id,
                                            request_id=request_id,
                                            use_stream_mode=True,
                                            content_type="reasoning"
                                        )
                                        # 使用事件返回的 correlation_id 更新流式消息的 correlation_id
                                        if event_correlation_id:
                                            reasoning_stream_correlation_id = event_correlation_id
                                            logger.debug(f"[{request_id}] reasoning 流式消息使用 correlation_id={reasoning_stream_correlation_id}")

                                    # 3. 使用高层封装开始 reasoning 流式输出
                                    await StreamingHelper.start_new_stream(
                                        streaming_driver=streaming_driver,
                                        state=state,
                                        request_id=request_id,
                                        model_id=model_id,
                                        correlation_id=reasoning_stream_correlation_id,
                                        content_type="reasoning"
                                    )
                                    state.reasoning_reply_started = True
                                    StreamingLogger.log_stream_phase_start(request_id, "reasoning")

                                # ===== 处理 content（第一个非空 chunk = 思考结束的唯一标志）=====
                                if has_content and not state.content_reply_started:
                                    # 1. 如果之前在输出思考内容，需要先结束思考
                                    if state.reasoning_reply_started and state.is_in_reasoning_phase():
                                        # 使用高层封装结束 reasoning 流式输出
                                        await StreamingHelper.end_current_stream(
                                            streaming_driver=streaming_driver,
                                            state=state,
                                            request_id=request_id,
                                            model_id=model_id,
                                            correlation_id=reasoning_stream_correlation_id,
                                            include_full_content=include_full_content
                                        )
                                        # 触发 after_agent_reply(content_type=reasoning)（重试时跳过）
                                        if should_trigger_events:
                                            await ReplyEventManager.trigger_after_reply(
                                                agent_context=agent_context,
                                                model_id=model_id,
                                                model_name=processor_config.model_name or model_id,
                                                request_id=request_id,
                                                use_stream_mode=True,
                                                content_type="reasoning",
                                                content=state.reasoning_text
                                            )
                                        StreamingLogger.log_stream_phase_end(request_id, "reasoning", "结束 reasoning")

                                    # 2. 检测到 content = 思考结束，触发 AFTER_AGENT_THINK（重试时跳过）
                                    if not state.after_think_sent and should_trigger_events:
                                        await StreamResponseHandler._trigger_after_agent_think_with_config(
                                            processor_config, model_id, agent_context, request_id
                                        )
                                        state.after_think_sent = True
                                        StreamingLogger.log_after_think_triggered(request_id)

                                    # 3. 触发 before_agent_reply(content_type=content)（重试时跳过）
                                    if should_trigger_events:
                                        event_correlation_id = await ReplyEventManager.trigger_before_reply(
                                            agent_context=agent_context,
                                            model_id=model_id,
                                            model_name=processor_config.model_name or model_id,
                                            request_id=request_id,
                                            use_stream_mode=True,
                                            content_type="content"
                                        )
                                        # 使用事件返回的 correlation_id 更新流式消息的 correlation_id
                                        if event_correlation_id:
                                            content_stream_correlation_id = event_correlation_id
                                            logger.debug(f"[{request_id}] content 流式消息使用 correlation_id={content_stream_correlation_id}")

                                    # 4. 使用高层封装开始 content 流式输出
                                    await StreamingHelper.start_new_stream(
                                        streaming_driver=streaming_driver,
                                        state=state,
                                        request_id=request_id,
                                        model_id=model_id,
                                        correlation_id=content_stream_correlation_id,
                                        content_type="content"
                                    )
                                    state.content_reply_started = True
                                    StreamingLogger.log_stream_phase_start(request_id, "content")

                                # 判断是否有新内容
                                has_new_content = has_content or has_reasoning_content or has_tool_call or finish_reason is not None
                                if has_new_content:
                                    state.record_valid_content(time.time())
                                else:
                                    state.record_empty_chunk()

                                # 检测连续空 chunk 或长时间无有效内容
                                current_time = time.time()
                                time_since_last_content = current_time - state.last_content_time

                                if state.is_max_empty_chunk_reached():
                                    StreamingLogger.log_empty_chunks_stop(request_id, state, time_since_last_content)
                                    break

                                # ===== 检测到工具调用时，结束当前流式输出 =====
                                if has_tool_call and not state.tool_call_started:
                                    state.tool_call_started = True

                                    # 注意：没有 reasoning_content 就不会触发 BEFORE_AGENT_THINK
                                    # 因此也不需要触发 AFTER_AGENT_THINK

                                    # 如果有正在进行的流式输出，先结束它
                                    if state.is_in_reasoning_phase() and state.reasoning_reply_started:
                                        # 使用高层封装结束 reasoning 流式输出
                                        await StreamingHelper.end_current_stream(
                                            streaming_driver=streaming_driver,
                                            state=state,
                                            request_id=request_id,
                                            model_id=model_id,
                                            correlation_id=reasoning_stream_correlation_id,
                                            include_full_content=include_full_content
                                        )
                                        # 触发 after_agent_reply(content_type=reasoning)（重试时跳过）
                                        if should_trigger_events:
                                            await ReplyEventManager.trigger_after_reply(
                                                agent_context=agent_context,
                                                model_id=model_id,
                                                model_name=processor_config.model_name or model_id,
                                                request_id=request_id,
                                                use_stream_mode=True,
                                                content_type="reasoning",
                                                content=state.reasoning_text
                                            )
                                        StreamingLogger.log_tool_call_end_stream(request_id, "reasoning")

                                    elif state.is_in_content_phase() and state.content_reply_started:
                                        # 使用高层封装结束 content 流式输出
                                        await StreamingHelper.end_current_stream(
                                            streaming_driver=streaming_driver,
                                            state=state,
                                            request_id=request_id,
                                            model_id=model_id,
                                            correlation_id=content_stream_correlation_id,
                                            include_full_content=include_full_content
                                        )
                                        # 触发 after_agent_reply(content_type=content)（重试时跳过）
                                        if should_trigger_events:
                                            await ReplyEventManager.trigger_after_reply(
                                                agent_context=agent_context,
                                                model_id=model_id,
                                                model_name=processor_config.model_name or model_id,
                                                request_id=request_id,
                                                use_stream_mode=True,
                                                content_type="content",
                                                content=state.content_text
                                            )
                                        state.content_completion_sent = True
                                        StreamingLogger.log_tool_call_end_stream(request_id, "content")

                                # ===== 推送流式数据块 =====
                                # 推送 reasoning 流式数据块
                                if has_reasoning_content and state.reasoning_reply_started and not state.tool_call_started:
                                    chunk_id = state.increment_chunk_id()
                                    await StreamingHelper.send_stream_chunk(
                                        streaming_driver=streaming_driver,
                                        request_id=request_id,
                                        model_id=model_id,
                                        correlation_id=reasoning_stream_correlation_id,
                                        parent_correlation_id=state.parent_correlation_id,
                                        content_type="reasoning",
                                        content=temp_text,
                                        chunk_id=chunk_id
                                    )

                                    # 如果启用了非人类限流，在推送完成后注入 chunk 延迟
                                    await StreamingHelper.apply_chunk_delay(
                                        non_human_options, state.received_chunk_count, request_id
                                    )

                                # 推送 content 流式数据块（仅在未开始工具调用且有 content 时推送）
                                if has_content and state.content_reply_started and not state.tool_call_started:
                                    chunk_id = state.increment_chunk_id()
                                    await StreamingHelper.send_stream_chunk(
                                        streaming_driver=streaming_driver,
                                        request_id=request_id,
                                        model_id=model_id,
                                        correlation_id=content_stream_correlation_id,
                                        parent_correlation_id=state.parent_correlation_id,
                                        content_type="content",
                                        content=temp_text,
                                        chunk_id=chunk_id
                                    )

                                    # 如果启用了非人类限流，在推送完成后注入 chunk 延迟
                                    await StreamingHelper.apply_chunk_delay(
                                        non_human_options, state.received_chunk_count, request_id
                                    )

                                # 获取 usage 信息（通常在最后一个 chunk）
                                if chunk.usage:
                                    usage = chunk.usage

                                # 检查完成状态
                                if finish_reason is not None and not state.finish_reason_received:
                                    # 第一次收到 finish_reason，标记但不停止，继续等待包含 usage 的数据块
                                    state.finish_reason_received = True
                                    StreamingLogger.log_finish_reason_received(request_id, state, finish_reason, correlation_id)
                                elif state.finish_reason_received:
                                    # 已经收到 finish_reason，现在处理后续的数据块
                                    # 如果收到了 usage 信息或者是空的 choices 数组，则停止
                                    if chunk.usage or (hasattr(chunk, 'choices') and len(chunk.choices) == 0):
                                        StreamingLogger.log_usage_received_stop(request_id, state, correlation_id, chunk)
                                        break

                            except StopAsyncIteration as e:
                                # 流迭代器耗尽：底层HTTP连接已关闭
                                # 需要判断是正常结束还是异常中断

                                # 尝试获取底层异常原因
                                root_cause = e.__cause__ or e.__context__
                                root_cause_info = f"底层原因: {type(root_cause).__name__} - {root_cause}" if root_cause else "底层原因: 未知（可能是服务端正常关闭或异常断开）"

                                if finish_reason is None:
                                    # 异常情况：流提前结束，没有收到完成标记
                                    StreamingLogger.log_stream_abnormal_end(
                                        request_id, state, correlation_id, usage is not None, root_cause_info, last_chunk
                                    )

                                    total_elapsed = time.time() - base_time
                                    raise StreamInterruptedError(
                                        chunk_count=state.received_chunk_count,
                                        total_elapsed_seconds=total_elapsed,
                                    ) from e
                                else:
                                    # 正常情况：有finish_reason，虽然可能缺少usage
                                    StreamingLogger.log_stream_normal_end(
                                        request_id, state, finish_reason, correlation_id, last_chunk
                                    )
                                break
                            except asyncio.TimeoutError:
                                total_elapsed = time.time() - base_time
                                StreamingLogger.log_chunk_timeout(request_id, state, effective_chunk_timeout, total_elapsed)
                                raise StreamChunkTimeoutError(
                                    chunk_count=state.received_chunk_count,
                                    chunk_timeout_seconds=effective_chunk_timeout,
                                    total_elapsed_seconds=total_elapsed,
                                )
                            # --- 异常穿透规则 ---
                            # STREAMING_PASSTHROUGH_EXCEPTIONS 中的异常不应被包装，
                            # 必须原样抛出以便上层正确识别和处理。
                            # 新增自定义异常时，若需穿透通用 except，加入该元组即可。
                            except STREAMING_PASSTHROUGH_EXCEPTIONS:
                                raise
                            except Exception as e:
                                StreamingLogger.log_chunk_exception(request_id, state, e)
                                raise RuntimeError(f"Error processing chunk {state.received_chunk_count}: {e}") from e

                    except Exception as e:
                        StreamingLogger.log_parallel_task_exception(request_id, e)
                        raise

            await asyncio.wait_for(process_stream(), timeout=stream_timeout)

        # ===== 异常处理分层（Layer 1：诊断与分类） =====
        #
        # 本层是异常的"产生和首次分类"层，职责：
        # 1. 结构性异常（STREAMING_PASSTHROUGH_EXCEPTIONS）：直接穿透，不记日志（已在产生处记录）
        # 2. safeguard 超时（asyncio.TimeoutError）：重新包装并保留 from 链
        # 3. 其他异常：按类型 isinstance 分类为 ConnectionError / TimeoutError，字符串匹配仅做兜底
        #
        # 所有二次包装必须使用 `from stream_error` 保留原始异常链。
        except STREAMING_PASSTHROUGH_EXCEPTIONS:
            raise
        except asyncio.TimeoutError as timeout_err:
            StreamingLogger.log_stream_timeout(request_id, state, stream_timeout, correlation_id)
            raise asyncio.TimeoutError(
                f"Stream total timeout (safeguard): exceeded {stream_timeout}s limit. "
                f"Processed {state.received_chunk_count} chunks."
            ) from timeout_err

        except Exception as stream_error:
            StreamingLogger.log_stream_error(request_id, state, stream_error, correlation_id)

            # 类型分类：优先 isinstance 判断原始异常类型，字符串匹配仅做兜底
            import httpx
            root = stream_error.__cause__ or stream_error

            if isinstance(root, (httpx.NetworkError, httpx.ProtocolError, ConnectionError)):
                raise ConnectionError(
                    f"Network connection error during stream processing: {stream_error}"
                ) from stream_error

            if isinstance(root, httpx.TimeoutException):
                raise asyncio.TimeoutError(
                    f"Timeout during stream processing: {stream_error}"
                ) from stream_error

            # 字符串兜底：覆盖 SDK 异常被 RuntimeError 包装后丢失类型的情况
            error_message = str(stream_error).lower()
            if any(kw in error_message for kw in ("connection", "network", "unreachable", "refused")):
                raise ConnectionError(
                    f"Network connection error during stream processing: {stream_error}"
                ) from stream_error
            if any(kw in error_message for kw in ("timeout", "timed out", "deadline")):
                raise asyncio.TimeoutError(
                    f"Timeout during stream processing: {stream_error}"
                ) from stream_error

            if not state.has_received_chunks():
                raise RuntimeError(
                    f"No stream data received - server may have returned an error: {stream_error}"
                ) from stream_error

            raise

        # 检查是否收到了有效的响应数据
        if not state.has_received_chunks():
            if state.interrupted_by_signal:
                # 中断信号导致退出（非服务端错误），抛 CancelledError 让上层感知中断
                # 不能抛 RuntimeError，否则 processor_manager 会降级为非流式重试，导致中断失效
                raise asyncio.CancelledError("LLM streaming stopped by interruption signal")
            StreamingLogger.log_no_data_received(request_id, correlation_id)
            raise RuntimeError(f"No stream data received from server. This may indicate a server-side error or timeout.")

        # 不完整流检测：收到了 chunk 但流正常结束却没有 finish_reason，视为连接被静默关闭
        if finish_reason is None and state.has_received_chunks() and not state.interrupted_by_signal:
            total_elapsed = time.time() - base_time
            logger.warning(
                f"[{request_id}] 流正常结束但未收到 finish_reason "
                f"(chunks={state.received_chunk_count}, elapsed={total_elapsed:.1f}s)"
            )
            raise StreamInterruptedError(
                chunk_count=state.received_chunk_count,
                total_elapsed_seconds=total_elapsed,
            )

        # 记录流式处理统计
        stream_end_time = time.time()
        total_stream_time = stream_end_time - stream_start_time
        StreamingLogger.log_stream_stats(request_id, state, correlation_id, total_stream_time, finish_reason)

        # ===== 流结束后的收尾处理 =====

        # 1. 如果还有未结束的 reasoning 流式输出（只有 reasoning，无 content 和 tool_calls 的情况）
        if state.is_in_reasoning_phase() and state.reasoning_reply_started and not state.tool_call_started:
            # 使用高层封装结束 reasoning 流式输出
            await StreamingHelper.end_current_stream(
                streaming_driver=streaming_driver,
                state=state,
                request_id=request_id,
                model_id=model_id,
                correlation_id=reasoning_stream_correlation_id,
                finish_reason=finish_reason,
                include_full_content=include_full_content
            )
            # 触发 after_agent_reply(content_type=reasoning)（重试时跳过）
            if should_trigger_events:
                await ReplyEventManager.trigger_after_reply(
                    agent_context=agent_context,
                    model_id=model_id,
                    model_name=processor_config.model_name or model_id,
                    request_id=request_id,
                    use_stream_mode=True,
                    content_type="reasoning",
                    content=state.reasoning_text
                )
            logger.debug(f"[{request_id}] 流结束，发送 reasoning 流式结束标记")

        # 2. 如果还有未结束的 content 流式输出
        elif state.is_in_content_phase() and state.content_reply_started and not state.content_completion_sent:
            # 使用高层封装结束 content 流式输出
            await StreamingHelper.end_current_stream(
                streaming_driver=streaming_driver,
                state=state,
                request_id=request_id,
                model_id=model_id,
                correlation_id=content_stream_correlation_id,
                finish_reason=finish_reason,
                include_full_content=include_full_content
            )
            # 触发 after_agent_reply(content_type=content)（重试时跳过）
            if should_trigger_events:
                await ReplyEventManager.trigger_after_reply(
                    agent_context=agent_context,
                    model_id=model_id,
                    model_name=processor_config.model_name or model_id,
                    request_id=request_id,
                    use_stream_mode=True,
                    content_type="content",
                    content=state.content_text
                )
            state.content_completion_sent = True
            logger.debug(f"[{request_id}] 流结束，发送 content 流式结束标记")

        # 3. 如果没有任何流式输出开始（只有 tool_calls 的情况），无需发送结束标记

        # ===== 补充：流结束时触发 AFTER_AGENT_THINK（如果有思考但未触发）=====
        # 覆盖场景：
        # - 场景一：只有 reasoning（无 content，无 tool_calls）
        # 注意：场景四（reasoning + tool_calls）不在此触发，因为工具调用属于思考过程，
        #       思考应该持续到下一轮（或者在后续检测到 content 时结束）
        # 如果已触发过（如场景六/七中检测到 content 时），会自动跳过
        if not state.after_think_sent and should_trigger_events and agent_context:
            # 关键判断：只有在没有 tool_calls 时才触发
            # 如果有 tool_calls，说明思考还在继续（工具调用属于思考过程）
            if not state.tool_calls:
                await StreamResponseHandler._trigger_after_agent_think_with_config(
                    processor_config, model_id, agent_context, request_id
                )
                state.after_think_sent = True
                logger.debug(f"[{request_id}] 流结束，触发 AFTER_AGENT_THINK（只有 reasoning，无 tool_calls）")
            else:
                logger.debug(f"[{request_id}] 流结束，有 tool_calls，思考继续，不触发 AFTER_AGENT_THINK")

        # 记录思考内容统计
        StreamingLogger.log_reasoning_collected(request_id, state)

        return StreamProcessResult(
            collected_chunks=collected_chunks,
            completion_text=state.content_text,
            reasoning_content=state.reasoning_text,
            tool_calls=state.tool_calls,
            finish_reason=finish_reason,
            usage=usage
        )
