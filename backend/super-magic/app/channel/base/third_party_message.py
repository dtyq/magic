"""第三方 IM 入站统一构建与分发。"""
from __future__ import annotations

import json
from typing import Any, Optional

from agentlang.event.event import EventType
from agentlang.logger import get_logger

from app.core.entity.event.third_party_message_event import ThirdPartyMessageReceivedEventData
from app.core.entity.message.client_message import ChatClientMessage
from app.path_manager import PathManager
from app.utils.async_file_utils import async_read_json

logger = get_logger(__name__)


def _normalize_text(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_bool(value: Any) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    return None


async def _load_last_chat_message() -> ChatClientMessage | None:
    try:
        message_dict = await async_read_json(PathManager.get_chat_client_message_file())
        return ChatClientMessage(**message_dict)
    except Exception as e:
        logger.debug(f"[ThirdPartyMessage] 读取上一条 chat_client_message 失败: {e}")
        return None


def _build_rich_text_document(text: str) -> str:
    paragraphs: list[dict[str, Any]] = []
    for line in text.splitlines():
        if not line.strip():
            continue
        paragraphs.append(
            {
                "type": "paragraph",
                "attrs": {"suggestion": ""},
                "content": [{"type": "text", "text": line}],
            }
        )

    if not paragraphs:
        paragraphs.append(
            {
                "type": "paragraph",
                "attrs": {"suggestion": ""},
                "content": [{"type": "text", "text": text}],
            }
        )

    return json.dumps({"type": "doc", "content": paragraphs}, ensure_ascii=False)


def _get_last_chat_runtime_config(last_chat_message: ChatClientMessage | None) -> tuple[str | None, bool, str | None]:
    if last_chat_message is None:
        return None, True, None

    dynamic_config = last_chat_message.dynamic_config if isinstance(last_chat_message.dynamic_config, dict) else {}
    image_model_config = dynamic_config.get("image_model") if isinstance(dynamic_config.get("image_model"), dict) else {}

    model_id = _normalize_text(last_chat_message.model_id) or _normalize_text(dynamic_config.get("model_id"))
    enable_web_search = _normalize_bool(dynamic_config.get("enable_web_search"))
    image_model_id = _normalize_text(image_model_config.get("model_id"))

    return model_id, True if enable_web_search is None else enable_web_search, image_model_id


class ThirdPartyMessagePayloadBuilder:
    """构建第三方 IM 入站事件与持久化所需负载。"""

    @classmethod
    async def build_event_data(
        cls,
        *,
        agent_context: Any,
        channel: str,
        source_message_id: str,
        source_conversation_id: str | None,
        source_sender_id: str | None,
        chat_message: ChatClientMessage,
    ) -> ThirdPartyMessageReceivedEventData | None:
        source_message_id = _normalize_text(source_message_id)
        if not source_message_id:
            logger.warning(f"[ThirdPartyMessage] {channel} 缺少稳定 source_message_id，跳过持久化事件")
            return None

        try:
            init_client_message = agent_context.get_init_client_message() if agent_context else None
            init_metadata = agent_context.get_init_client_message_metadata() if agent_context else None
        except Exception as e:
            logger.warning(f"[ThirdPartyMessage] {channel} 读取 init_client_message 失败，跳过持久化事件: {e}")
            return None

        authorization = _normalize_text(getattr(init_metadata, "authorization", None))
        project_id = _normalize_text(getattr(init_metadata, "project_id", None))
        topic_id = (
            _normalize_text(getattr(init_metadata, "chat_topic_id", None))
            or _normalize_text(getattr(init_metadata, "topic_id", None))
        )
        if not authorization or not project_id or not topic_id:
            logger.warning(
                f"[ThirdPartyMessage] {channel} 缺少持久化所需 metadata "
                f"(authorization={bool(authorization)}, project_id={bool(project_id)}, topic_id={bool(topic_id)})"
            )
            return None

        plain_text = (chat_message.prompt or "").strip()
        if not plain_text:
            logger.warning(f"[ThirdPartyMessage] {channel} 空消息跳过持久化事件")
            return None

        topic_pattern = _normalize_text(getattr(getattr(init_client_message, "agent", None), "type", None))
        last_chat_message = await _load_last_chat_message()
        model_id, enable_web_search, image_model_id = _get_last_chat_runtime_config(last_chat_message)

        missing_fields = [
            field_name
            for field_name, value in (
                ("topic_pattern", topic_pattern),
                ("model_id", model_id),
                ("image_model_id", image_model_id),
            )
            if not value
        ]
        if missing_fields:
            logger.warning(
                f"[ThirdPartyMessage] {channel} 缺少上一条消息配置 {', '.join(missing_fields)}，跳过持久化事件"
            )
            return None

        return ThirdPartyMessageReceivedEventData(
            agent_context=agent_context,
            channel=channel,
            source_message_id=source_message_id,
            source_conversation_id=_normalize_text(source_conversation_id),
            source_sender_id=_normalize_text(source_sender_id),
            local_message_id=chat_message.message_id,
            plain_text=plain_text,
            rich_text_content=_build_rich_text_document(plain_text),
            project_id=project_id,
            topic_id=topic_id,
            topic_pattern=topic_pattern,
            model_id=model_id,
            enable_web_search=enable_web_search,
            image_model_id=image_model_id,
            authorization=authorization,
        )


async def dispatch_third_party_message(
    *,
    dispatcher: Any,
    channel: str,
    source_message_id: str | None,
    source_conversation_id: str | None,
    source_sender_id: str | None,
    chat_message: ChatClientMessage,
) -> None:
    """统一触发第三方入站事件，并继续派发消息给 agent。"""
    agent_context = getattr(dispatcher, "agent_context", None)
    if agent_context is None:
        logger.error(f"[ThirdPartyMessage] {channel} agent_context 未初始化，忽略消息")
        return

    event_data = await ThirdPartyMessagePayloadBuilder.build_event_data(
        agent_context=agent_context,
        channel=channel,
        source_message_id=source_message_id or "",
        source_conversation_id=source_conversation_id,
        source_sender_id=source_sender_id,
        chat_message=chat_message,
    )
    if event_data is not None:
        try:
            await agent_context.dispatch_event(EventType.THIRD_PARTY_MESSAGE_RECEIVED, event_data)
        except Exception as e:
            logger.warning(f"[ThirdPartyMessage] {channel} 触发入站事件失败，继续派发 agent: {e}")

    await dispatcher.submit_message(chat_message)
