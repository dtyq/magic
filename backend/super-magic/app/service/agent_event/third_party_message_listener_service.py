"""第三方 IM 入站消息持久化监听器。"""
from __future__ import annotations

import asyncio

from agentlang.event.event import Event, EventType
from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.core.entity.event.third_party_message_event import ThirdPartyMessageReceivedEventData
from app.infrastructure.sdk.base.exceptions import HttpRequestError
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.kernel.magic_service_exception import MagicServiceApiError
from app.infrastructure.sdk.magic_service.parameter.ingest_third_party_message_parameter import (
    IngestThirdPartyMessageParameter,
)
from app.service.agent_event.base_listener_service import BaseListenerService

logger = get_logger(__name__)


class ThirdPartyMessageListenerService:
    """异步持久化第三方 IM 入站消息。"""

    _background_tasks: set[asyncio.Task] = set()
    _MAX_RETRIES = 2
    _RETRY_DELAY_S = 1.0

    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        event_listeners = {
            EventType.THIRD_PARTY_MESSAGE_RECEIVED: ThirdPartyMessageListenerService._handle_third_party_message,
        }
        BaseListenerService.register_listeners(agent_context, event_listeners)
        logger.info("已为代理上下文注册第三方 IM 入站持久化监听器")

    @staticmethod
    async def _handle_third_party_message(event: Event[ThirdPartyMessageReceivedEventData]) -> None:
        task = asyncio.create_task(
            ThirdPartyMessageListenerService._persist_message(event.data),
            name=f"third-party-message-{event.data.channel}-{event.data.local_message_id}",
        )
        ThirdPartyMessageListenerService._background_tasks.add(task)
        task.add_done_callback(ThirdPartyMessageListenerService._background_tasks.discard)

    @staticmethod
    async def _persist_message(event_data: ThirdPartyMessageReceivedEventData) -> None:
        missing_fields = [
            field_name
            for field_name, value in (
                ("authorization", event_data.authorization),
                ("project_id", event_data.project_id),
                ("topic_id", event_data.topic_id),
                ("source_message_id", event_data.source_message_id),
            )
            if not value
        ]
        if missing_fields:
            logger.warning(
                f"[ThirdPartyMessage] {event_data.channel} 缺少字段 {', '.join(missing_fields)}，跳过持久化"
            )
            return

        parameter = IngestThirdPartyMessageParameter(
            authorization=event_data.authorization,
            project_id=event_data.project_id,
            topic_id=event_data.topic_id,
            rich_text_content=event_data.rich_text_content,
            topic_pattern=event_data.topic_pattern,
            model_id=event_data.model_id,
            enable_web_search=event_data.enable_web_search,
            image_model_id=event_data.image_model_id,
            source_channel=event_data.channel,
            source_message_id=event_data.source_message_id,
            source_conversation_id=event_data.source_conversation_id,
            source_sender_id=event_data.source_sender_id,
        )

        sdk = get_magic_service_sdk()
        for attempt in range(ThirdPartyMessageListenerService._MAX_RETRIES + 1):
            try:
                result = await sdk.agent.ingest_third_party_message_async(parameter)
                logger.info(
                    f"[ThirdPartyMessage] 已持久化 {event_data.channel} 消息: "
                    f"local={event_data.local_message_id}, source={event_data.source_message_id}, "
                    f"deduplicated={result.deduplicated}"
                )
                return
            except (HttpRequestError, MagicServiceApiError) as e:
                if attempt >= ThirdPartyMessageListenerService._MAX_RETRIES:
                    logger.error(
                        f"[ThirdPartyMessage] 持久化失败: channel={event_data.channel}, "
                        f"source={event_data.source_message_id}, error={e}"
                    )
                    return
                await asyncio.sleep(ThirdPartyMessageListenerService._RETRY_DELAY_S)
            except Exception as e:
                logger.error(
                    f"[ThirdPartyMessage] 非预期持久化异常: "
                    f"channel={event_data.channel}, source={event_data.source_message_id}, error={e}"
                )
                return
