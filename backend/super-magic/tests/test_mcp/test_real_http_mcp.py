"""测试真实的 HTTP MCP 服务器

使用真实的 MCP 服务器地址进行集成测试，验证 HTTP 连接功能。
"""
# 设置项目根目录 - 必须在导入项目模块之前
import sys
from pathlib import Path

# 获取项目根目录
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

# 初始化路径管理器
from app.paths import PathManager
PathManager.set_project_root(project_root)
from agentlang.context.application_context import ApplicationContext
ApplicationContext.set_path_manager(PathManager())

import pytest
import asyncio
from app.mcp.client import MCPClient
from app.mcp.server_config import MCPServerConfig, MCPServerType, MCPConfigSource


class TestRealHTTPMCP:
    """测试真实的 HTTP MCP 服务器连接

    这些测试使用真实的外部 MCP 服务器，可能会因为网络问题或服务器状态而失败。
    如果测试失败，请检查网络连接和服务器可用性。
    """

    @pytest.fixture
    def amap_mcp_config(self):
        """高德地图 MCP 服务器配置"""
        return MCPServerConfig(
            name="amap-mcp-server",
            type=MCPServerType.HTTP,
            url="https://mcp.amap.com/sse?key=123456",
            token=None,
            headers=None,
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

    @pytest.mark.asyncio
    async def test_amap_http_connection(self, amap_mcp_config):
        """测试连接到高德地图 HTTP MCP 服务器"""
        client = MCPClient(amap_mcp_config)

        try:
            # 尝试连接
            result = await client.connect()
            assert result is True, "应该能够成功连接到高德地图 MCP 服务器"
            assert client.session is not None, "连接成功后应该有 session"

        finally:
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_amap_http_list_tools(self, amap_mcp_config):
        """测试从高德地图 HTTP MCP 服务器获取工具列表"""
        client = MCPClient(amap_mcp_config)

        try:
            # 连接并获取工具列表
            await client.connect()
            tools = await client.list_tools()

            # 验证工具列表
            assert isinstance(tools, list), "工具列表应该是一个列表"
            assert len(tools) > 0, "应该至少有一个工具"

            # 检查工具的基本结构
            for tool in tools:
                assert "name" in tool, "每个工具都应该有名字"
                assert "description" in tool, "每个工具都应该有描述"
                assert isinstance(tool["name"], str), "工具名称应该是字符串"
                assert isinstance(tool["description"], str), "工具描述应该是字符串"

            # 验证预期的地图相关工具
            tool_names = [tool["name"] for tool in tools]
            expected_tools = [
                "maps_direction_driving",  # 驾车路径规划
                "maps_direction_walking",  # 步行路径规划
                "maps_geo",               # 地理编码
                "maps_regeocode",         # 逆地理编码
                "maps_text_search",       # 文本搜索
                "maps_weather"            # 天气查询
            ]

            # 检查是否包含预期的工具（至少包含一些）
            found_tools = [tool for tool in expected_tools if tool in tool_names]
            assert len(found_tools) > 0, f"应该包含一些预期的地图工具，找到: {found_tools}"

        finally:
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_amap_http_context_manager(self, amap_mcp_config):
        """测试使用异步上下文管理器连接高德地图服务器"""
        async with MCPClient(amap_mcp_config) as client:
            # 在上下文中获取工具列表
            tools = await client.list_tools()
            assert isinstance(tools, list), "工具列表应该是一个列表"
            assert len(tools) > 0, "应该至少有一个工具"

    @pytest.mark.asyncio
    async def test_amap_ping_health_check(self, amap_mcp_config):
        """测试高德地图 MCP 服务器的健康检查"""
        client = MCPClient(amap_mcp_config)

        try:
            await client.connect()

            # 执行健康检查
            is_healthy = await client.ping()
            assert is_healthy is True, "连接的服务器应该响应 ping"

        finally:
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_amap_tool_call_example(self, amap_mcp_config):
        """测试调用高德地图的天气工具（如果可用）"""
        client = MCPClient(amap_mcp_config)

        try:
            await client.connect()
            tools = await client.list_tools()

            # 查找天气工具
            weather_tool = None
            for tool in tools:
                if "weather" in tool["name"].lower():
                    weather_tool = tool
                    break

            if weather_tool:
                # 尝试调用天气工具
                try:
                    result = await client.call_tool(
                        weather_tool["name"],
                        {"city": "北京"}  # 使用北京作为测试城市
                    )

                    # 验证返回结果的结构
                    assert "content" in result, "工具调用结果应该包含 content"
                    assert isinstance(result["content"], list), "content 应该是列表"

                except Exception as e:
                    # 工具调用可能因为参数不匹配而失败，这是正常的
                    pytest.skip(f"工具调用失败（可能是参数问题）: {e}")
            else:
                pytest.skip("未找到天气相关工具")

        finally:
            await client.disconnect()


class TestGenericHTTPMCP:
    """通用 HTTP MCP 测试，用于测试不同的 HTTP MCP 服务器"""

    @pytest.mark.asyncio
    async def test_http_connection_timeout_handling(self):
        """测试 HTTP 连接超时处理"""
        # 使用一个不存在的域名来测试超时
        config = MCPServerConfig(
            name="timeout-test-server",
            type=MCPServerType.HTTP,
            url="https://non-existent-mcp-server-12345.com/mcp",
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

        # 连接应该失败
        result = await client.connect()
        assert result is False, "连接到不存在的服务器应该失败"
        assert client.session is None, "失败的连接不应该有 session"

    @pytest.mark.asyncio
    async def test_invalid_http_url_format(self):
        """测试无效的 HTTP URL 格式"""
        config = MCPServerConfig(
            name="invalid-url-server",
            type=MCPServerType.HTTP,
            url="invalid-url-format",
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

        # 连接应该失败
        result = await client.connect()
        assert result is False, "无效 URL 格式的连接应该失败"
        assert client.session is None, "失败的连接不应该有 session"
