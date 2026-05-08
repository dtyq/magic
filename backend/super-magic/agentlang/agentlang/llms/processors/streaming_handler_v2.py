"""
V2 流式响应处理器。

V2 流式处理：直传 LLM raw chunk，流结束统一触发一次 after_agent_reply。

与 V1 的核心差异：
- 不拆分 reasoning / content 两条流，每个 chunk 原样透传
- 不触发 BEFORE/AFTER_AGENT_THINK 事件
- 不触发 per-phase 的 BEFORE_AGENT_REPLY 事件
- 流结束后统一触发一次 AFTER_AGENT_REPLY（含完整 content + reasoning + tool_calls）
- chunk 携带 message_id，与后续非流式消息保持一致
"""

import asyncio
import time
from datetime import datetime
from typing import Any, AsyncIterator, Dict, List, Optional, cast

from openai.types.chat import ChatCompletion, ChatCompletionChunk
from openai.types.chat.chat_completion import Choice
from openai.types.chat.chat_completion_message import ChatCompletionMessage
from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall, Function
from openai.types.completion_usage import CompletionUsage

from agentlang.exceptions import StreamChunkTimeoutError, StreamInterruptedError, STREAMING_PASSTHROUGH_EXCEPTIONS
from agentlang.interface.context import AgentContextInterface
from agentlang.logger import get_logger
from agentlang.streaming.interface import StreamingInterface
from agentlang.streaming.models import ChunkData, ChunkDelta, ChunkMetadata, ChunkStatus

from .processor_config import ProcessorConfig
from .streaming_context import StreamProcessContext, StreamProcessResult
from .streaming_context_base import StreamResponseHandlerBase
from .streaming_log_util import StreamingLogger, SLOW_CHUNK_THRESHOLD, VERY_SLOW_CHUNK_THRESHOLD
from .streaming_util import StreamingState
from .chunk_processor import ChunkProcessor

logger = get_logger(__name__)

from agentlang.config.config import config as _agent_config

CHUNK_TIMEOUT = int(_agent_config.get("llm.chunk_timeout", 10))


def _build_super_magic_chunk(
    chunk: ChatCompletionChunk,
    first_id: str,
    first_created: int,
    correlation_id: str,
    chunk_index: int,
    label_resolver: Optional[Any] = None,
) -> Dict[str, Any]:
    """将 OpenAI ChatCompletionChunk 转换为 super_magic_chunk 格式。

    同一次 LLM 响应的所有 chunk 复用首个有效 chunk 的 id / created，保证一致性。

    Args:
        chunk: 原始 OpenAI chunk
        first_id: 首个有效 chunk 的 id（复用）
        first_created: 首个有效 chunk 的 created（复用）
        correlation_id: 本次流的关联 ID
        chunk_index: chunk 序号（0-based）
        label_resolver: 可选的工具名 -> 标签文案查询函数，有值时注入到 function.label

    Returns:
        super_magic_chunk 格式的字典
    """
    choices: List[Dict[str, Any]] = []

    for choice in chunk.choices:
        delta_dict: Dict[str, Any] = {}

        if choice.delta.role:
            delta_dict["role"] = choice.delta.role

        if choice.delta.content is not None:
            delta_dict["content"] = choice.delta.content

        # reasoning_content 由部分 LLM 提供商作为扩展属性附加
        reasoning = getattr(choice.delta, "reasoning_content", None)
        if reasoning is not None:
            delta_dict["reasoning_content"] = reasoning

        if choice.delta.tool_calls:
            tcs: List[Dict[str, Any]] = []
            for tc in choice.delta.tool_calls:
                tc_dict: Dict[str, Any] = {"index": tc.index}
                if tc.id is not None:
                    tc_dict["id"] = tc.id
                if tc.type is not None:
                    tc_dict["type"] = tc.type
                if tc.function is not None:
                    func_dict: Dict[str, Any] = {}
                    if tc.function.name is not None:
                        func_dict["name"] = tc.function.name
                        # 工具名首次出现时注入 label，后续 delta 只含 arguments，无需重复注入
                        if label_resolver:
                            label = label_resolver(tc.function.name)
                            if label:
                                func_dict["label"] = label
                    if tc.function.arguments is not None:
                        func_dict["arguments"] = tc.function.arguments
                    if func_dict:
                        tc_dict["function"] = func_dict
                tcs.append(tc_dict)
            delta_dict["tool_calls"] = tcs

        choice_dict: Dict[str, Any] = {
            "finish_reason": choice.finish_reason,
            "index": choice.index,
            "logprobs": None,
            "delta": delta_dict,
        }
        choices.append(choice_dict)

    return {
        "choices": choices,
        "created": first_created,
        "id": first_id,
        "model": chunk.model or "",
        "object": "chat.completion.chunk",
        "usage": None,
        "correlation_id": correlation_id,
        "i": chunk_index,
    }


