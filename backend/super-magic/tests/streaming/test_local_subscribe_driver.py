import json
from datetime import datetime
from typing import List, Optional

import pytest

from agentlang.llms.processors.processor_config import ProcessorConfig
from agentlang.llms.processors.streaming_call_processor import StreamingCallProcessor
from agentlang.streaming.driver_types import DriverType
from agentlang.streaming.models import ChunkData, ChunkDelta, ChunkMetadata, StreamingResult
from app.streaming.local_subscribe_driver import (
    LocalSubscribeStreamingDriver,
    get_local_subscribe_driver,
    register_local_subscribe_stream,
    reset_local_subscribe_driver,
    unregister_local_subscribe_stream,
)


class _FakeStream:
    def __init__(self) -> None:
        self.writes: List[str] = []

    async def write(self, data: str, data_type: str = "json") -> int:
        self.writes.append(data)
        return len(data)


class _FakeContext:
    def __init__(self, sinks: Optional[list] = None) -> None:
        self._sinks = sinks or []

    def get_streaming_sinks(self) -> list:
        return list(self._sinks)


class _FailingPrimary:
    async def initialize(self) -> StreamingResult:
        return StreamingResult(success=False, message="socketio down")


class _OkPrimary:
    def __init__(self) -> None:
        self.initialized = False

    async def initialize(self) -> StreamingResult:
        self.initialized = True
        return StreamingResult(success=True)

    def get_driver_name(self) -> str:
        return "socketio"


@pytest.fixture(autouse=True)
def _clean_local_driver():
    reset_local_subscribe_driver()
    yield
    reset_local_subscribe_driver()


def _chunk_data(content: str = "你好", message_id: str = "msg-1") -> ChunkData:
    return ChunkData(
        request_id="req-1",
        chunk_id=0,
        content=None,
        delta=ChunkDelta(
            extra_fields={
                "super_magic_chunk": {
                    "choices": [{"delta": {"content": content}, "index": 0}],
                    "i": 0,
                }
            }
        ),
        timestamp=datetime.now(),
        metadata=ChunkMetadata(content_type="raw_chunk", message_id=message_id),
    )


@pytest.mark.asyncio
async def test_push_writes_plaintext_chunk_with_super_message_id():
    stream = _FakeStream()
    driver = LocalSubscribeStreamingDriver()
    driver.register_stream(stream)

    result = await driver.push(_chunk_data())

    assert result.success is True
    assert len(stream.writes) == 1
    payload = json.loads(stream.writes[0])
    assert payload["type"] == "super_magic_chunk"
    assert payload["app_message_id"] == "msg-1"
    assert payload["super_magic_chunk"]["super_message_id"] == "msg-1"
    assert payload["super_magic_chunk"]["choices"][0]["delta"]["content"] == "你好"


@pytest.mark.asyncio
async def test_push_without_subscribers_is_noop():
    driver = LocalSubscribeStreamingDriver()
    result = await driver.push(_chunk_data())
    assert result.success is True


@pytest.mark.asyncio
async def test_finalize_keeps_subscribe_connection():
    stream = _FakeStream()
    driver = LocalSubscribeStreamingDriver()
    driver.register_stream(stream)

    await driver.finalize()
    await driver.push(_chunk_data("还在"))

    assert len(stream.writes) == 1


@pytest.mark.asyncio
async def test_register_and_unregister_process_level_streams():
    stream = _FakeStream()
    register_local_subscribe_stream(stream)
    assert get_local_subscribe_driver().has_subscribers() is True

    await get_local_subscribe_driver().push(_chunk_data())
    assert len(stream.writes) == 1

    unregister_local_subscribe_stream(stream)
    assert get_local_subscribe_driver().has_subscribers() is False


@pytest.mark.asyncio
async def test_initialize_streaming_driver_uses_sink_when_primary_fails(monkeypatch):
    sink = LocalSubscribeStreamingDriver()
    stream = _FakeStream()
    sink.register_stream(stream)

    monkeypatch.setattr(
        "agentlang.llms.processors.streaming_call_processor.StreamingCallProcessor._create_primary_driver",
        lambda mode, config: _FailingPrimary(),
    )

    driver = await StreamingCallProcessor.initialize_streaming_driver(
        ProcessorConfig(use_stream_mode=True, streaming_push_mode=DriverType.SOCKETIO),
        _FakeContext([sink]),
        "req-local",
    )

    assert driver is sink
    await driver.push(_chunk_data("本地"))
    assert json.loads(stream.writes[0])["super_magic_chunk"]["choices"][0]["delta"]["content"] == "本地"


@pytest.mark.asyncio
async def test_initialize_streaming_driver_broadcasts_primary_and_sink(monkeypatch):
    primary = _OkPrimary()
    sink = LocalSubscribeStreamingDriver()
    monkeypatch.setattr(
        "agentlang.llms.processors.streaming_call_processor.StreamingCallProcessor._create_primary_driver",
        lambda mode, config: primary,
    )

    driver = await StreamingCallProcessor.initialize_streaming_driver(
        ProcessorConfig(use_stream_mode=True, streaming_push_mode=DriverType.SOCKETIO),
        _FakeContext([sink]),
        "req-both",
    )

    assert driver.get_driver_name() == "socketio+local_subscribe"
    assert primary.initialized is True


def test_agent_context_includes_local_sink_for_subagent():
    from app.core.context.agent_context import AgentContext

    stream = _FakeStream()
    register_local_subscribe_stream(stream)
    child = AgentContext(isolated=True)
    sinks = child.get_streaming_sinks()

    assert get_local_subscribe_driver() in sinks
    unregister_local_subscribe_stream(stream)
    assert get_local_subscribe_driver() not in child.get_streaming_sinks()
