"""第三方 IM 入站统一构建与分发。"""
from __future__ import annotations

import asyncio
import hashlib
import json
from pathlib import Path
from typing import Any, Optional

from agentlang.event.event import EventType
from agentlang.logger import get_logger
from app.core.entity.event.third_party_message_event import ThirdPartyMessageReceivedEventData
from app.core.entity.message.client_message import ChatClientMessage
from app.path_manager import PathManager
from app.utils.async_file_utils import async_read_json, get_file_id_from_xattr, get_s3_key_from_xattr

logger = get_logger(__name__)

# Server stores message_id as "tp:{channel}:{source_message_id}".
# The longest channel prefix is "tp:dingtalk:" (12 chars).
# To stay within VARCHAR(64): 64 - 12 = 52, use 50 as safe threshold.
_SOURCE_ID_MAX_LEN = 50


def _safe_source_id(raw: str) -> str:
    """Shorten source_message_id to fit the server-side DB column.

    The server stores the idempotency key as "tp:{channel}:{source_message_id}".
    When the raw ID exceeds _SOURCE_ID_MAX_LEN, replace it with a deterministic
    32-char SHA-256 hex digest so idempotency is preserved without truncation loss.
    """
    if len(raw) <= _SOURCE_ID_MAX_LEN:
        return raw
    digest = hashlib.sha256(raw.encode()).hexdigest()[:32]
    logger.debug(f"[ThirdPartyMessage] source_message_id too long ({len(raw)} chars), hashed to {digest}")
    return digest


