"""MCP 初始化阶段非标准响应的错误传播测试。"""

import asyncio
import json
import time

import pytest

from app.mcp.config.models import MCPServerConfig, MCPServerType
from app.mcp.connection.client import MCPClient


async def _read_http_request(reader: asyncio.StreamReader) -> dict:
    """读取 mock HTTP 服务收到的一个 JSON 请求。"""
    header = await reader.readuntil(b"\r\n\r\n")
    lines = header.decode("latin1").split("\r\n")
    content_length = next(
        int(line.split(":", 1)[1].strip()) for line in lines if line.lower().startswith("content-length:")
    )
    return json.loads((await reader.readexactly(content_length)).decode())


async def _write_json_response(writer: asyncio.StreamWriter, payload: dict, status: int = 200) -> None:
    """向 mock HTTP 客户端返回一个 JSON 响应。"""
    body = json.dumps(payload, separators=(",", ":")).encode()
    writer.write(
        f"HTTP/1.1 {status} Test\r\n".encode() + b"Content-Type: application/json\r\n"
        b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body
    )
    await writer.drain()


@pytest.mark.asyncio
async def test_non_standard_remote_error_fails_fast_with_message():
    """已收到的业务错误应快速失败，而不是被外层连接超时覆盖。"""

    async def handler(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        try:
            await _read_http_request(reader)
            await _write_json_response(writer, {"code": 4001, "message": "未登录", "data": {}})
        finally:
            writer.close()
            await writer.wait_closed()

    server = await asyncio.start_server(handler, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    client = MCPClient(
        MCPServerConfig(name="mock", type=MCPServerType.HTTP, url=f"http://127.0.0.1:{port}/mcp"),
        max_retries=0,
    )
    started = time.monotonic()
    try:
        assert await asyncio.wait_for(client.connect(), timeout=3) is False
        assert time.monotonic() - started < 2.5
        assert client.last_error is not None
        assert "未登录" in client.last_error
        assert "timeout" not in client.last_error.lower()
    finally:
        await client.disconnect()
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_standard_initialize_response_still_connects():
    """合法 initialize 响应仍按标准 MCP 流程建立连接。"""

    async def handler(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        try:
            while True:
                request = await _read_http_request(reader)
                if request.get("method") == "initialize":
                    await _write_json_response(
                        writer,
                        {
                            "jsonrpc": "2.0",
                            "id": request["id"],
                            "result": {
                                "protocolVersion": "2025-06-18",
                                "capabilities": {},
                                "serverInfo": {"name": "mock", "version": "1"},
                            },
                        },
                    )
        except (asyncio.IncompleteReadError, ConnectionError):
            pass
        finally:
            writer.close()
            await writer.wait_closed()

    server = await asyncio.start_server(handler, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    client = MCPClient(
        MCPServerConfig(name="mock", type=MCPServerType.HTTP, url=f"http://127.0.0.1:{port}/mcp"),
        max_retries=0,
    )
    try:
        assert await asyncio.wait_for(client.connect(), timeout=3) is True
        assert client.last_error is None
    finally:
        await client.disconnect()
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_http_error_status_is_normalized_except_fallback_controls():
    """明确的 HTTP 认证错误也应进入统一 JSON-RPC 错误链路。"""

    async def handler(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        try:
            await _read_http_request(reader)
            await _write_json_response(
                writer,
                {"code": 4001, "message": "未登录", "data": {}},
                status=401,
            )
        finally:
            writer.close()
            await writer.wait_closed()

    server = await asyncio.start_server(handler, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    client = MCPClient(
        MCPServerConfig(name="mock", type=MCPServerType.HTTP, url=f"http://127.0.0.1:{port}/mcp"),
        max_retries=0,
    )
    try:
        assert await asyncio.wait_for(client.connect(), timeout=3) is False
        assert client.last_error is not None
        assert "未登录" in client.last_error
    finally:
        await client.disconnect()
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_no_response_remains_a_timeout():
    """没有收到任何响应时仍保持调用方的超时语义。"""

    async def handler(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        try:
            await _read_http_request(reader)
            await asyncio.sleep(1)
        except (asyncio.IncompleteReadError, ConnectionError):
            pass
        finally:
            writer.close()
            await writer.wait_closed()

    server = await asyncio.start_server(handler, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    client = MCPClient(
        MCPServerConfig(name="mock", type=MCPServerType.HTTP, url=f"http://127.0.0.1:{port}/mcp"),
        max_retries=0,
    )
    try:
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(client.connect(), timeout=0.05)
    finally:
        await client.disconnect()
        server.close()
        await server.wait_closed()
