"""
Processor Manager

统一管理流式和非流式 LLM 调用。策略：
- 默认只做三次流式尝试，首包窗口由 schedule 决定
- 非流式 fallback 代码路径保留，但默认通过配置显式关闭
- 所有尝试都失败后：抛出 LLMFastRetryExhaustedException，通知上层停止泛化重试
"""

import time
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletion

from agentlang.config.config import config
from agentlang.interface.context import AgentContextInterface
from agentlang.logger import get_logger
from agentlang.llms.error_classifier import LLMErrorClassifier
from agentlang.exceptions import (
    LLMFastRetryExhaustedException,
    StreamChunkTimeoutError,
    StreamInterruptedError,
    find_in_exception_chain,
)
from .streaming_call_processor import StreamingCallProcessor
from .processor_config import ProcessorConfig
from .regular_call_processor import RegularCallProcessor

logger = get_logger(__name__)

# 默认快速重试策略常量（可被 config.yaml 覆盖）
_DEFAULT_FIRST_CHUNK_SCHEDULE: List[int] = [90, 120, 150]
_DEFAULT_CHUNK_TIMEOUT: int = 90
_DEFAULT_ENABLE_NON_STREAM_FALLBACK: bool = True
_DEFAULT_NON_STREAM_TIMEOUT: int = 600


def _resolve_retry_policy(llm_call_retry_count: int, processor_config: ProcessorConfig) -> None:
    """根据 llm call 重试次数解析本轮有效超时参数，就地修改 processor_config。"""
    schedule: List[int] = config.get(
        "llm.stream_first_chunk_timeout_schedule_seconds", _DEFAULT_FIRST_CHUNK_SCHEDULE
    )
    chunk_timeout: int = config.get("llm.stream_chunk_timeout_seconds", _DEFAULT_CHUNK_TIMEOUT)
    enable_non_stream_fallback: bool = config.get(
        "llm.enable_non_stream_fallback", _DEFAULT_ENABLE_NON_STREAM_FALLBACK
    )
    non_stream_timeout: int = config.get(
        "llm.non_stream_fallback_timeout_seconds", _DEFAULT_NON_STREAM_TIMEOUT
    )

    idx = min(llm_call_retry_count, len(schedule) - 1)
    is_last_stream_attempt = llm_call_retry_count >= len(schedule) - 1
    processor_config.stream_first_chunk_timeout_seconds = schedule[idx]
    processor_config.stream_chunk_timeout_seconds = chunk_timeout
    processor_config.non_stream_timeout_seconds = non_stream_timeout
    # 即便未来重新打开 fallback，也只允许在流式预算耗尽后的最后一轮触发。
    processor_config.allow_non_stream_fallback = enable_non_stream_fallback and is_last_stream_attempt