def _normalize_text(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _resolve_topic_id(init_metadata: Any) -> Optional[str]:
    """优先使用 SuperMagic topic 主键，兼容旧 metadata 的 chat_topic_id。"""
    return (
        _normalize_text(getattr(init_metadata, "topic_id", None))
        or _normalize_text(getattr(init_metadata, "chat_topic_id", None))
    )

async def _resolve_agent_name(agent_context: Any) -> str:
    """获取真实 agent name。

    agent 尚未创建时 agent_context.agent_name 为默认值 "magic"，
    此时从 last_dispatch_message.json 的 dynamic_config.agent_code 补全。
    """
    agent_name = getattr(agent_context, "agent_name", "magic")
    if agent_name != "magic":
        return agent_name
    try:
        last_dispatch_file = PathManager.get_chat_history_dir() / "last_dispatch_message.json"
        last = await async_read_json(last_dispatch_file)
        agent_code = (last.get("dynamic_config") or {}).get("agent_code") if isinstance(last, dict) else None
        if agent_code and isinstance(agent_code, str) and agent_code.strip():
            return agent_code.strip()
    except Exception:
        pass
    return agent_name


async def _load_runtime_config_from_session(agent_context: Any) -> dict[str, Any]:
    """从持久化 session.json 读取上次会话的运行配置。

    session.json 保存在本地 .chat_history/ 目录下，项目重启时由启动恢复流程准备。
    优先使用 current 块，null 字段回落到 last 块。
    """
    try:
        agent_name = await _resolve_agent_name(agent_context)
        agent_id = agent_context.get_agent_id() if hasattr(agent_context, "get_agent_id") else None
        session_file = PathManager.get_chat_session_file(agent_name, agent_id or "main")
        doc = await async_read_json(session_file)
        if not isinstance(doc, dict):
            return {}
        current: dict[str, Any] = doc.get("current") or {}
        last: dict[str, Any] = doc.get("last") or {}
        # current 中 null 的字段回落到 last
        merged = {**last, **{k: v for k, v in current.items() if v is not None}}
        return merged
    except Exception as e:
        logger.debug(f"[ThirdPartyMessage] 读取 session.json 失败: {e}")
        return {}


def _build_project_file_mention(attachment: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "mention",
        "attrs": {
            "id": None,
            "label": None,
            "mentionSuggestionChar": "@",
            "type": "project_file",
            "data": {
                "file_id": attachment.get("file_id"),
                "file_key": attachment.get("file_key"),
                "file_path": attachment.get("file_path"),
                "relative_file_path": attachment.get("relative_file_path"),
                "file_name": attachment.get("file_name") or attachment.get("filename"),
                "file_extension": attachment.get("file_extension", ""),
                "file_size": attachment.get("file_size", 0),
                "is_hidden": False,
                "project_id": attachment.get("project_id"),
            },
            "pending": False,
            "pendingId": None,
        },
    }


def _build_rich_text_document(text: str, attachments: list[dict[str, Any]] | None = None) -> str:
    mention_nodes = [_build_project_file_mention(attachment) for attachment in attachments or []]
    paragraphs: list[dict[str, Any]] = []
    lines = [line for line in text.splitlines() if line.strip()]
    for index, line in enumerate(lines):
        if not line.strip():
            continue
        content = ([*mention_nodes] if index == 0 else []) + [{"type": "text", "text": line}]
        paragraphs.append(
            {
                "type": "paragraph",
                "attrs": {"suggestion": ""},
                "content": content,
            }
        )

    if not paragraphs:
        paragraphs.append(
            {
                "type": "paragraph",
                "attrs": {"suggestion": ""},
                "content": [*mention_nodes, {"type": "text", "text": text}] if text else mention_nodes,
            }
        )

    return json.dumps({"type": "doc", "content": paragraphs}, ensure_ascii=False)


async def _build_channel_attachments(media: list[dict[str, Any]], project_id: str) -> list[dict[str, Any]]:
    """从已上传到工作区的 IM 媒体读取 MagicFS 元数据，返回消息附件契约。"""
    if not media:
        return []

    attachments: list[dict[str, Any]] = []
    for item in media:
        relative_path = str(item.get("relative_path") or "").strip()
        if not relative_path:
            continue
        try:
            path = PathManager.get_workspace_dir() / relative_path
            file_id, file_key = await asyncio.gather(
                get_file_id_from_xattr(path),
                get_s3_key_from_xattr(path),
            )
            if not file_id or not file_key:
                logger.warning(f"[ThirdPartyMessage] 媒体缺少 MagicFS xattr: {relative_path}")
                continue
            file_name = str(item.get("file_name") or Path(relative_path).name)
            extension = Path(file_name).suffix.lstrip(".")
            attachments.append(
                {
                    "type": "project_file",
                    "file_id": file_id,
                    "file_key": file_key,
                    "file_name": file_name,
                    "file_path": relative_path,
                    "relative_file_path": relative_path,
                    "project_id": project_id,
                    "filename": file_name,
                    "display_filename": file_name,
                    "file_extension": extension,
                    "file_size": int(item.get("size_bytes") or 0),
                    "file_tag": "user_upload",
                    "storage_type": "workspace",
                }
            )
        except Exception as error:
            # xattr 读取失败不能阻断文本消息入库；当前轮 Agent 仍可使用本地 channel_context。
            logger.warning(
                f"[ThirdPartyMessage] 媒体 xattr 读取失败: path={relative_path}, "
                f"error_type={type(error).__name__}"
            )
    return attachments


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
        source_message_id = _safe_source_id(source_message_id)

        try:
            init_client_message = agent_context.get_init_client_message() if agent_context else None
            init_metadata = agent_context.get_init_client_message_metadata() if agent_context else None
        except Exception as e:
            logger.warning(f"[ThirdPartyMessage] {channel} 读取 init_client_message 失败，跳过持久化事件: {e}")
            return None

        authorization = _normalize_text(getattr(init_metadata, "authorization", None))
        project_id = _normalize_text(getattr(init_metadata, "project_id", None))
        topic_id = _resolve_topic_id(init_metadata)
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

        channel_media = (chat_message.channel_context or {}).get("channel_media", [])
        attachments = await _build_channel_attachments(channel_media, project_id)
        mentions = [_build_project_file_mention(attachment) for attachment in attachments]

        session_config = await _load_runtime_config_from_session(agent_context)
        model_id = _normalize_text(session_config.get("model_id"))
        if model_id and not chat_message.model_id:
            chat_message.model_id = model_id
        image_model_id = _normalize_text(session_config.get("image_model_id")) or "doubao-seedream-5.0-lite"
        enable_web_search = True

        topic_pattern = _normalize_text(getattr(getattr(init_client_message, "agent", None), "type", None))
        if not topic_pattern:
            topic_pattern = _normalize_text(session_config.get("agent_mode"))

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
            rich_text_content=_build_rich_text_document(plain_text, attachments),
            attachments=attachments,
            mentions=mentions,
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
