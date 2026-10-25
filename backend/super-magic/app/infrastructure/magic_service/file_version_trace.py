"""文件版本请求的阶段诊断，仅收集时间点，不改变请求行为。"""

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from time import monotonic
from types import SimpleNamespace
from uuid import uuid4

import aiohttp


@dataclass
class FileVersionRequestTrace:
    diagnostic_id: str = field(default_factory=lambda: uuid4().hex)
    started_at: float = field(default_factory=monotonic)
    phase: str = "request_setup"
    events_ms: dict[str, float] = field(default_factory=dict)
    http_status: int | None = None
    response_request_id: str | None = None
    response_log_id: str | None = None

    def mark(self, event: str, phase: str) -> None:
        self.events_ms[event] = round((monotonic() - self.started_at) * 1000, 1)
        self.phase = phase

    def summary(self) -> str:
        return json.dumps({
            "diagnostic_id": self.diagnostic_id,
            "phase": self.phase,
            "elapsed_ms": round((monotonic() - self.started_at) * 1000, 1),
            "network_trace_observed": "request_start" in self.events_ms,
            "events_ms": self.events_ms,
            "http_status": self.http_status,
            "response_request_id": self.response_request_id,
            "response_log_id": self.response_log_id,
        }, ensure_ascii=False)


def create_file_version_trace_config() -> aiohttp.TraceConfig:
    trace_config = aiohttp.TraceConfig()

    # 例：只有 connection_create_start 而没有结束点，说明仍在建连；
    # 已有 headers_sent 却没有 response_headers_received，说明正在等待响应头。
    # 其它接口没有传入诊断对象，回调直接返回，不记录其请求内容或认证头。
    def record(
        event: str, phase: str,
    ) -> Callable[[aiohttp.ClientSession, SimpleNamespace, object], Awaitable[None]]:
        async def callback(
            session: aiohttp.ClientSession,
            context: SimpleNamespace,
            params: object,
        ) -> None:
            request_trace = context.trace_request_ctx
            if isinstance(request_trace, FileVersionRequestTrace):
                request_trace.mark(event, phase)

        return callback

    trace_config.on_request_start.append(record("request_start", "acquiring_connection"))
    trace_config.on_connection_queued_start.append(record("connection_queued_start", "connection_pool_wait"))
    trace_config.on_connection_queued_end.append(record("connection_queued_end", "acquiring_connection"))
    trace_config.on_connection_create_start.append(record("connection_create_start", "connecting"))
    trace_config.on_dns_resolvehost_start.append(record("dns_start", "dns_resolving"))
    trace_config.on_dns_resolvehost_end.append(record("dns_end", "connecting"))
    trace_config.on_connection_create_end.append(record("connection_create_end", "sending_request"))
    trace_config.on_connection_reuseconn.append(record("connection_reused", "sending_request"))
    trace_config.on_request_headers_sent.append(record("headers_sent", "sending_request"))
    trace_config.on_request_chunk_sent.append(record("request_body_sent", "waiting_response_headers"))
    return trace_config
