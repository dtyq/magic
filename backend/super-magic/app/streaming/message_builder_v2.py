# app/streaming/message_builder_v2.py
import json
import logging
from typing import Any, Dict, Optional

from agentlang.streaming.message_builder import MessageBuilderInterface
from agentlang.streaming.models import ChunkData
from agentlang.utils import ShadowCode
from app.core.context.agent_context import AgentContext
from app.utils.init_client_message_util import InitClientMessageUtil, InitializationError

logger = logging.getLogger(__name__)


class LLMStreamingMessageBuilderV2(MessageBuilderInterface):
    """V2 大模型流式消息构建器。

    当 chunk_data.metadata.content_type == 'raw_chunk' 时，直接提取
    extra_fields['super_magic_chunk'] 作为消息体，推送 super_magic_chunk 格式。

    推送结构与 v1 相同（context + data 包装），但消息类型改为 'super_magic_chunk'，
    app_message_id 取 metadata.message_id（v2 预生成的 Snowflake ID）。
    """

    def __init__(self):
        self._auth_info: Optional[Dict[str, Any]] = None
        self._auth_loaded: bool = False

    def get_version(self) -> str:
        return "v2"

    async def prepare_for_streaming(self, agent_context: AgentContext) -> None:
        """预生成 reply_message_id，确保流式 chunk 与后续非流式消息的 message_id 一致。"""
        agent_context.refresh_streaming_message_id()

    async def build_message(self, chunk_data: ChunkData) -> Dict[str, Any]:
        """构建推送消息并进行 Shadow 编码。

        Args:
            chunk_data: 数据块

        Returns:
            Dict[str, Any]: Shadow 编码后的消息字典
        """
        data = await self._build_intermediate_message(chunk_data)
        json_data = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        return {
            "obfuscated": True,
            "shadow": ShadowCode.shadow(json_data),
        }

    async def _load_auth_info(self) -> bool:
        """从 init_client_message.json 加载认证信息。"""
        if self._auth_loaded:
            return self._auth_info is not None

        try:
            metadata = InitClientMessageUtil.get_metadata()
            user_auth = InitClientMessageUtil.get_user_authorization() or ""

            self._auth_info = {
                "authorization": user_auth,
                "user_authorization": user_auth,
                "super_magic_agent_user_id": metadata.get("agent_user_id", ""),
                "organization_code": metadata.get("organization_code", ""),
                "topic_id": metadata.get("chat_topic_id", ""),
                "conversation_id": metadata.get("chat_conversation_id", ""),
                "language": metadata.get("language", "zh_CN"),
            }
            self._auth_loaded = True
            logger.info("V2 authentication info loaded successfully")
            return True

        except InitializationError as e:
            logger.info(f"V2 credentials file not available: {e}, streaming will be disabled")
            self._auth_loaded = True
            return False
        except Exception as e:
            logger.warning(f"V2 failed to load auth info: {e}")
            self._auth_loaded = True
            return False

    async def _get_auth_info(self) -> Optional[Dict[str, Any]]:
        """获取认证信息，未加载时先加载。"""
        if not self._auth_loaded:
            await self._load_auth_info()
        return self._auth_info

    async def _build_intermediate_message(self, chunk_data: ChunkData) -> Dict[str, Any]:
        """构建 V2 流式推送消息（intermediate 格式，含认证信息）。

        Args:
            chunk_data: 数据块，content_type 应为 'raw_chunk'

        Returns:
            Dict[str, Any]: 符合前端 V2 格式的消息字典

        Raises:
            ValueError: 认证信息不可用时
        """
        auth_info = await self._get_auth_info()
        if not auth_info:
            raise ValueError("V2 No authentication info available, streaming disabled")

        # 提取 super_magic_chunk（由 streaming_handler_v2 预构建）
        super_magic_chunk: Optional[Dict[str, Any]] = None
        if (
            chunk_data.delta
            and chunk_data.delta.extra_fields
            and "super_magic_chunk" in chunk_data.delta.extra_fields
        ):
            super_magic_chunk = chunk_data.delta.extra_fields["super_magic_chunk"]

        if super_magic_chunk is None:
            # 非 raw_chunk 类型（不应出现，保底返回空结构）
            logger.warning(
                f"V2 MessageBuilder: chunk_data 缺少 super_magic_chunk, "
                f"content_type={chunk_data.metadata.content_type if chunk_data.metadata else 'unknown'}"
            )
            super_magic_chunk = {}

        # app_message_id 取预生成的 message_id，保证与后续非流式消息一致
        app_message_id = chunk_data.metadata.message_id if chunk_data.metadata else None

        timestamp_ms = int(chunk_data.timestamp.timestamp() * 1000)

        return {
            "context": {
                "timestamp": timestamp_ms,
                "authorization": auth_info["authorization"],
                "user-authorization": auth_info["user_authorization"],
                "super_magic_agent_user_id": auth_info["super_magic_agent_user_id"],
                "organization_code": auth_info["organization_code"],
                "language": auth_info["language"],
                "signature": "",
            },
            "data": {
                "message": {
                    "type": "super_magic_chunk",
                    "super_magic_chunk": super_magic_chunk,
                    "app_message_id": app_message_id,
                    "topic_id": auth_info["topic_id"],
                },
                "conversation_id": auth_info["conversation_id"],
            },
        }
