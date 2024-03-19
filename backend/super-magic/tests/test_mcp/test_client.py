"""MCPClient 客户端类单元测试"""

import asyncio
import pytest
import tempfile
import os
import subprocess
import sys
from typing import Dict, Any
from unittest.mock import patch, AsyncMock
from pathlib import Path

# 获取项目根目录
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

# 初始化路径管理器
from app.paths import PathManager
PathManager.set_project_root(project_root)
from agentlang.context.application_context import ApplicationContext
ApplicationContext.set_path_manager(PathManager())

from app.mcp.client import MCPClient
from app.mcp.server_config import MCPServerConfig, MCPServerType, MCPConfigSource


class TestMCPClient:
    """MCPClient 测试类"""

    @pytest.fixture
    def http_config(self):
        """HTTP 服务器配置fixture"""
        return MCPServerConfig(
            name="test-http-server",
            type=MCPServerType.HTTP,
            url="https://api.example.com/mcp",
            token="test-token",
            headers=None,
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

    @pytest.fixture
    def stdio_config(self):
        """Stdio 服务器配置fixture"""
        return MCPServerConfig(
            name="test-stdio-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=None,
            command=sys.executable,
            args=[os.path.join(os.path.dirname(__file__), "mock_mcp_server.py")],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

    @pytest.fixture
    def stdio_config_with_allowed_tools(self):
        """带工具过滤的 Stdio 服务器配置fixture"""
        return MCPServerConfig(
            name="test-stdio-server-filtered",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=None,
            command=sys.executable,
            args=[os.path.join(os.path.dirname(__file__), "mock_mcp_server.py")],
            env={},
            allowed_tools=["echo"],
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

    @pytest.fixture
    def http_config_with_headers(self):
        """带自定义头部的 HTTP 服务器配置fixture"""
        return MCPServerConfig(
            name="test-http-server-with-headers",
            type=MCPServerType.HTTP,
            url="https://api.example.com/mcp",
            token=None,
            headers={
                "X-API-Key": "test-api-key",
                "X-Custom-Header": "custom-value",
                "User-Agent": "test-agent"
            },
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

    @pytest.fixture
    def http_config_with_headers_and_token(self):
        """带自定义头部和令牌的 HTTP 服务器配置fixture"""
        return MCPServerConfig(
            name="test-http-server-with-headers-and-token",
            type=MCPServerType.HTTP,
            url="https://api.example.com/mcp",
            token="test-token",
            headers={
                "X-API-Key": "test-api-key",
                "Authorization": "Bearer old-token"  # 会被 token 字段覆盖
            },
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

    def test_client_initialization(self, http_config):
        """测试客户端初始化"""
        client = MCPClient(http_config)

        assert client.config == http_config
        assert client.session is None
        assert client._read_stream is None
        assert client._write_stream is None
        assert client._transport_context is None

    def test_client_str_representation(self, http_config):
        """测试客户端字符串表示"""
        client = MCPClient(http_config)
        expected = "MCPClient(server='test-http-server', type=http, status=未连接)"
        assert str(client) == expected

    @pytest.mark.asyncio
    async def test_http_connection_failure(self):
        """测试 HTTP 连接失败场景"""
        # 使用一个格式无效的 URL 来快速失败
        config = MCPServerConfig(
            name="test-http-server",
            type=MCPServerType.HTTP,
            url="invalid://url",  # 无效的协议,
            token=None,
            headers=None,
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )
        client = MCPClient(config)

        # HTTP 连接到无效 URL 应该失败
        result = await client.connect()
        assert result is False
        assert client.session is None

    @pytest.mark.asyncio
    async def test_stdio_connection_success(self, stdio_config):
        """测试 Stdio 连接成功场景"""
        client = MCPClient(stdio_config)

        try:
            result = await client.connect()
            assert result is True
            assert client.session is not None

            # 测试连接状态
            status = await client.ping()
            assert status is True

        finally:
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_stdio_connection_invalid_command(self):
        """测试 Stdio 连接失败 - 无效命令"""
        config = MCPServerConfig(
            name="test-invalid-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=None,
            command="invalid_command_that_does_not_exist",
            args=["some_arg"],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )
        client = MCPClient(config)

        result = await client.connect()
        assert result is False
        assert client.session is None

    @pytest.mark.asyncio
    async def test_list_tools_success(self, stdio_config):
        """测试获取工具列表成功"""
        client = MCPClient(stdio_config)

        try:
            await client.connect()
            tools = await client.list_tools()

            assert len(tools) >= 2  # echo, add, error_tool

            # 检查 echo 工具
            echo_tool = next((t for t in tools if t["name"] == "echo"), None)
            assert echo_tool is not None
            assert echo_tool["description"] == "回显输入的消息"
            assert "inputSchema" in echo_tool
            assert echo_tool["inputSchema"]["properties"]["message"]["type"] == "string"

            # 检查 add 工具
            add_tool = next((t for t in tools if t["name"] == "add"), None)
            assert add_tool is not None
            assert add_tool["description"] == "计算两个数字的和"

        finally:
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_list_tools_with_allowed_filter(self, stdio_config_with_allowed_tools):
        """测试工具列表过滤功能"""
        client = MCPClient(stdio_config_with_allowed_tools)

        try:
            await client.connect()
            tools = await client.list_tools()

            # 应该只有 echo 工具
            assert len(tools) == 1
            assert tools[0]["name"] == "echo"

        finally:
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_list_tools_not_connected(self, stdio_config):
        """测试未连接时获取工具列表"""
        client = MCPClient(stdio_config)

        with pytest.raises(RuntimeError, match="未连接到 MCP 服务器"):
            await client.list_tools()

    @pytest.mark.asyncio
    async def test_call_tool_success(self, stdio_config):
        """测试工具调用成功"""
        client = MCPClient(stdio_config)

        try:
            await client.connect()

            # 测试 echo 工具
            result = await client.call_tool("echo", {"message": "Hello, World!"})
            assert "content" in result
            assert isinstance(result["content"], list)
            assert len(result["content"]) > 0

            # 测试 add 工具
            result = await client.call_tool("add", {"a": 5, "b": 3})
            assert "content" in result
            assert isinstance(result["content"], list)

        finally:
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_call_tool_error(self, stdio_config):
        """测试工具调用失败"""
        client = MCPClient(stdio_config)

        try:
            await client.connect()

            # 调用故意出错的工具
            # MCP 框架可能会捕获异常并返回错误结果而不是抛出异常
            result = await client.call_tool("error_tool", {})

            # 检查是否返回了错误结果
            assert "isError" in result
            # 如果返回的不是错误，那么至少应该有内容
            assert "content" in result

        finally:
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_call_tool_not_connected(self, stdio_config):
        """测试未连接时调用工具（自动重连失败的情况）"""
        client = MCPClient(stdio_config)

        # Mock connect 方法使其返回 False，模拟连接失败
        with patch.object(client, 'connect', return_value=False):
            result = await client.call_tool("echo", {"message": "test"})

            # 验证返回错误结果而不是抛出异常
            assert "isError" in result
            assert result["isError"] is True
            assert "content" in result
            assert len(result["content"]) > 0
            assert "无法连接到 MCP 服务器" in result["content"][0]["text"]

    @pytest.mark.asyncio
    async def test_ping_success(self, stdio_config):
        """测试健康检查成功"""
        client = MCPClient(stdio_config)

        try:
            await client.connect()
            result = await client.ping()
            assert result is True

        finally:
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_ping_not_connected(self, stdio_config):
        """测试未连接时健康检查"""
        client = MCPClient(stdio_config)

        result = await client.ping()
        assert result is False

    @pytest.mark.asyncio
    async def test_disconnect_cleanup(self, stdio_config):
        """测试断开连接的清理逻辑"""
        client = MCPClient(stdio_config)

        # 连接
        await client.connect()
        assert client.session is not None
        assert client._transport_context is not None

        # 断开连接
        await client.disconnect()
        assert client.session is None
        assert client._transport_context is None

        # 再次断开连接应该不会出错
        await client.disconnect()

    @pytest.mark.asyncio
    async def test_async_context_manager_success(self, stdio_config):
        """测试异步上下文管理器成功场景"""
        async with MCPClient(stdio_config) as client:
            assert client.session is not None

            tools = await client.list_tools()
            assert len(tools) > 0

            result = await client.call_tool("echo", {"message": "test"})
            assert "content" in result

        # 上下文退出后应该自动断开连接
        assert client.session is None

    @pytest.mark.asyncio
    async def test_async_context_manager_connection_failure(self):
        """测试异步上下文管理器连接失败场景"""
        # 使用一个明确无法连接的本地地址
        config = MCPServerConfig(
            name="test-http-server",
            type=MCPServerType.HTTP,
            url="http://localhost:99999/mcp",
            token=None,
            headers=None,
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

        with pytest.raises(RuntimeError, match="无法连接到 MCP 服务器"):
            async with MCPClient(config) as client:
                # 这里不应该执行到
                pass

    @pytest.mark.asyncio
    async def test_connection_validation_http_no_url(self):
        """测试 HTTP 连接配置验证 - 缺少 URL"""
        config = MCPServerConfig(
            name="test-server",
            type=MCPServerType.HTTP,
            url=None,
            token=None,
            headers=None,
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )
        client = MCPClient(config)

        result = await client.connect()
        assert result is False

    @pytest.mark.asyncio
    async def test_connection_validation_stdio_no_command(self):
        """测试 Stdio 连接验证 - 缺少命令"""
        config = MCPServerConfig(
            name="test-stdio-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=None,
            command=None,
            args=["server.py"],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )
        client = MCPClient(config)

        result = await client.connect()
        assert result is False

    def test_prepare_headers_with_token_only(self, http_config):
        """测试 _prepare_headers 方法 - 仅有令牌"""
        client = MCPClient(http_config)
        headers = client._prepare_headers()

        expected = {"Authorization": "Bearer test-token"}
        assert headers == expected

    def test_prepare_headers_with_headers_only(self, http_config_with_headers):
        """测试 _prepare_headers 方法 - 仅有自定义头部"""
        client = MCPClient(http_config_with_headers)
        headers = client._prepare_headers()

        expected = {
            "X-API-Key": "test-api-key",
            "X-Custom-Header": "custom-value",
            "User-Agent": "test-agent"
        }
        assert headers == expected

    def test_prepare_headers_with_headers_and_token(self, http_config_with_headers_and_token):
        """测试 _prepare_headers 方法 - 自定义头部和令牌"""
        client = MCPClient(http_config_with_headers_and_token)
        headers = client._prepare_headers()

        # token 应该覆盖 headers 中的 Authorization
        expected = {
            "X-API-Key": "test-api-key",
            "Authorization": "Bearer test-token"  # 来自 token 字段，不是 headers 中的
        }
        assert headers == expected

    def test_prepare_headers_no_token_no_headers(self):
        """测试 _prepare_headers 方法 - 无令牌无头部"""
        config = MCPServerConfig(
            name="test-http-server",
            type=MCPServerType.HTTP,
            url="https://api.example.com/mcp",
            token=None,
            headers=None,
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )
        client = MCPClient(config)
        headers = client._prepare_headers()

        assert headers == {}

    def test_prepare_headers_empty_headers_dict(self):
        """测试 _prepare_headers 方法 - 空的头部字典"""
        config = MCPServerConfig(
            name="test-http-server",
            type=MCPServerType.HTTP,
            url="https://api.example.com/mcp",
            token=None,
            headers={},
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )
        client = MCPClient(config)
        headers = client._prepare_headers()

        assert headers == {}

    def test_prepare_headers_with_token_and_empty_headers(self):
        """测试 _prepare_headers 方法 - 有令牌和空头部字典"""
        config = MCPServerConfig(
            name="test-http-server",
            type=MCPServerType.HTTP,
            url="https://api.example.com/mcp",
            token="test-token",
            headers={},
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )
        client = MCPClient(config)
        headers = client._prepare_headers()

        expected = {"Authorization": "Bearer test-token"}
        assert headers == expected
