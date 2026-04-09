"""
Streaming Call Processor for LLM streaming operations.

流式调用处理器，用于 LLM 流式操作。
该模块处理所有流式相关的 LLM 调用逻辑，包括 chunk 处理、流管理和响应构建。
"""

import asyncio
import time
from typing import Any, Dict, List, Optional

from typing import AsyncIterator

from openai import AsyncOpenAI, APIError, APITimeoutError, APIConnectionError
from openai.types.chat import ChatCompletionChunk, ChatCompletion

from agentlang.exceptions import StreamChunkTimeoutError, StreamInterruptedError
from agentlang.interface.context import AgentContextInterface
from .processor_config import ProcessorConfig
from .streaming_context import StreamProcessContext, StreamResponseHandler
from agentlang.logger import get_logger
from agentlang.streaming.manager import create_driver

logger = get_logger(__name__)

class StreamCancelBlockerContext:
    """流式取消阻止器上下文管理器，确保计数增加和减少严格一一对应"""

    def __init__(self, agent_context: Optional[AgentContextInterface], operation_id: str, retry_count: int = 0):
        self.agent_context = agent_context
        self.operation_id = operation_id
        self.retry_count = retry_count
        self.blocker_active = False

    async def __aenter__(self):
        if self.agent_context:
            # 只有首次调用（非重试）时才增加计数
            if self.retry_count == 0:
                self.agent_context.increment_cancel_blocker()
                self.blocker_active = True
            else:
                self.blocker_active = False
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.blocker_active and self.agent_context:
            status = "异常结束" if exc_type else "正常结束"
            logger.info(f"[{self.operation_id}] 流式阶段{status}，准备减少计数")
            self.agent_context.decrement_cancel_blocker()


