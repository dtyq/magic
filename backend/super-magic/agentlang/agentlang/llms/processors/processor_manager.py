"""
Processor Manager

统一管理流式和非流式 LLM 调用。策略：
- 前三次失败（retry_count < 3）：只做流式，失败直接抛出
- 第四次（retry_count >= 3）：流式失败后允许一次非流式 fallback（超时 330s）
- 流式 + 非流式 fallback 均失败：抛出 LLMFastRetryExhaustedException，通知上层停止泛化重试
"""

import time
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletion

from agentlang.config.config import config
from agentlang.interface.context import AgentContextInterface
from agentlang.logger import get_logger
from agentlang.llms.error_classifier import LLMErrorClassifier
from agentlang.exceptions import LLMFastRetryExhaustedException
from .streaming_call_processor import StreamingCallProcessor
from .processor_config import ProcessorConfig
from .regular_call_processor import RegularCallProcessor

logger = get_logger(__name__)

# 默认快速重试策略常量（可被 config.yaml 覆盖）
_DEFAULT_FIRST_CHUNK_SCHEDULE: List[int] = [20, 20, 30, 60]
_DEFAULT_CHUNK_TIMEOUT: int = 10
_DEFAULT_FALLBACK_THRESHOLD: int = 3
_DEFAULT_NON_STREAM_TIMEOUT: int = 330


def _resolve_retry_policy(retry_count: int, processor_config: ProcessorConfig) -> None:
    """根据 retry_count 把 schedule 解析为本轮有效超时参数，就地修改 processor_config。"""
    schedule: List[int] = config.get(
        "llm.stream_first_chunk_timeout_schedule_seconds", _DEFAULT_FIRST_CHUNK_SCHEDULE
    )
    chunk_timeout: int = config.get("llm.stream_chunk_timeout_seconds", _DEFAULT_CHUNK_TIMEOUT)
    fallback_threshold: int = config.get(
        "llm.stream_retry_count_before_non_stream_fallback", _DEFAULT_FALLBACK_THRESHOLD
    )
    non_stream_timeout: int = config.get(
        "llm.non_stream_fallback_timeout_seconds", _DEFAULT_NON_STREAM_TIMEOUT
    )

    idx = min(retry_count, len(schedule) - 1)
    processor_config.stream_first_chunk_timeout_seconds = schedule[idx]
    processor_config.stream_chunk_timeout_seconds = chunk_timeout
    processor_config.non_stream_timeout_seconds = non_stream_timeout
    processor_config.allow_non_stream_fallback = retry_count >= fallback_threshold


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
        retry_count: int = 0
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
            retry_count: 重试次数

        Returns:
            ChatCompletion响应
        """
        # 确保 processor_config 不为 None
        if processor_config is None:
            processor_config = ProcessorConfig.create_default()

        # 解析本轮重试策略（填充首包超时、chunk 超时、是否允许非流式 fallback）
        if processor_config.use_stream_mode:
            _resolve_retry_policy(retry_count, processor_config)

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
            is_retry = retry_count > 0
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
                    retry_count=retry_count
                )
                return response

            except Exception as stream_error:
                error_snapshot = LLMErrorClassifier.extract_snapshot(stream_error)
                if LLMErrorClassifier.is_context_window_exceeded(error_snapshot):
                    logger.warning(
                        f"[{request_id}] 流式调用命中上下文超长错误，跳过非流式降级重试: {error_snapshot.primary_message}"
                    )
                    raise

                if not processor_config.allow_non_stream_fallback:
                    # 前三次只做流式重试，失败直接抛出让外层再次触发下一轮流式
                    logger.warning(
                        f"[{request_id}] 流式调用失败（retry_count={retry_count}），"
                        f"未达到非流式 fallback 阈值，直接抛出: {stream_error}"
                    )
                    raise

                # 第四次及以后：允许一次非流式 fallback
                logger.warning(
                    f"[{request_id}] 流式调用失败（retry_count={retry_count}），"
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
                        retry_count=retry_count,
                        timeout_seconds=processor_config.non_stream_timeout_seconds,
                    )
                except Exception as fallback_error:
                    # 流式已耗尽 + 非流式也失败：通知 agent.py 直接结束本轮
                    raise LLMFastRetryExhaustedException(
                        f"LLM fast retry exhausted after {retry_count + 1} stream attempts and one non-stream fallback",
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
                enable_llm_response_events=enable_llm_response_events,
                retry_count=retry_count
            )
            return response
