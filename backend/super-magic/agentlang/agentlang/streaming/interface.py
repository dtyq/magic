# agentlang/agentlang/streaming/interface.py
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from .models import ChunkData, StreamingResult


class StreamingInterface(ABC):
    """流式推送抽象接口"""

    @abstractmethod
    async def initialize(self) -> StreamingResult:
        """初始化推送连接"""
        pass

    @abstractmethod
    async def push(self, chunk_data: ChunkData) -> StreamingResult:
        """推送数据块"""
        pass

    @abstractmethod
    async def finalize(self) -> StreamingResult:
        """断开连接，清理资源"""
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        """检查推送服务是否可用"""
        pass

    @abstractmethod
    def get_driver_name(self) -> str:
        """获取驱动名称"""
        pass