class StreamingCallProcessor:
    """Handles streaming LLM calls and response processing."""

    @staticmethod
    def prepare_stream_params(request_params: Dict[str, Any], request_id: Optional[str] = None) -> None:
        """准备流式调用参数"""
        # 添加流式模式参数
        request_params["stream"] = True
        request_params["stream_options"] = {
            "include_usage": True
        }

        # 添加请求ID到请求头
        if request_id:
            extra_headers = request_params.get("extra_headers", {})
            extra_headers["x-request-id"] = request_id
            request_params["extra_headers"] = extra_headers

    @staticmethod
    async def call_with_stream(
        client: AsyncOpenAI,
        llm_config,
        request_params: Dict[str, Any],
        model_id: str,
        processor_config: ProcessorConfig,
        agent_context: Optional[AgentContextInterface] = None,
        request_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        enable_llm_response_events: bool = True,
        llm_call_retry_count: int = 0
    ) -> ChatCompletion:
        """使用流式调用LLM的方法

        Args:
            client: OpenAI客户端
            llm_config: LLM配置
            request_params: 请求参数
            model_id: 模型ID
            processor_config: 处理器配置
            agent_context: Agent上下文
            request_id: 请求ID
            correlation_id: 关联ID
            enable_llm_response_events: 是否启用LLM响应事件
            llm_call_retry_count: LLM call 重试次数

        Returns:
            ChatCompletion响应
        """
        # 如果未提供 correlation_id，使用 request_id 作为默认值
        if correlation_id is None:
            correlation_id = request_id

        # 准备流式调用参数
        StreamingCallProcessor.prepare_stream_params(request_params, request_id)

        streaming_driver = None

        # 使用上下文管理器确保流式模式下计数的严格一一对应
        async with StreamCancelBlockerContext(agent_context, request_id, llm_call_retry_count):
            try:
                # 初始化流式推送驱动
                streaming_driver = await StreamingCallProcessor.initialize_streaming_driver(
                    processor_config, agent_context, request_id
                )

                # 记录HTTP请求发送时间
                http_request_start_time = time.time()
                first_chunk_timeout = processor_config.stream_first_chunk_timeout_seconds
                logger.info(
                    f"[{request_id}] 发送HTTP流式请求... "
                    f"首包窗口={first_chunk_timeout}s (correlation_id={correlation_id})"
                )

                # 首包预算覆盖"请求发出 -> 响应头 -> 首个 chunk"整段总时间
                if first_chunk_timeout:
                    stream: AsyncIterator[ChatCompletionChunk] = await asyncio.wait_for(
                        client.chat.completions.create(**request_params),
                        timeout=first_chunk_timeout,
                    )
                else:
                    stream: AsyncIterator[ChatCompletionChunk] = await client.chat.completions.create(**request_params)

                # HTTP响应头返回时间
                http_response_time = time.time()
                http_latency = http_response_time - http_request_start_time
                logger.info(f"[{request_id}] HTTP响应头已返回，耗时: {http_latency:.3f}秒 (correlation_id={correlation_id})")

                # 构建流式处理上下文
                stream_context = StreamProcessContext(
                    request_id=request_id,
                    model_id=model_id,
                    correlation_id=correlation_id,
                    processor_config=processor_config,
                    agent_context=agent_context,
                    http_request_start_time=http_request_start_time,
                    enable_llm_response_events=enable_llm_response_events,
                    retry_count=llm_call_retry_count
                )

                # 处理流式响应（包含开始消息、流式chunk处理、完成消息推送）
                result = await StreamResponseHandler.process_stream_chunks(
                    stream, streaming_driver, stream_context
                )

                # 构建完整的响应
                response = StreamResponseHandler.build_completion_response(result, llm_config)

                return response

            except (APIError, APITimeoutError, APIConnectionError):
                raise
            except StreamChunkTimeoutError:
                logger.error(f"[{request_id}] 流式 chunk 超时 (correlation_id={correlation_id})")
                raise
            except StreamInterruptedError:
                logger.error(f"[{request_id}] 流式连接被外部中断 (correlation_id={correlation_id})")
                raise
            except asyncio.TimeoutError:
                logger.error(f"[{request_id}] 流式总超时兜底触发 (correlation_id={correlation_id})")
                raise
            except Exception as e:
                logger.error(f"[{request_id}] 流式调用发生意外错误: {e} (correlation_id={correlation_id})")
                raise RuntimeError(f"Unexpected error during stream processing: {e}") from e
            finally:
                logger.info(f"[{request_id}] 流式调用结束 (correlation_id={correlation_id}) 耗时: {time.time() - http_request_start_time:.3f}秒")
                # 确保在任何情况下都清理streaming_driver资源
                if streaming_driver:
                    try:
                        await streaming_driver.finalize()
                        logger.debug(f"[{request_id}] Streaming finalized successfully (correlation_id={correlation_id})")
                    except Exception as finalize_error:
                        # finalize 失败不影响主流程，但记录警告日志
                        logger.warning(f"[{request_id}] Streaming finalize failed: {finalize_error} (correlation_id={correlation_id})")

    @staticmethod
    async def initialize_streaming_driver(
        processor_config: ProcessorConfig,
        agent_context: Optional[AgentContextInterface],
        request_id: str
    ):
        """初始化流式推送驱动"""
        if not processor_config.is_push_enabled() or not agent_context:
            return None

        streaming_push_mode = processor_config.streaming_push_mode

        try:
            # 从 ProcessorConfig 获取流式配置
            driver_config = processor_config.get_effective_streaming_config()

            # 使用模块级别的工厂函数创建driver
            streaming_driver = create_driver(streaming_push_mode, driver_config)
            if not streaming_driver:
                return None

            init_result = await streaming_driver.initialize()
            if not init_result.success:
                logger.warning(f"[{request_id}] Streaming driver {streaming_push_mode} initialization failed: {init_result.message}")
                return None

            logger.debug(f"[{request_id}] Streaming driver {streaming_push_mode} initialized successfully")

            # 若 agent_context 注册了额外推送目标（如企微、飞书等渠道），广播到所有目标
            sinks = agent_context.get_streaming_sinks() if hasattr(agent_context, "get_streaming_sinks") else []
            if sinks:
                for sink in sinks:
                    await sink.initialize()
                from agentlang.streaming.broadcast_driver import BroadcastStreamingDriver
                logger.debug(f"[{request_id}] Broadcasting to {len(sinks)} extra sink(s)")
                return BroadcastStreamingDriver([streaming_driver, *sinks])

            return streaming_driver

        except Exception as e:
            logger.warning(f"[{request_id}] Failed to initialize streaming driver {streaming_push_mode}: {e}")
            return None
