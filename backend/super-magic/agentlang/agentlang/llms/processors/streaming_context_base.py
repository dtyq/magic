"""
流式响应处理器抽象基类。

定义所有版本流式处理器必须实现的公共契约。
使用实例方法 + abstractmethod 组合，子类未实现时 Python 在实例化时抛 TypeError。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, AsyncIterator, Optional

from openai.types.chat import ChatCompletionChunk

from agentlang.streaming.interface import StreamingInterface

if TYPE_CHECKING:
    from agentlang.llms.processors.streaming_context import StreamProcessContext, StreamProcessResult


class StreamResponseHandlerBase(ABC):
    """流式响应处理器抽象基类。

    与 MessageBuilderInterface 保持一致的设计风格：
    实例化即可使用，process_stream_chunks 为强制实现的抽象方法。
    """

    @abstractmethod
    async def process_stream_chunks(
        self,
        stream: AsyncIterator[ChatCompletionChunk],
        streaming_driver: Optional[StreamingInterface],
        context: StreamProcessContext,
    ) -> StreamProcessResult:
        """处理流式响应，收集 chunks 并触发对应事件。

        Args:
            stream: LLM 返回的异步流式响应对象
            streaming_driver: 流式推送驱动实例，无推流时为 None
            context: 流式处理上下文

        Returns:
            StreamProcessResult: 流式处理结果
        """
