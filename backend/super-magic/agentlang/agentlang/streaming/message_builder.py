# agentlang/agentlang/streaming/message_builder.py
from abc import ABC, abstractmethod
from typing import Any, Dict
from .models import ChunkData
from agentlang.interface.context import AgentContextInterface


class MessageBuilderInterface(ABC):
    """消息构建器抽象接口"""

    def get_version(self) -> str:
        """返回该构建器对应的消息协议版本号，默认 'v1'"""
        return "v1"

    async def prepare_for_streaming(self, agent_context: AgentContextInterface) -> None:
        """流式推送开始前的准备工作，默认为空实现。

        各版本 builder 可 override 此方法完成流式前置逻辑，例如：
        - v2：预生成 reply_message_id 并写入 agent_context
        - v1：无需处理，保持空实现即可

        Args:
            agent_context: Agent 上下文，类型为 AgentContextInterface 的实现
        """

    @abstractmethod
    async def build_message(self, chunk_data: ChunkData) -> Dict[str, Any]:
        """构建推送消息

        Args:
            chunk_data: 数据块

        Returns:
            Dict[str, Any]: 构建的消息字典
        """
        pass
