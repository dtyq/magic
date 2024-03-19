# agentlang/agentlang/streaming/message_builder.py
from abc import ABC, abstractmethod
from typing import Dict, Any
from .models import ChunkData


class MessageBuilderInterface(ABC):
    """消息构建器抽象接口"""

    @abstractmethod
    async def build_message(self, chunk_data: ChunkData) -> Dict[str, Any]:
        """构建推送消息

        Args:
            chunk_data: 数据块

        Returns:
            Dict[str, Any]: 构建的消息字典
        """
        pass
