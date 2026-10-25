"""原生视觉禁用监听器。

监听大模型重试前事件：当带原生图片的请求连续返回 HTTP 4xx 并达到阈值时，
在当前沙箱关闭该模型的原生视觉能力，把历史中的原生视觉 user 消息全部关掉，
并要求重试循环立刻再试一次。

成功清零走独立的请求成功事件，不和重试事件混在一起。
"""

from agentlang.config.config import config
from agentlang.event.data import AfterLlmRequestSucceededEventData, BeforeLlmRetryEventData
from agentlang.event.event import Event, EventType
from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.service.agent_event.base_listener_service import BaseListenerService

logger = get_logger(__name__)


class NativeVisualDisableListenerService:
    """根据 LLM 重试前事件决定是否关闭当前模型的原生视觉。"""

    _DEFAULT_NATIVE_VISUAL_400_FAILURE_THRESHOLD = 2

    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        """为代理上下文注册原生视觉禁用与成功清零监听器。"""
        BaseListenerService.register_listeners(agent_context, {
            EventType.BEFORE_LLM_RETRY: NativeVisualDisableListenerService._handle_before_llm_retry,
            EventType.AFTER_LLM_REQUEST_SUCCEEDED: NativeVisualDisableListenerService._handle_after_llm_request_succeeded,
        })
        logger.info("已为代理上下文注册原生视觉禁用监听器")

    @staticmethod
    def _is_client_error_status(status_code: int | None) -> bool:
        """4xx 都视为客户端错误，带图请求连续命中后降级为非视觉。"""
        return isinstance(status_code, int) and 400 <= status_code < 500

    @staticmethod
    def _resolve_failure_threshold() -> int:
        """读取连续视觉 4xx 的降级阈值，非法配置回退到默认值。"""
        threshold = config.get(
            "llm.native_visual_400_failure_threshold",
            NativeVisualDisableListenerService._DEFAULT_NATIVE_VISUAL_400_FAILURE_THRESHOLD,
        )
        try:
            return max(1, int(threshold))
        except (TypeError, ValueError):
            return NativeVisualDisableListenerService._DEFAULT_NATIVE_VISUAL_400_FAILURE_THRESHOLD

    @staticmethod
    async def _handle_after_llm_request_succeeded(
        event: Event[AfterLlmRequestSucceededEventData],
    ) -> None:
        """大模型请求成功后清理原生视觉 4xx 计数。"""
        event.data.agent_context.model_context.reset_native_visual_400_state()

    @staticmethod
    async def _handle_before_llm_retry(event: Event[BeforeLlmRetryEventData]) -> None:
        """处理大模型重试前事件，必要时关闭原生视觉并要求立刻重试。"""
        data = event.data
        model_context = data.agent_context.model_context

        if data.is_context_window_exceeded:
            return

        if not data.request_contains_native_images or not NativeVisualDisableListenerService._is_client_error_status(
            data.status_code
        ):
            model_context.reset_native_visual_400_state()
            return

        if model_context.native_visual_fallback_applied:
            return

        failure_count = model_context.record_native_visual_400_failure()
        threshold = NativeVisualDisableListenerService._resolve_failure_threshold()
        data.allow_retry = True
        data.disable_streaming = True
        data.skip_backoff = True

        if failure_count < threshold:
            data.reason = "native_visual_400_retry"
            logger.warning(
                f"原生视觉请求收到 HTTP {data.status_code}，允许重试: "
                f"model={data.model_id}, failure_count={failure_count}, threshold={threshold}"
            )
            return

        model_context.disable_multimodal_for_model(data.model_id)
        model_context.mark_native_visual_fallback_applied()
        data.reason = "native_visual_400_fallback"
        logger.warning(
            f"原生视觉请求连续收到 HTTP 4xx，当前沙箱关闭模型视觉能力并重试: "
            f"model={data.model_id}, status_code={data.status_code}, "
            f"failure_count={failure_count}, threshold={threshold}"
        )
        chat_history = getattr(data.agent_context, "chat_history", None)
        if chat_history is None:
            return
        updated = await chat_history.disable_native_visual_messages()
        logger.warning(
            f"原生视觉降级已关闭历史消息中的原生视觉: "
            f"model={data.model_id}, updated={updated}"
        )
