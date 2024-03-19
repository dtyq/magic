"""
Processor Manager

统一管理流式和非流式 LLM 调用，包括自动降级重试逻辑
"""

import time
from typing import Any, Dict, Optional

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletion

from agentlang.interface.context import AgentContextInterface
from agentlang.logger import get_logger
from .streaming_call_processor import StreamingCallProcessor
from .processor_config import ProcessorConfig
from .regular_call_processor import RegularCallProcessor

logger = get_logger(__name__)


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
                # 流式调用失败，自动降级为非流式调用重试
                logger.warning(f"[{request_id}] 流式调用失败: {str(stream_error)}，自动降级为非流式模式重试")

                # 重置流式阶段标记，因为已经降级为非流式
                # StreamCancelBlockerContext 已经在其 __aexit__ 中减少了 blocker 计数
                if agent_context:
                    agent_context.set_metadata("_llm_call_entered_stream_phase", False)

                # 重置开始时间以准确记录重试耗时
                retry_start_time = time.time()

                # 直接调用非流式处理器
                logger.info(f"[{request_id}] 开始非流式降级重试")
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

                # 记录降级重试成功
                retry_elapsed_time = (time.time() - retry_start_time) * 1000
                logger.info(f"[{request_id}] 非流式降级重试成功，耗时: {retry_elapsed_time:.2f}ms")

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
