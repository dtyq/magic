import asyncio
from datetime import datetime
from typing import List, Optional

import pytest

from agentlang.llms.processors.processor_config import ProcessorConfig
from agentlang.llms.processors.streaming_call_processor import StreamingCallProcessor
from agentlang.streaming.driver_types import DriverType
from agentlang.streaming.drivers.socketio.config import SocketIODriverConfig
from agentlang.streaming.drivers.socketio.driver import (
    _MESSAGE_QUEUE_MAXSIZE,
    SocketIODriver,
    get_shared_socketio_driver,
    reset_shared_socketio_driver,
    shutdown_shared_socketio_driver,
)
from agentlang.streaming.message_builder import MessageBuilderInterface
from agentlang.streaming.models import ChunkData, ChunkDelta, ChunkMetadata


class _TagBuilder(MessageBuilderInterface):
    def __init__(self, tag: str) -> None:
        self.tag = tag

    async def build_message(self, chunk_data: ChunkData):
        return {"tag": self.tag, "request_id": chunk_data.request_id}


class _FakeSocketIO:
    def __init__(self, *args, **kwargs) -> None:
        self.connected = False
        self.namespaces = set()
        self.emits = []
        self.disconnect_calls = 0
        self._handlers = {}

    def event(self, namespace=None):
        def decorator(fn):
            self._handlers[fn.__name__] = fn
            return fn

        return decorator

    async def connect(self, *args, **kwargs):
        self.connected = True
        namespaces = kwargs.get("namespaces") or ["/im"]
        self.namespaces.add(namespaces[0])
        handler = self._handlers.get("connect")
        if handler:
            await handler()

    async def emit(self, event, message, namespace=None):
        self.emits.append({"event": event, "message": message, "namespace": namespace})

    async def disconnect(self):
        self.disconnect_calls += 1
        self.connected = False


class _FakeContext:
    def get_streaming_sinks(self) -> list:
        return []


def _enabled_config(builder: Optional[MessageBuilderInterface] = None) -> SocketIODriverConfig:
    config = SocketIODriverConfig.create_enabled(base_url="ws://example.test")
    if builder is not None:
        config.message_builder = builder
    return config


def _chunk(request_id: str = "req-1") -> ChunkData:
    return ChunkData(
        request_id=request_id,
        chunk_id=0,
        content=None,
        delta=ChunkDelta(extra_fields={"super_magic_chunk": {"i": 0}}),
        timestamp=datetime.now(),
        metadata=ChunkMetadata(content_type="raw_chunk"),
    )


async def _wait_until(predicate, timeout: float = 1.0) -> None:
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        if predicate():
            return
        await asyncio.sleep(0.01)
    raise AssertionError("timed out waiting for socketio worker")


@pytest.fixture(autouse=True)
async def _reset_shared_driver():
    reset_shared_socketio_driver()
    yield
    driver = None
    from agentlang.streaming.drivers.socketio import driver as socketio_driver_module

    driver = socketio_driver_module._shared_driver
    reset_shared_socketio_driver()
    if driver is not None:
        await driver.shutdown()


@pytest.fixture(autouse=True)
def fake_socketio(monkeypatch):
    created: List[_FakeSocketIO] = []

    class _FakeSocketIOModule:
        class AsyncClient(_FakeSocketIO):
            def __init__(self, *args, **kwargs) -> None:
                super().__init__(*args, **kwargs)
                created.append(self)

    monkeypatch.setattr(
        "agentlang.streaming.drivers.socketio.driver.SOCKETIO_AVAILABLE",
        True,
    )
    monkeypatch.setattr(
        "agentlang.streaming.drivers.socketio.driver.socketio",
        _FakeSocketIOModule,
    )
    return created


@pytest.mark.asyncio
async def test_shared_driver_is_process_singleton():
    first = get_shared_socketio_driver(_enabled_config(_TagBuilder("a")))
    second = get_shared_socketio_driver(_enabled_config(_TagBuilder("b")))

    assert first is second
    assert first.config.message_builder.tag == "b"


@pytest.mark.asyncio
async def test_initialize_reuses_connection_and_worker(fake_socketio):
    driver = SocketIODriver(_enabled_config(_TagBuilder("a")))
    try:
        first = await driver.initialize()
        worker = driver.queue_worker_task
        second = await driver.initialize()

        assert first.success is True
        assert second.success is True
        assert second.message == "Socket.IO reused"
        assert len(fake_socketio) == 1
        assert driver.queue_worker_task is worker
        assert worker is not None and not worker.done()
    finally:
        await driver.shutdown()


@pytest.mark.asyncio
async def test_finalize_does_not_disconnect_or_stop_worker(fake_socketio):
    driver = SocketIODriver(_enabled_config(_TagBuilder("live")))
    try:
        await driver.initialize()
        client = fake_socketio[0]

        await driver.push(_chunk())
        result = await driver.finalize()
        await _wait_until(lambda: len(client.emits) == 1)

        assert result.success is True
        assert client.disconnect_calls == 0
        assert driver.queue_worker_task is not None
        assert not driver.queue_worker_task.done()
        assert client.emits[0]["message"]["tag"] == "live"
    finally:
        await driver.shutdown()


@pytest.mark.asyncio
async def test_push_uses_builder_from_enqueue_time(fake_socketio):
    driver = SocketIODriver(_enabled_config(_TagBuilder("first")))
    try:
        await driver.initialize()

        await driver.push(_chunk("req-a"))
        driver.attach_runtime_config(_enabled_config(_TagBuilder("second")))
        await driver.push(_chunk("req-b"))
        await _wait_until(lambda: len(fake_socketio[0].emits) == 2)

        tags = [item["message"]["tag"] for item in fake_socketio[0].emits]
        assert tags == ["first", "second"]
    finally:
        await driver.shutdown()


@pytest.mark.asyncio
async def test_queue_capacity_covers_aggregated_long_stream(fake_socketio):
    driver = SocketIODriver(_enabled_config(_TagBuilder("a")))
    try:
        await driver.initialize()
        assert driver.message_queue.maxsize == _MESSAGE_QUEUE_MAXSIZE
        assert _MESSAGE_QUEUE_MAXSIZE >= 5000
    finally:
        await driver.shutdown()


@pytest.mark.asyncio
async def test_shutdown_drains_and_disconnects(fake_socketio):
    driver = SocketIODriver(_enabled_config(_TagBuilder("bye")))
    await driver.initialize()
    client = fake_socketio[0]
    await driver.push(_chunk())

    result = await driver.shutdown()

    assert result.success is True
    assert client.disconnect_calls == 1
    assert not client.connected
    assert len(client.emits) == 1


@pytest.mark.asyncio
async def test_initialize_streaming_driver_reuses_shared_instance(fake_socketio):
    processor = ProcessorConfig.create_with_socketio_push(
        message_builder=_TagBuilder("shared"),
        socketio_driver_config=_enabled_config(),
    )
    context = _FakeContext()

    first = await StreamingCallProcessor.initialize_streaming_driver(
        processor, context, "req-1"
    )
    second = await StreamingCallProcessor.initialize_streaming_driver(
        processor, context, "req-2"
    )

    assert first is second
    assert first.get_driver_name() == "socketio"
    assert len(fake_socketio) == 1


@pytest.mark.asyncio
async def test_shutdown_shared_driver_clears_singleton(fake_socketio):
    config = _enabled_config(_TagBuilder("x"))
    first = get_shared_socketio_driver(config)
    await first.initialize()

    await shutdown_shared_socketio_driver()
    second = get_shared_socketio_driver(config)

    assert first is not second
    assert fake_socketio[0].disconnect_calls == 1
