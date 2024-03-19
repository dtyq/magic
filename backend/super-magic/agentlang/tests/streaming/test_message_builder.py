# agentlang/tests/streaming/test_message_builder.py
import pytest
from datetime import datetime
from agentlang.streaming.message_builder import MessageBuilderInterface
from agentlang.streaming.models import ChunkData, ChunkDelta, ChunkMetadata, ChunkStatus


class CustomMessageBuilder(MessageBuilderInterface):
    """自定义消息构建器用于测试"""

    async def build_message(self, chunk_data: ChunkData) -> dict:
        return {
            "custom_format": True,
            "req": chunk_data.request_id,
            "id": chunk_data.chunk_id,
            "text": chunk_data.content or "empty"
        }


@pytest.mark.asyncio
async def test_custom_message_builder():
    """测试自定义消息构建器"""
    builder = CustomMessageBuilder()

    chunk_data = ChunkData(
        request_id="custom-req",
        chunk_id=99,
        content="custom content",
        delta=ChunkDelta(),
        timestamp=datetime.now()
    )

    message = await builder.build_message(chunk_data)

    assert message["custom_format"] is True
    assert message["req"] == "custom-req"
    assert message["id"] == 99
    assert message["text"] == "custom content"


@pytest.mark.asyncio
async def test_message_builder_with_empty_content():
    """测试消息构建器处理空内容"""
    builder = CustomMessageBuilder()

    chunk_data = ChunkData(
        request_id="test-req",
        chunk_id=2,
        content=None,  # 空内容
        delta=ChunkDelta(status=ChunkStatus.END, finish_reason="stop"),
        timestamp=datetime.now(),
        is_final=True
    )

    message = await builder.build_message(chunk_data)

    assert message["req"] == "test-req"
    assert message["text"] == "empty"  # None 应该转换为 "empty"
    assert message["id"] == 2


def test_message_builder_interface_is_abstract():
    """测试 MessageBuilderInterface 是抽象的"""
    with pytest.raises(TypeError):
        # 直接实例化抽象类应该抛出异常
        MessageBuilderInterface()