async def _push_raw_chunk(
    streaming_driver: Any,
    super_magic_chunk: Dict[str, Any],
    request_id: str,
    correlation_id: str,
    message_id: Optional[str],
    chunk_index: int,
) -> None:
    """将 super_magic_chunk 包装为 ChunkData 并推送到 streaming_driver。"""
    if not streaming_driver:
        return

    chunk_data = ChunkData(
        request_id=request_id,
        chunk_id=chunk_index,
        content=None,
        delta=ChunkDelta(
            status=ChunkStatus.STREAMING,
            extra_fields={"super_magic_chunk": super_magic_chunk},
        ),
        timestamp=datetime.now(),
        metadata=ChunkMetadata(
            correlation_id=correlation_id,
            content_type="raw_chunk",
            message_id=message_id,
        ),
    )

    try:
        await streaming_driver.push(chunk_data)
    except Exception as e:
        logger.warning(f"[{request_id}] V2 chunk 推送失败 (index={chunk_index}): {e}")


def _get_reply_message_id(agent_context: Optional[AgentContextInterface]) -> Optional[str]:
    """从 agent_context.pending_reply_state 读取预生成的 reply_message_id。"""
    if not agent_context:
        return None
    get_state = getattr(agent_context, "get_pending_reply_state", None)
    if not callable(get_state):
        return None
    state = get_state()
    if state is None:
        return None
    return getattr(state, "message_id", None)


def _build_tool_call_objects(
    tool_calls_dict: Dict[int, Dict[str, Any]]
) -> Optional[List[ChatCompletionMessageToolCall]]:
    """将 StreamingState.tool_calls 转换为 ChatCompletionMessageToolCall 列表。"""
    if not tool_calls_dict:
        return None
    return [
        ChatCompletionMessageToolCall(
            id=tc["id"],
            type=tc["type"],
            function=Function(
                name=tc["function"]["name"],
                arguments=tc["function"]["arguments"],
            ),
        )
        for tc in sorted(tool_calls_dict.values(), key=lambda x: list(tool_calls_dict.keys()).index(
            next(k for k, v in tool_calls_dict.items() if v is x)
        ))
    ]