class ProcessorManager:
    """统一管理 LLM 处理器的调用"""

    @staticmethod
    async def execute_llm_call(
        client: AsyncOpenAI,
        llm_config,
        request_params: Dict[str, Any],
        model_id: str,
        processor_config: Optional[ProcessorConfig] = None,
        agent_context: Optional[AgentContextInterface] = None,
        request_id: Optional[str] = None,
        enable_llm_response_events: bool = True,
        llm_call_retry_count: int = 0
    ) -> ChatCompletion:
        """执行 LLM 调用，自动处理流式/非流式及降级重试

        Args:
            client: OpenAI客户端
            llm_config: LLM配置
            request_params: 请求参数
            model_id: 模型ID
            processor_config: 处理器配置（包含流式模式等配置）
            agent_context: Agent上下文
            request_id: 请求ID
            enable_llm_response_events: 是否启用LLM响应事件
            llm_call_retry_count: LLM call 重试次数

        Returns:
            ChatCompletion响应
        """
        # 确保 processor_config 不为 None
        if processor_config is None:
            processor_config = ProcessorConfig.create_default()

        # 解析本轮重试策略（填充首包超时、chunk 超时、是否允许非流式 fallback）
        if processor_config.use_stream_mode:
            _resolve_retry_policy(llm_call_retry_count, processor_config)

        # 从 processor_config 中获取流式模式
        use_stream_mode = processor_config.use_stream_mode

        # 获取或生成 correlation_id
        correlation_id = request_id
        from agentlang.event import get_correlation_manager, EventPairType
        correlation_manager = get_correlation_manager()
        active_correlation_id = correlation_manager.get_active_correlation_id(EventPairType.AGENT_REPLY)
        if active_correlation_id:
            correlation_id = active_correlation_id
            logger.info(f"[{request_id}] LLM调用使用 correlation_id={correlation_id}")

        if use_stream_mode:
            # 标记本次调用是否会增加 cancel_blocker_count
            # 只有首次流式调用（非重试）时会增加计数，agent.py 根据此标记决定是否减少计数
            is_retry = llm_call_retry_count > 0
            will_increment_cancel_blocker = not is_retry
            if agent_context:
                agent_context.set_metadata("_llm_call_entered_stream_phase", will_increment_cancel_blocker)

            try:
                # 尝试流式调用
                response = await StreamingCallProcessor.call_with_stream(
                    client=client,
                    llm_config=llm_config,
                    request_params=request_params,
                    model_id=model_id,
                    processor_config=processor_config,
                    agent_context=agent_context,
                    request_id=request_id,
                    correlation_id=correlation_id,
                    enable_llm_response_events=enable_llm_response_events,
                    llm_call_retry_count=llm_call_retry_count
                )
                return response

            # ===== 异常处理分层（Layer 3：决策与降级） =====
            #
            # 本层是异常的"决策"层，职责：
            # 1. 上下文超长 → 直接抛出，不做任何重试
            # 2. 收到过 chunk 后失败 → 直接走非流式 fallback（中途断连，流式重试大概率同样失败）
            # 3. 首包未到就失败 → 按重试策略继续流式重试（可能是临时网络问题）
            # 4. 非流式 fallback 也失败 → 包装为 LLMFastRetryExhaustedException 终止外层重试
            except Exception as stream_error:
                error_snapshot = LLMErrorClassifier.extract_snapshot(stream_error)
                if LLMErrorClassifier.is_context_window_exceeded(error_snapshot):
                    logger.warning(
                        f"[{request_id}] 流式调用命中上下文超长错误，跳过非流式降级重试: {error_snapshot.primary_message}"
                    )
                    raise
                enable_non_stream_fallback: bool = config.get(
                    "llm.enable_non_stream_fallback", _DEFAULT_ENABLE_NON_STREAM_FALLBACK
                )
                # 结构性流中断检测：只要收到过 chunk 就说明连接建立过、中途断了，
                # 流式重试大概率遇到同样问题，直接走非流式 fallback。
                # 首包未到（chunk_count=0）才按原方式流式重试（可能是临时网络问题）。
                received_chunks = 0
                si = find_in_exception_chain(stream_error, StreamInterruptedError)
                sct = find_in_exception_chain(stream_error, StreamChunkTimeoutError)
                if si is not None:
                    received_chunks = si.chunk_count
                elif sct is not None:
                    received_chunks = sct.chunk_count

                if received_chunks > 0:
                    logger.warning(
                        f"[{request_id}] 流式中途失败（已收到 {received_chunks} chunks），"
                        f"跳过流式重试，直接降级非流式"
                    )
                    if enable_non_stream_fallback:
                        processor_config.allow_non_stream_fallback = True
                    else:
                        raise LLMFastRetryExhaustedException(
                            f"Stream failed after receiving {received_chunks} chunks, "
                            f"non-stream fallback disabled",
                            stream_error=stream_error,
                        ) from stream_error

                if not processor_config.allow_non_stream_fallback:
                    # 默认只做流式快重试；只有流式预算耗尽后的最后一轮，且显式开启开关时，
                    # 才允许进入保留的非流式 fallback 路径。
                    logger.warning(
                        f"[{request_id}] 流式调用失败（llm_call_retry_count={llm_call_retry_count}），"
                        f"当前轮次不允许非流式 fallback，直接抛出: {stream_error}"
                    )
                    if llm_call_retry_count >= len(
                        config.get("llm.stream_first_chunk_timeout_schedule_seconds", _DEFAULT_FIRST_CHUNK_SCHEDULE)
                    ) - 1:
                        raise LLMFastRetryExhaustedException(
                            f"LLM call retry exhausted after {llm_call_retry_count + 1} stream attempts",
                            stream_error=stream_error,
                        ) from stream_error
                    raise

                # 允许非流式 fallback（正常最后一轮或结构性中断强制触发）
                logger.warning(
                    f"[{request_id}] 流式调用失败（llm_call_retry_count={llm_call_retry_count}），"
                    f"触发非流式 fallback: {stream_error}"
                )

                # 重置流式阶段标记
                if agent_context:
                    agent_context.set_metadata("_llm_call_entered_stream_phase", False)

                retry_start_time = time.time()
                logger.info(f"[{request_id}] 开始非流式 fallback（超时={processor_config.non_stream_timeout_seconds}s）")

                try:
                    response = await RegularCallProcessor.call_without_stream(
                        client=client,
                        llm_config=llm_config,
                        request_params=request_params,
                        model_id=model_id,
                        agent_context=agent_context,
                        request_id=request_id,
                        enable_llm_response_events=enable_llm_response_events,
                        timeout_seconds=processor_config.non_stream_timeout_seconds,
                    )
                except Exception as fallback_error:
                    # 流式已耗尽 + 非流式也失败：通知 agent.py 直接结束本轮
                    raise LLMFastRetryExhaustedException(
                        f"LLM call retry exhausted after {llm_call_retry_count + 1} stream attempts and one non-stream fallback",
                        stream_error=stream_error,
                        fallback_error=fallback_error,
                    ) from fallback_error

                retry_elapsed_time = (time.time() - retry_start_time) * 1000
                logger.info(f"[{request_id}] 非流式 fallback 成功，耗时: {retry_elapsed_time:.2f}ms")
                return response
        else:
            # 标记为非流式调用
            if agent_context:
                agent_context.set_metadata("_llm_call_entered_stream_phase", False)

            # 直接使用非流式调用
            response = await RegularCallProcessor.call_without_stream(
                client=client,
                llm_config=llm_config,
                request_params=request_params,
                model_id=model_id,
                agent_context=agent_context,
                request_id=request_id,
                enable_llm_response_events=enable_llm_response_events
            )
            return response
