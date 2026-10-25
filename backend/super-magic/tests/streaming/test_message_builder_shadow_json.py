"""验证 V1/V2 构建器交付的真实混淆载荷可无损解码。"""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from agentlang.streaming.models import ChunkData, ChunkDelta, ChunkMetadata, ChunkStatus
from agentlang.utils.shadow_code import ShadowCode

from app.streaming.message_builder import AuthInfo, LLMStreamingMessageBuilder
from app.streaming.message_builder_v2 import LLMStreamingMessageBuilderV2


@pytest.mark.asyncio
@pytest.mark.parametrize("version", ["v1", "v2"])
async def test_message_builder_preserves_unicode_and_chunk_identity(version):
    """认证使用 Mock；消息内容、ID 和状态通过现有接收协议还原。"""
    content = "저는 슈퍼 매직\u1000\u10d0\u1780\U00020000"
    auth = {
        "authorization": "mock-auth",
        "user_authorization": "mock-user-auth",
        "super_magic_agent_user_id": "mock-agent",
        "organization_code": "mock-org",
        "topic_id": "mock-topic",
        "conversation_id": "mock-conversation",
        "language": "ko_KR",
    }
    metadata = ChunkMetadata(
        correlation_id="mock-correlation",
        message_id="mock-message",
        content_type="content" if version == "v1" else "raw_chunk",
    )
    delta = ChunkDelta(
        status=ChunkStatus.END,
        extra_fields={
            "super_magic_chunk": {
                "choices": [{"index": 0, "delta": {"content": content}}],
                "i": 7,
            }
        },
    )
    chunk = ChunkData(
        request_id="mock-request",
        chunk_id=7,
        content=content,
        delta=delta,
        timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
        metadata=metadata,
    )
    if version == "v1":
        builder = LLMStreamingMessageBuilder()
        builder._get_auth_info = AsyncMock(return_value=AuthInfo(**auth))
    else:
        builder = LLMStreamingMessageBuilderV2()
        builder._get_auth_info = AsyncMock(return_value=auth)
        builder._task_id = "mock-task"

    envelope = await builder.build_message(chunk)
    message = json.loads(ShadowCode.unshadow(envelope["shadow"]))["data"]["message"]

    assert envelope["obfuscated"] is True
    assert envelope["shadow"].isascii()
    assert message["topic_id"] == "mock-topic"
    if version == "v1":
        raw = message["raw"]["raw_data"]
        assert raw["content"] == content
        assert raw["chunk_id"] == 7
        assert raw["stream_status"] == ChunkStatus.END
        assert message["app_message_id"] == "mock-correlation"
    else:
        raw = message["super_magic_chunk"]
        assert raw["choices"][0]["delta"]["content"] == content
        assert raw["i"] == 7
        assert raw["task_id"] == "mock-task"
        assert raw["super_message_id"] == "mock-message"
        assert message["app_message_id"] == "mock-message"
