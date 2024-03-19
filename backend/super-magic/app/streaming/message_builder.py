# app/streaming/message_builder.py
import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Coroutine
from dataclasses import dataclass

from agentlang.streaming.message_builder import MessageBuilderInterface
from agentlang.streaming.models import ChunkData
from agentlang.utils import ShadowCode
from app.utils.init_client_message_util import InitClientMessageUtil, InitializationError

logger = logging.getLogger(__name__)


@dataclass
class AuthInfo:
    """认证信息模型"""
    authorization: str  # 动态认证（来自 metadata.authorization）
    user_authorization: str  # 动态认证（来自 metadata.authorization）
    super_magic_agent_user_id: str
    organization_code: str
    topic_id: str
    conversation_id: str
    language: str = "zh_CN"


class LLMStreamingMessageBuilder(MessageBuilderInterface):
    """大模型流式消息构建器（专门推送给前端，简化认证处理）"""

    def __init__(self):
        self.auth_info: Optional[AuthInfo] = None
        self._auth_loaded = False

    async def build_message(self, chunk_data: ChunkData) -> Dict[str, Any]:
        """构建推送消息

        Args:
            chunk_data: 数据块

        Returns:
            Dict[str, Any]: 构建的消息字典

        Raises:
            ValueError: 如果认证信息不可用
        """
        data = await self.build_intermediate_message(chunk_data)
        json_data = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
        return {
            "obfuscated": True,
            "shadow": ShadowCode.shadow(json_data)
        }

    async def _load_auth_info(self) -> bool:
        """从 init_client_message.json 加载认证信息

        Returns:
            bool: 是否成功加载认证信息
        """
        if self._auth_loaded:
            return self.auth_info is not None

        try:
            metadata = InitClientMessageUtil.get_metadata()
            user_auth = InitClientMessageUtil.get_user_authorization() or ""

            # 提取需要的认证信息
            self.auth_info = AuthInfo(
                # 动态认证（统一从 init_client_message_util 获取）
                authorization=user_auth,
                user_authorization=user_auth,
                super_magic_agent_user_id=metadata.get("agent_user_id", ""),
                organization_code=metadata.get("organization_code", ""),
                topic_id=metadata.get("chat_topic_id", ""),
                conversation_id=metadata.get("chat_conversation_id", ""),
                language=metadata.get("language", "zh_CN")
            )

            self._auth_loaded = True
            logger.info("Authentication info loaded successfully from credentials file")
            return True

        except InitializationError as e:
            logger.info(f"Credentials file not available: {e}, streaming will be disabled")
            self._auth_loaded = True
            return False
        except Exception as e:
            logger.warning(f"Failed to load auth info: {e}")
            self._auth_loaded = True
            return False

    async def _get_auth_info(self) -> Optional[AuthInfo]:
        """获取认证信息

        Returns:
            AuthInfo: 认证信息，如果不可用则返回 None
        """
        if not self._auth_loaded:
            await self._load_auth_info()
        return self.auth_info

    async def build_intermediate_message(self, chunk_data: ChunkData) -> Dict[str, Any]:
        """构建流式推送的临时消息（intermediate 格式）

        Args:
            chunk_data: 数据块

        Returns:
            Dict[str, Any]: 符合前端格式的消息字典

        Raises:
            ValueError: 如果认证信息不可用
        """
        auth_info = await self._get_auth_info()
        if not auth_info:
            raise ValueError("No authentication info available, streaming disabled")

        # 获取状态（直接使用chunk_data中的status，不再进行推断）
        status = chunk_data.delta.status if chunk_data.delta.status is not None else 1  # 默认为进行中

        return {
            "context": {
                "timestamp": int(chunk_data.timestamp.timestamp() * 1000),
                "authorization": auth_info.authorization,
                "user-authorization": auth_info.user_authorization,
                "super_magic_agent_user_id": auth_info.super_magic_agent_user_id,
                "organization_code": auth_info.organization_code,
                "language": auth_info.language,
                "signature": ""
            },
            "data": {
                "message": {
                    "type": "raw",
                    "raw": {
                        "raw_data":{
                            "stream_status": status,  # 0-开始, 1-进行中, 2-完成
                            "content": chunk_data.content or "",
                            "content_type": chunk_data.metadata.content_type or "",
                            "correlation_id": chunk_data.metadata.correlation_id,
                            "parent_correlation_id": chunk_data.metadata.parent_correlation_id,
                            "send_timestamp": int(chunk_data.timestamp.timestamp() * 1000),
                            "chunk_id": chunk_data.chunk_id,
                        }
                    },
                    "app_message_id": chunk_data.metadata.correlation_id,
                    "topic_id": auth_info.topic_id,
                },
                "conversation_id": auth_info.conversation_id,
            }
        }
