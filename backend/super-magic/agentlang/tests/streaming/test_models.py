# agentlang/tests/streaming/test_models.py
import pytest
from datetime import datetime
from agentlang.streaming.models import (
    ChunkData, ChunkDelta, ChunkMetadata, ChunkStatus,
    StreamingResult
)


def test_chunk_metadata_creation():
    """测试 ChunkMetadata 数据类创建"""
    metadata = ChunkMetadata(
        correlation_id="test-id",
        model_id="gpt-4",
        extra_data={"key": "value"}
    )

    assert metadata.correlation_id == "test-id"
    assert metadata.model_id == "gpt-4"
    assert metadata.extra_data == {"key": "value"}


def test_chunk_delta_creation():
    """测试 ChunkDelta 数据类创建"""
    delta = ChunkDelta(
        status=ChunkStatus.STREAMING,
        finish_reason=None,
        extra_fields={"test": True}
    )

    assert delta.status == ChunkStatus.STREAMING
    assert delta.finish_reason is None
    assert delta.extra_fields == {"test": True}


def test_chunk_data_creation():
    """测试 ChunkData 数据类创建"""
    delta = ChunkDelta(status=ChunkStatus.STREAMING)
    metadata = ChunkMetadata(correlation_id="test")
    timestamp = datetime.now()

    chunk_data = ChunkData(
        request_id="req-123",
        chunk_id=1,
        content="Hello",
        delta=delta,
        timestamp=timestamp,
        is_final=False,
        metadata=metadata
    )

    assert chunk_data.request_id == "req-123"
    assert chunk_data.chunk_id == 1
    assert chunk_data.content == "Hello"
    assert chunk_data.delta == delta
    assert chunk_data.timestamp == timestamp
    assert chunk_data.is_final is False
    assert chunk_data.metadata == metadata


def test_streaming_result_creation():
    """测试 StreamingResult 数据类创建"""
    result = StreamingResult(
        success=True,
        message="Success",
        error_code=None
    )

    assert result.success is True
    assert result.message == "Success"
    assert result.error_code is None
