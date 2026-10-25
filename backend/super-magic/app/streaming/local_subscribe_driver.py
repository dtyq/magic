# app/streaming/local_subscribe_driver.py
"""把 V2 chunk 抄到本地 /subscribe WebSocket。

Socket.IO 仍只负责发往 magic-service。本驱动是 Broadcast 上的额外目标：
有调试面板连着时才有订阅者；没人连时 push 空转，不影响线上。

| 目标                 | 谁推                          | 协议                         |
| 正式前端 / magic-service | SocketIODriver               | shadow + intermediate        |
| 本地调试面板           | LocalSubscribeStreamingDriver | 明文 super_magic_chunk JSON |

主 Agent 和子 Agent 共用这一份进程级订阅列表。子 Agent 不继承 streams，
但 initialize_streaming_driver 会从 get_streaming_sinks() 拿到本单例。
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from agentlang.logger import get_logger
from agentlang.streaming.interface import StreamingInterface
from agentlang.streaming.models import ChunkData, StreamingResult
from app.core.stream.websocket_stream import WebSocketStream

logger = get_logger(__name__)

_driver: Optional["LocalSubscribeStreamingDriver"] = None


def get_local_subscribe_driver() -> "LocalSubscribeStreamingDriver":
    """进程内单例。主 / 子 Agent 都写到同一批 /subscribe 连接。"""
    global _driver
    if _driver is None:
        _driver = LocalSubscribeStreamingDriver()
    return _driver


def register_local_subscribe_stream(stream: WebSocketStream) -> None:
    get_local_subscribe_driver().register_stream(stream)


def unregister_local_subscribe_stream(stream: WebSocketStream) -> None:
    get_local_subscribe_driver().unregister_stream(stream)


def reset_local_subscribe_driver() -> None:
    """测试用：清空订阅列表，避免用例互相污染。"""
    global _driver
    if _driver is not None:
        _driver._streams.clear()


class LocalSubscribeStreamingDriver(StreamingInterface):
    """把已聚合的 super_magic_chunk 以明文写到本地 /subscribe。

    不走 shadow、不要求 magic-service 鉴权。finalize 不关订阅连接，
    连接生命周期由 /subscribe 自己管理。
    """

    def __init__(self) -> None:
        self._streams: List[WebSocketStream] = []

    def register_stream(self, stream: WebSocketStream) -> None:
        if stream not in self._streams:
            self._streams.append(stream)
            logger.info("本地 /subscribe 已加入流式分发，当前连接数: %s", len(self._streams))

    def unregister_stream(self, stream: WebSocketStream) -> None:
        try:
            self._streams.remove(stream)
            logger.info("本地 /subscribe 已退出流式分发，当前连接数: %s", len(self._streams))
        except ValueError:
            pass

    def has_subscribers(self) -> bool:
        return bool(self._streams)

    async def initialize(self) -> StreamingResult:
        return StreamingResult(success=True)

    async def push(self, chunk_data: ChunkData) -> StreamingResult:
        if not self._streams:
            return StreamingResult(success=True)

        payload = self._build_payload(chunk_data)
        if payload is None:
            return StreamingResult(success=True)

        message = json.dumps(payload, ensure_ascii=False)
        for stream in list(self._streams):
            try:
                await stream.write(message)
            except Exception as exc:
                logger.warning("本地 /subscribe 写入 V2 chunk 失败: %s", exc)

        return StreamingResult(success=True)

    async def finalize(self) -> StreamingResult:
        # 订阅连接由 /subscribe 持有，这里不能 disconnect。
        return StreamingResult(success=True)

    async def is_available(self) -> bool:
        return True

    def get_driver_name(self) -> str:
        return "local_subscribe"

    def _build_payload(self, chunk_data: ChunkData) -> Optional[Dict[str, Any]]:
        extra = chunk_data.delta.extra_fields if chunk_data.delta else None
        if not extra or "super_magic_chunk" not in extra:
            return None

        raw_chunk = extra["super_magic_chunk"]
        if not isinstance(raw_chunk, dict):
            return None

        # 复制后再补 ID，避免改到 Socket.IO 仍在用的同一份 extra_fields。
        chunk = dict(raw_chunk)
        app_message_id = chunk_data.metadata.message_id if chunk_data.metadata else None
        chunk["super_message_id"] = app_message_id
        return {
            "type": "super_magic_chunk",
            "super_magic_chunk": chunk,
            "app_message_id": app_message_id,
        }
