"""
Processor Manager

统一管理流式和非流式 LLM 调用。
传输层职责：执行网络请求，发生错误时正确包装异常并抛出。
不做任何重试决策或 fallback 决策，这些由业务层（agent.py）负责。
"""

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
    ) -> ChatCompletion:
        """执行 LLM 调用，根据配置选择流式或非流式

        Args:
            client: OpenAI客户端
            llm_config: LLM配置
            request_params: 请求参数
            model_id: 模型ID
            processor_config: 处理器配置（包含流式模式等配置）
            agent_context: Agent上下文
            request_id: 请求ID
            enable_llm_response_events: 是否启用LLM响应事件

        Returns:
            ChatCompletion响应
        """
        if processor_config is None:
            processor_config = ProcessorConfig.create_default()

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
            # 标记本次调用进入流式阶段（用于 cancel blocker 管理）
            if agent_context:
                agent_context.set_metadata("_llm_call_entered_stream_phase", True)
            # 保存流式 request_id 到 CorrelationIdManager，供降级非流式时恢复 correlation_id 一致性：
            # V2 流式 chunk 以 request_id 作为 correlation_id 推送给前端，
            # 若流式中断降级非流式，非流式的最终消息也应携带相同的 correlation_id
            correlation_manager.set_stream_fallback_cid(request_id)

            # 流式调用，异常直接抛出，不做任何重试/fallback 决策
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
            )
            # 流式成功，清除 fallback 标记，避免影响后续独立的非流式调用
            correlation_manager.set_stream_fallback_cid(None)
            return response
        else:
            # 非流式调用
            if agent_context:
                agent_context.set_metadata("_llm_call_entered_stream_phase", False)

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
            return response
