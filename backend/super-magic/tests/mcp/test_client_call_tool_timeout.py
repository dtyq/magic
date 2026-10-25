"""MCPClient.call_tool 超时与断连传播的单元测试。

覆盖三个分支：
1. 调用正常完成 → 返回结果
2. 连接生命周期 task 先结束（断连）→ 立即失败，不等待完整超时
3. 调用在硬超时内既不完成也未断连 → 返回超时错误
"""

import asyncio
from types import SimpleNamespace

import pytest

from app.mcp.config.models import MCPServerConfig, MCPServerType
from app.mcp.connection.client import MCPClient


class _FakeSession:
    """可控的 MCP 会话替身。block_event 非 None 时 call_tool 永久阻塞。"""

    def __init__(self, result=None, block_event=None):
        self._result = result
        self._block_event = block_event

    async def send_ping(self):
        return True

    async def call_tool(self, name, arguments):
        if self._block_event is not None:
            await self._block_event.wait()
            raise asyncio.CancelledError
        return self._result


def _make_client(session, conn_task=None, tool_call_timeout=300.0):
    client = MCPClient(MCPServerConfig(name="t", type=MCPServerType.HTTP, url="http://x"))
    client.session = session
    client._conn_task = conn_task
    client.tool_call_timeout = tool_call_timeout
    return client


@pytest.mark.asyncio
async def test_call_tool_returns_result_on_success():
    result = SimpleNamespace(content=[{"type": "text", "text": "ok"}], isError=False)
    client = _make_client(_FakeSession(result=result))
    conn_task = asyncio.create_task(asyncio.sleep(3600))  # 长生命周期，不应触发
    client._conn_task = conn_task
    try:
        raw = await client.call_tool("mock_tool", {})
        assert raw["isError"] is False
        assert raw["content"][0]["text"] == "ok"
    finally:
        conn_task.cancel()


@pytest.mark.asyncio
async def test_call_tool_fails_fast_on_connection_loss():
    """断连（生命周期 task 先完成）时应立即失败，而不是等满超时。"""
    block_event = asyncio.Event()
    client = _make_client(_FakeSession(block_event=block_event), tool_call_timeout=3600)

    # 模拟连接生命周期 task 很快结束（例如 ReadTimeout 触发断连）
    client._conn_task = asyncio.create_task(asyncio.sleep(0.01))

    raw = await client.call_tool("mock_tool", {})
    assert raw["isError"] is True
    assert "连接中断" in raw["content"][0]["text"]


@pytest.mark.asyncio
async def test_call_tool_times_out_when_call_hangs():
    """调用既不完成也不断连时，应在硬超时后返回超时错误。"""
    block_event = asyncio.Event()
    client = _make_client(_FakeSession(block_event=block_event), tool_call_timeout=0.05)

    raw = await client.call_tool("mock_tool", {})
    assert raw["isError"] is True
    assert "超时" in raw["content"][0]["text"]