class StreamResponseHandlerV2(StreamResponseHandlerBase):
    """
    V2 流式响应处理器。

    直传 LLM raw chunk，流结束后统一触发一次 AFTER_AGENT_REPLY 事件。
    不拆分 reasoning / content，不管理 Think 事件。
    """

    async def process_stream_chunks(
        self,
        stream: AsyncIterator[ChatCompletionChunk],
        streaming_driver: Optional[StreamingInterface],
        context: StreamProcessContext,
    ) -> StreamProcessResult:
        """处理 V2 流式响应，直传 raw chunk，流结束统一触发 after_agent_reply。

        Args:
            stream: LLM 返回的异步流式响应对象
            streaming_driver: 流式推送驱动实例（可为 None）
            context: 流式处理上下文

        Returns:
            StreamProcessResult: 流式处理结果
        """
        request_id = context.request_id
        model_id = context.model_id
        correlation_id = context.correlation_id
        processor_config = context.processor_config
        agent_context = context.agent_context
        http_request_start_time = context.http_request_start_time
        should_trigger_events = context.should_trigger_events

        # 读取预生成的 reply_message_id（由 agent.py 在调用 LLM 前写入 pending_reply_state）
        reply_message_id = _get_reply_message_id(agent_context)
        if not reply_message_id:
            logger.debug(f"[{request_id}] V2: 未找到预生成 reply_message_id，chunk 将不携带 message_id")

        stream_start_time = time.time()
        base_time = http_request_start_time if http_request_start_time else stream_start_time
        last_chunk_time = stream_start_time

        StreamingLogger.log_stream_start(request_id, correlation_id)

        parent_correlation_id = agent_context.get_thinking_correlation_id() if agent_context else None
        state = StreamingState(parent_correlation_id=parent_correlation_id, last_content_time=time.time())

        # V2 chunk 追踪
        first_id: Optional[str] = None
        first_created: Optional[int] = None
        chunk_push_index: int = 0  # 推送序号（0-based，跳过 usage-only chunk）

        # 流式收集
        collected_chunks: List[ChatCompletionChunk] = []
        finish_reason: Optional[str] = None
        usage: Optional[CompletionUsage] = None

        # 从 agent_context 获取工具标签查询函数（agentlang 层通过接口调用，不直接依赖 app.i18n）
        label_resolver = getattr(agent_context, "get_tool_label", None) if agent_context else None

        first_chunk_timeout = processor_config.stream_first_chunk_timeout_seconds
        first_chunk_deadline = (
            (http_request_start_time or stream_start_time) + first_chunk_timeout
            if first_chunk_timeout else None
        )
        chunk_timeout = processor_config.stream_chunk_timeout_seconds or CHUNK_TIMEOUT
        last_chunk = None

        try:
            async def process_stream():
                nonlocal state, collected_chunks, finish_reason, usage
                nonlocal last_chunk_time, base_time, last_chunk
                nonlocal first_id, first_created, chunk_push_index

                stream_iter = aiter(stream)
                while True:
                    if state.received_chunk_count == 0 and first_chunk_deadline is not None:
                        remaining = max(first_chunk_deadline - time.time(), 0.001)
                        effective_chunk_timeout = remaining
                    else:
                        effective_chunk_timeout = chunk_timeout

                    chunk_task = asyncio.create_task(
                        asyncio.wait_for(anext(stream_iter), timeout=effective_chunk_timeout),
                        name=f"v2_chunk_wait_{state.received_chunk_count}",
                    )

                    interrupt_task = None
                    if agent_context:
                        interrupt_event = agent_context.get_interruption_event()
                        interrupt_task = asyncio.create_task(
                            interrupt_event.wait(),
                            name=f"v2_interrupt_listen_{state.received_chunk_count}",
                        )

                    try:
                        if interrupt_task:
                            done, pending = await asyncio.wait(
                                [chunk_task, interrupt_task],
                                return_when=asyncio.FIRST_COMPLETED,
                            )
                        else:
                            done, pending = {chunk_task}, set()
                            await chunk_task

                        for task in pending:
                            task.cancel()
                            try:
                                await task
                            except asyncio.CancelledError:
                                pass

                        if interrupt_task and interrupt_task in done:
                            StreamingLogger.log_stream_interrupted(request_id, state, correlation_id)
                            state.interrupted_by_signal = True
                            break

                        if chunk_task in done:
                            try:
                                chunk = chunk_task.result()
                                state.increment_chunk_count()

                                chunk_time = time.time()
                                total_latency = chunk_time - base_time
                                interval_time = chunk_time - last_chunk_time

                                state.update_chunk_interval_stats(interval_time, SLOW_CHUNK_THRESHOLD, VERY_SLOW_CHUNK_THRESHOLD)
                                StreamingLogger.log_chunk_received(
                                    request_id, state, interval_time, total_latency, correlation_id, chunk
                                )
                                last_chunk_time = chunk_time

                                if not isinstance(chunk, ChatCompletionChunk):
                                    state.record_invalid_chunk()
                                    StreamingLogger.log_invalid_chunk(request_id, state, type(chunk))
                                    if state.is_max_invalid_chunk_reached():
                                        StreamingLogger.log_invalid_chunk(request_id, state, type(chunk), should_stop=True)
                                        break
                                    continue

                                state.reset_invalid_chunk_count()
                                collected_chunks.append(chunk)
                                last_chunk = chunk

                                # 使用 ChunkProcessor 解析 delta（复用 v1 的 tool_call 累积逻辑）
                                chunk_result = ChunkProcessor.process(chunk, state, finish_reason)
                                has_content = len(chunk_result.text) > 0 and chunk_result.text_type == "content"
                                has_reasoning = len(chunk_result.text) > 0 and chunk_result.text_type == "reasoning"
                                has_tool_call = chunk_result.has_tool_call
                                finish_reason = chunk_result.finish_reason

                                if chunk_result.text_type == "reasoning":
                                    state.reasoning_text += chunk_result.text
                                elif chunk_result.text_type == "content":
                                    state.content_text += chunk_result.text

                                has_new_content = has_content or has_reasoning or has_tool_call or finish_reason is not None
                                if has_new_content:
                                    state.record_valid_content(time.time())
                                else:
                                    state.record_empty_chunk()

                                if state.is_max_empty_chunk_reached():
                                    StreamingLogger.log_empty_chunks_stop(request_id, state, time.time() - state.last_content_time)
                                    break

                                if chunk.usage:
                                    usage = chunk.usage

                                # 推送 raw chunk，跳过纯 usage chunk（choices 为空）
                                has_meaningful_content = bool(chunk.choices)
                                if has_meaningful_content:
                                    # 记录首个有效 chunk 的 id / created 用于复用
                                    if first_id is None and chunk.id:
                                        first_id = chunk.id
                                        first_created = chunk.created

                                    effective_first_id = first_id or chunk.id or ""
                                    effective_first_created = first_created if first_created is not None else chunk.created

                                    super_magic_chunk = _build_super_magic_chunk(
                                        chunk=chunk,
                                        first_id=effective_first_id,
                                        first_created=effective_first_created,
                                        correlation_id=correlation_id,
                                        chunk_index=chunk_push_index,
                                        label_resolver=label_resolver,
                                    )
                                    await _push_raw_chunk(
                                        streaming_driver=streaming_driver,
                                        super_magic_chunk=super_magic_chunk,
                                        request_id=request_id,
                                        correlation_id=correlation_id,
                                        message_id=reply_message_id,
                                        chunk_index=chunk_push_index,
                                    )
                                    chunk_push_index += 1

                                # 检查完成状态
                                if finish_reason is not None and not state.finish_reason_received:
                                    state.finish_reason_received = True
                                    StreamingLogger.log_finish_reason_received(request_id, state, finish_reason, correlation_id)
                                elif state.finish_reason_received:
                                    if chunk.usage or (hasattr(chunk, "choices") and len(chunk.choices) == 0):
                                        StreamingLogger.log_usage_received_stop(request_id, state, correlation_id, chunk)
                                        break

                            except StopAsyncIteration as e:
                                root_cause = e.__cause__ or e.__context__
                                root_cause_info = (
                                    f"底层原因: {type(root_cause).__name__} - {root_cause}"
                                    if root_cause else "底层原因: 未知"
                                )

                                if finish_reason is None:
                                    StreamingLogger.log_stream_abnormal_end(
                                        request_id, state, correlation_id, usage is not None, root_cause_info, last_chunk
                                    )
                                    total_elapsed = time.time() - base_time
                                    raise StreamInterruptedError(
                                        chunk_count=state.received_chunk_count,
                                        total_elapsed_seconds=total_elapsed,
                                    ) from e
                                else:
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
                            except STREAMING_PASSTHROUGH_EXCEPTIONS:
                                raise
                            except Exception as e:
                                StreamingLogger.log_chunk_exception(request_id, state, e)
                                raise RuntimeError(f"Error processing chunk {state.received_chunk_count}: {e}") from e

                    except Exception as e:
                        StreamingLogger.log_parallel_task_exception(request_id, e)
                        raise

            await process_stream()

        except STREAMING_PASSTHROUGH_EXCEPTIONS:
            raise
        except Exception as stream_error:
            StreamingLogger.log_stream_error(request_id, state, stream_error, correlation_id)
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

        # 基础校验
        if not state.has_received_chunks():
            if state.interrupted_by_signal:
                raise asyncio.CancelledError("LLM streaming stopped by interruption signal")
            StreamingLogger.log_no_data_received(request_id, correlation_id)
            raise RuntimeError(f"No stream data received from server. This may indicate a server-side error or timeout.")

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

        stream_end_time = time.time()
        total_stream_time = stream_end_time - stream_start_time
        StreamingLogger.log_stream_stats(request_id, state, correlation_id, total_stream_time, finish_reason)

        # ===== 流结束：统一触发一次 after_agent_reply =====
        # 中断时若已收到文本内容，也需触发以确保落库（对齐 V1 行为）。
        # 注意：中断时 tool_calls 可能不完整，_trigger_after_agent_reply 内部会忽略它们。
        has_partial_content = bool(state.content_text or state.reasoning_text)
        if agent_context and should_trigger_events and (not state.interrupted_by_signal or has_partial_content):
            await StreamResponseHandlerV2._trigger_after_agent_reply(
                agent_context=agent_context,
                model_id=model_id,
                processor_config=processor_config,
                request_id=request_id,
                state=state,
                usage=usage,
                collected_chunks=collected_chunks,
                interrupted=state.interrupted_by_signal,
            )

        return StreamProcessResult(
            collected_chunks=collected_chunks,
            completion_text=state.content_text,
            reasoning_content=state.reasoning_text,
            tool_calls=state.tool_calls,
            finish_reason=finish_reason,
            usage=usage,
        )

    @staticmethod
    async def _trigger_after_agent_reply(
        agent_context: AgentContextInterface,
        model_id: str,
        processor_config: ProcessorConfig,
        request_id: str,
        state: StreamingState,
        usage: Optional[CompletionUsage],
        collected_chunks: List[ChatCompletionChunk],
        interrupted: bool = False,
    ) -> None:
        """流结束后统一触发一次 AFTER_AGENT_REPLY 事件，携带完整 content + reasoning + tool_calls。

        Args:
            interrupted: 是否因用户中断而触发。中断时工具调用可能不完整，不纳入消息。
        """
        from agentlang.context.tool_context import ToolContext
        from agentlang.event.data import AfterAgentReplyEventData
        from agentlang.event.event import Event, EventType
        from agentlang.llms.token_usage.models import TokenUsage

        try:
            # 中断时 tool_calls 可能是部分流式数据，参数尚未完整；
            # 带入会导致工厂走 pending 路径而丢失已有文本，因此忽略。
            effective_tool_calls = {} if interrupted else state.tool_calls
            tool_call_objects = _build_tool_call_objects(effective_tool_calls)

            # 构建完整的 ChatCompletionMessage（含 tool_calls 和 reasoning_content）
            llm_msg = ChatCompletionMessage(
                role="assistant",
                content=state.content_text if state.content_text else None,
                tool_calls=tool_call_objects,
            )
            if state.reasoning_text:
                setattr(llm_msg, "reasoning_content", state.reasoning_text)

            # token usage
            token_usage: Optional[TokenUsage] = None
            if usage:
                try:
                    token_usage = TokenUsage.from_response(usage)
                except Exception:
                    pass

            tool_context = ToolContext(metadata=agent_context.get_metadata())
            tool_context.register_extension("agent_context", agent_context)

            model_name = processor_config.model_name or model_id
            now_iso = datetime.now().isoformat()

            event_data = AfterAgentReplyEventData(
                agent_context=agent_context,
                model_id=model_id,
                model_name=model_name,
                request_id=request_id,
                request_timestamp=now_iso,
                response_timestamp=now_iso,
                tool_context=tool_context,
                llm_response_message=llm_msg,
                response=None,
                token_usage=token_usage,
                execution_time=0.0,
                use_stream_mode=True,
                success=not interrupted,
                content_type="content",
                # V2 不触发 BEFORE_AGENT_REPLY，手动设置 correlation_id 以跳过
                correlation_id=request_id,
            )

            event = Event(EventType.AFTER_AGENT_REPLY, event_data)
            await agent_context.dispatch_event(event.event_type, event_data)

            logger.debug(
                f"[{request_id}] after_agent_reply 已触发 (interrupted={interrupted}), "
                f"content_len={len(state.content_text)}, "
                f"reasoning_len={len(state.reasoning_text)}, "
                f"tool_calls={len(effective_tool_calls)}"
            )

        except Exception as e:
            logger.error(f"[{request_id}] 触发 after_agent_reply 失败: {e}", exc_info=True)
