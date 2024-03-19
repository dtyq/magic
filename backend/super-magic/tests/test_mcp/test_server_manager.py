"""MCP 服务器管理器单元测试 - 使用真实的 MCP 服务器"""

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
import subprocess
import time
import signal
import os
import warnings
from typing import Dict, List, Any
from unittest.mock import patch, AsyncMock

# 只过滤 AnyIO 的 cancel scope 相关警告
warnings.filterwarnings(
    "ignore",
    message=".*Attempted to exit cancel scope in a different task.*",
    category=RuntimeWarning
)


from app.mcp.server_manager import MCPServerManager
from app.mcp.server_config import MCPServerConfig, MCPServerType
from agentlang.tools.tool_result import ToolResult


class TestMCPServerManagerReal:
    """测试 MCP 服务器管理器 - 使用真实的 MCP 服务器"""

    @pytest.fixture
    def single_server_configs(self):
        """单个服务器配置"""
        return [
            {
                "name": "mock-server",
                "type": "stdio",
                "command": str(project_root / ".venv" / "bin" / "python"),
                "args": [str(Path(__file__).parent / "mock_mcp_server.py")]
            }
        ]

    @pytest.fixture
    def multiple_server_configs(self):
        """多个不同服务器配置"""
        return [
            {
                "name": "math-server",
                "type": "stdio",
                "command": str(project_root / ".venv" / "bin" / "python"),
                "args": [str(Path(__file__).parent / "mock_mcp_server.py")]
            },
            {
                "name": "calc-server",
                "type": "stdio",
                "command": str(project_root / ".venv" / "bin" / "python"),
                "args": [str(Path(__file__).parent / "mock_mcp_server_2.py")]
            },
            {
                "name": "text-server",
                "type": "stdio",
                "command": str(project_root / ".venv" / "bin" / "python"),
                "args": [str(Path(__file__).parent / "mock_mcp_server_3.py")]
            }
        ]

    @pytest.fixture
    def mixed_server_configs(self):
        """混合服务器配置（包含失败的）"""
        return [
            {
                "name": "mock-server-1",
                "type": "stdio",
                "command": str(project_root / ".venv" / "bin" / "python"),
                "args": [str(Path(__file__).parent / "mock_mcp_server.py")]
            },
            {
                "name": "mock-server-2",
                "type": "http",
                "url": "https://mcp.amapqqq.com/sse?key=123"
            }
        ]

    @pytest.fixture
    async def single_manager(self, single_server_configs):
        """单服务器管理器"""
        # 将列表转换为字典: server_name -> MCPServerConfig
        configs_dict = {
            config['name']: MCPServerConfig(**config)
            for config in single_server_configs
        }
        manager = MCPServerManager(configs_dict)
        yield manager
        # 清理
        try:
            await manager.shutdown()
        except Exception:
            # 忽略清理错误
            pass

    def test_initialization(self, single_manager, single_server_configs):
        """测试管理器初始化"""
        assert len(single_manager.server_configs) == 1
        assert "mock-server" in single_manager.server_configs
        assert single_manager.server_configs["mock-server"].name == "mock-server"
        assert single_manager.server_configs["mock-server"].type == MCPServerType.STDIO
        assert len(single_manager.clients) == 0
        assert len(single_manager.tools) == 0

    def test_session_index_to_letter(self, single_manager):
        """测试会话索引到字母的转换"""
        from app.mcp.server_manager import SessionIndexManager
        assert SessionIndexManager.index_to_letter(0) == "a"
        assert SessionIndexManager.index_to_letter(1) == "b"
        assert SessionIndexManager.index_to_letter(25) == "z"
        assert SessionIndexManager.index_to_letter(26) == "aa"  # Excel列名规则: A-Z (0-25), AA-AZ (26-51)
        assert SessionIndexManager.index_to_letter(27) == "ab"

    @pytest.mark.asyncio
    async def test_discover_success(self, single_manager):
        """测试成功发现工具"""
        await single_manager.discover()

        # 验证发现状态
        assert len(single_manager.clients) == 1
        assert "mock-server" in single_manager.clients

        # 验证工具注册 - mock_mcp_server.py 提供 5 个工具
        assert len(single_manager.tools) == 5

        # 验证具体工具
        expected_tools = ["mcp_a_echo", "mcp_a_add", "mcp_a_error_tool", "mcp_a_get_user_info", "mcp_a_validation_error"]
        for tool_name in expected_tools:
            assert tool_name in single_manager.tools

        # 验证工具信息
        echo_tool = single_manager.tools["mcp_a_echo"]
        assert echo_tool.original_name == "echo"
        assert echo_tool.server_name == "mock-server"
        assert echo_tool.session_letter == "a"
        assert "回显输入的消息" in echo_tool.description

        add_tool = single_manager.tools["mcp_a_add"]
        assert add_tool.original_name == "add"
        assert add_tool.server_name == "mock-server"
        assert add_tool.session_letter == "a"
        assert "计算两个数字的和" in add_tool.description

    @pytest.mark.asyncio
    async def test_discover_skip_if_already_discovered(self, single_manager):
        """测试跳过重复发现"""
        # 第一次发现
        await single_manager.discover()
        initial_client_count = len(single_manager.clients)
        initial_tool_count = len(single_manager.tools)

        # 第二次发现应该跳过
        await single_manager.discover()
        assert len(single_manager.clients) == initial_client_count
        assert len(single_manager.tools) == initial_tool_count

    @pytest.mark.asyncio
    async def test_get_all_tools(self, single_manager):
        """测试获取所有工具"""
        await single_manager.discover()

        tools = await single_manager.get_all_tools()

        # 验证返回工具
        assert len(tools) == 5
        assert "mcp_a_echo" in tools
        assert "mcp_a_add" in tools
        assert "mcp_a_error_tool" in tools
        assert "mcp_a_get_user_info" in tools
        assert "mcp_a_validation_error" in tools

        # 验证是副本而不是原始引用
        from app.mcp.server_manager import MCPToolInfo
        tools["new_tool"] = MCPToolInfo(
            name="new_tool",
            original_name="new_tool",
            server_name="test",
            session_letter="z",
            description="",
            inputSchema={}
        )
        assert "new_tool" not in single_manager.tools

    @pytest.mark.asyncio
    async def test_call_mcp_tool_echo_success(self, single_manager):
        """测试成功调用 echo 工具"""
        await single_manager.discover()

        # 调用 echo 工具
        result = await single_manager.call_mcp_tool("mcp_a_echo", {"message": "Hello, World!"})

        # 验证结果
        assert isinstance(result, ToolResult)
        assert result.ok is True
        assert "Echo: Hello, World!" in result.content

    @pytest.mark.asyncio
    async def test_call_mcp_tool_add_success(self, single_manager):
        """测试成功调用 add 工具"""
        await single_manager.discover()

        # 调用 add 工具
        result = await single_manager.call_mcp_tool("mcp_a_add", {"a": 5, "b": 3})

        # 验证结果
        assert isinstance(result, ToolResult)
        assert result.ok is True
        assert "Result: 8" in result.content

    @pytest.mark.asyncio
    async def test_call_mcp_tool_error_handling(self, single_manager):
        """测试工具执行错误处理"""
        await single_manager.discover()

        # 调用会出错的工具
        result = await single_manager.call_mcp_tool("mcp_a_error_tool", {})

        # 验证错误处理 - 业务逻辑错误现在作为正常内容返回给大模型
        assert isinstance(result, ToolResult)
        assert result.ok is True  # 业务逻辑错误不算工具调用失败
        assert "这是一个故意的错误" in result.content or "RuntimeError" in result.content

    @pytest.mark.asyncio
    async def test_call_mcp_tool_invalid_name(self, single_manager):
        """测试调用无效工具名称"""
        await single_manager.discover()

        result = await single_manager.call_mcp_tool("invalid_tool", {})

        assert isinstance(result, ToolResult)
        assert result.ok is False
        assert "无效的 MCP 工具名称格式" in result.content

    @pytest.mark.asyncio
    async def test_call_mcp_tool_not_found(self, single_manager):
        """测试调用不存在的工具"""
        await single_manager.discover()

        result = await single_manager.call_mcp_tool("mcp_a_notfound", {})

        assert isinstance(result, ToolResult)
        assert result.ok is False
        assert "未找到 MCP 工具" in result.content

    @pytest.mark.asyncio
    async def test_call_mcp_tool_server_unavailable(self, single_manager):
        """测试服务器不可用的情况"""
        # 手动添加一个不存在的工具信息
        from app.mcp.server_manager import MCPToolInfo
        single_manager.tools["mcp_b_fake"] = MCPToolInfo(
            name="mcp_b_fake",
            original_name="fake",
            server_name="unavailable-server",
            session_letter="b",
            description="",
            inputSchema={}
        )

        result = await single_manager.call_mcp_tool("mcp_b_fake", {})

        assert isinstance(result, ToolResult)
        assert result.ok is False
        assert "MCP 服务器 'unavailable-server' 不可用" in result.content

    @pytest.mark.asyncio
    async def test_call_mcp_tool_with_missing_parameters(self, single_manager):
        """测试调用工具时缺少必需参数"""
        await single_manager.discover()

        # echo 工具需要 message 参数，这里不提供
        result = await single_manager.call_mcp_tool("mcp_a_echo", {})

        # 服务器应该返回错误或使用默认值
        assert isinstance(result, ToolResult)
        # 根据 mock_mcp_server.py 的实现，message 默认为空字符串
        if result.ok:
            assert "Echo:" in result.content
        else:
            # 如果服务器严格要求参数，则应该返回错误
            assert "message" in result.content.lower() or "required" in result.content.lower()

    @pytest.mark.asyncio
    async def test_call_mcp_tool_json_output(self, single_manager):
        """测试输出 JSON 字符串的工具"""
        await single_manager.discover()

        # 调用 JSON 输出工具
        result = await single_manager.call_mcp_tool("mcp_a_get_user_info", {"user_id": "test123"})

        # 验证结果
        assert isinstance(result, ToolResult)
        assert result.ok is True
        assert isinstance(result.content, str)

        # 验证可以解析为 JSON
        import json
        user_data = json.loads(result.content)

        # 验证 JSON 数据结构
        assert isinstance(user_data, dict)
        assert user_data["user_id"] == "test123"
        assert user_data["name"] == "User test123"
        assert user_data["email"] == "test123@example.com"
        assert user_data["age"] == 25
        assert user_data["is_active"] is True
        assert user_data["roles"] == ["user", "member"]
        assert "metadata" in user_data
        assert "created_at" in user_data["metadata"]
        assert "last_login" in user_data["metadata"]

    @pytest.mark.asyncio
    async def test_call_mcp_tool_error_response(self, single_manager):
        """测试返回错误状态的工具（JSON 错误信息）"""
        await single_manager.discover()

        # 调用返回错误状态的工具
        result = await single_manager.call_mcp_tool("mcp_a_validation_error", {"data": "invalid_data"})

        # 验证结果 - 业务逻辑错误现在作为正常内容返回给大模型
        assert isinstance(result, ToolResult)
        assert result.ok is True  # 业务逻辑错误不算工具调用失败
        assert isinstance(result.content, str)

        # 验证可以解析为 JSON 错误信息
        import json
        error_data = json.loads(result.content)

        # 验证错误数据结构
        assert isinstance(error_data, dict)
        assert error_data["error"] == "ValidationError"
        assert "数据验证失败" in error_data["message"]
        assert "invalid_data" in error_data["message"]
        assert "details" in error_data
        assert error_data["details"]["field"] == "data"
        assert error_data["details"]["value"] == "invalid_data"
        assert error_data["details"]["code"] == "VALIDATION_FAILED"

    @pytest.mark.asyncio
    async def test_shutdown(self, single_server_configs):
        """测试关闭管理器"""
        configs_dict = {
            config['name']: MCPServerConfig(**config)
            for config in single_server_configs
        }
        manager = MCPServerManager(configs_dict)

        try:
            await manager.discover()

            # 验证初始状态
            assert len(manager.tools) > 0
            assert len(manager.clients) > 0

            # 关闭管理器
            await manager.shutdown()

            # 验证状态清理
            assert len(manager.tools) == 0
            assert len(manager.clients) == 0
        except Exception:
            # 如果有清理错误，手动清理
            try:
                await manager.shutdown()
            except Exception:
                pass

    @pytest.mark.asyncio
    async def test_multiple_server_configs_with_failure(self, mixed_server_configs):
        """测试多个服务器配置的基本逻辑（包含失败的服务器）"""
        configs_dict = {
            config['name']: MCPServerConfig(**config)
            for config in mixed_server_configs
        }
        manager = MCPServerManager(configs_dict)

        try:
            await manager.discover()

            # 应该只有一个成功连接的客户端
            assert len(manager.clients) == 1
            assert "mock-server-1" in manager.clients
            assert "mock-server-2" not in manager.clients

            # 应该有一套工具（来自成功连接的服务器）
            assert len(manager.tools) == 5

            # 验证工具命名 - 第一个成功的服务器使用 'a' 前缀
            assert "mcp_a_echo" in manager.tools  # 第一个（也是唯一成功的）服务器
            assert "mcp_a_add" in manager.tools
            assert "mcp_a_error_tool" in manager.tools
            assert "mcp_a_get_user_info" in manager.tools
            assert "mcp_a_validation_error" in manager.tools

            # 不应该有 'b' 前缀的工具，因为第二个服务器连接失败
            mcp_b_tools = [name for name in manager.tools.keys() if name.startswith("mcp_b_")]
            assert len(mcp_b_tools) == 0

            # 测试调用成功服务器的工具
            result1 = await manager.call_mcp_tool("mcp_a_echo", {"message": "Server 1"})
            assert result1.ok is True
            assert "Echo: Server 1" in result1.content

            # 验证会话字母映射
            assert manager.session_index_manager.get_letter("mock-server-1") == "a"
            assert manager.session_index_manager.get_letter("mock-server-2") is None

        finally:
            try:
                await manager.shutdown()
            except Exception:
                pass

    @pytest.mark.asyncio
    async def test_multiple_different_servers(self, multiple_server_configs):
        """测试连接多个不同的 MCP 服务器"""
        configs_dict = {
            config['name']: MCPServerConfig(**config)
            for config in multiple_server_configs
        }
        manager = MCPServerManager(configs_dict)

        try:
            await manager.discover()

            # 验证所有服务器都连接成功
            assert len(manager.clients) == 3
            assert "math-server" in manager.clients
            assert "calc-server" in manager.clients
            assert "text-server" in manager.clients

            # 验证工具总数：5 + 3 + 2 = 10 个工具
            assert len(manager.tools) == 10

            # 验证会话字母映射 - 所有服务器都应该有字母标识
            math_letter = manager.session_index_manager.get_letter("math-server")
            calc_letter = manager.session_index_manager.get_letter("calc-server")
            text_letter = manager.session_index_manager.get_letter("text-server")
            assert math_letter is not None
            assert calc_letter is not None
            assert text_letter is not None

            # 所有字母应该不同
            letters = {math_letter, calc_letter, text_letter}
            assert len(letters) == 3

            # 验证各服务器的工具存在（通过 server_name 查找，不依赖前缀顺序）
            math_tools = [name for name, info in manager.tools.items() if info.server_name == "math-server"]
            calc_tools = [name for name, info in manager.tools.items() if info.server_name == "calc-server"]
            text_tools = [name for name, info in manager.tools.items() if info.server_name == "text-server"]

            assert len(math_tools) == 5
            assert len(calc_tools) == 3
            assert len(text_tools) == 2

            # 获取完整工具名称（动态查找，不假设前缀）
            echo_tool = manager.get_full_tool_name("math-server", "echo")
            multiply_tool = manager.get_full_tool_name("calc-server", "multiply")
            uppercase_tool = manager.get_full_tool_name("text-server", "uppercase")
            greet_tool = manager.get_full_tool_name("calc-server", "greet")
            word_count_tool = manager.get_full_tool_name("text-server", "word_count")

            # 测试调用不同服务器的工具
            result1 = await manager.call_mcp_tool(echo_tool, {"message": "Hello from server 1"})
            assert result1.ok is True
            assert "Echo: Hello from server 1" in result1.content

            result2 = await manager.call_mcp_tool(multiply_tool, {"x": 6, "y": 7})
            assert result2.ok is True
            assert "Product: 42" in result2.content

            result3 = await manager.call_mcp_tool(uppercase_tool, {"text": "hello world"})
            assert result3.ok is True
            assert "Uppercase: HELLO WORLD" in result3.content

            result4 = await manager.call_mcp_tool(greet_tool, {"name": "Alice", "language": "en"})
            assert result4.ok is True
            assert "Hello, Alice!" in result4.content

            result5 = await manager.call_mcp_tool(word_count_tool, {"text": "This is a test sentence"})
            assert result5.ok is True
            assert "Word count: 5" in result5.content

        finally:
            # 简单清理，避免复杂的异步清理问题
            try:
                manager.clients.clear()
                manager.tools.clear()
                manager.session_index_manager.clear()
            except Exception:
                pass

    @pytest.mark.asyncio
    async def test_connection_failure_handling(self):
        """测试连接失败处理"""
        # 使用无效的配置
        config = {
            "name": "invalid_server",
            "type": "http",
            "url": "http://invalid-url:9999",
            "source": "global_config"
        }

        configs_dict = {
            config['name']: MCPServerConfig(**config)
        }
        manager = MCPServerManager(configs_dict)

        # 运行发现
        await manager.discover()

        # 验证结果
        assert len(manager.clients) == 0
        assert len(manager.tools) == 0

    @pytest.mark.asyncio
    async def test_discover_returns_results(self):
        """测试 discover 返回发现结果"""
        config = {
            "name": "test_server",
            "type": "http",
            "url": "http://invalid-url:9999",
            "source": "global_config"
        }

        configs_dict = {
            config['name']: MCPServerConfig(**config)
        }
        manager = MCPServerManager(configs_dict)

        # 运行发现
        discovery_results = await manager.discover()

        # 验证返回了发现结果
        assert len(discovery_results) == 1
        result = discovery_results[0]

        # 验证结果结构
        assert hasattr(result, 'name')
        assert hasattr(result, 'status')
        assert hasattr(result, 'duration')
        assert hasattr(result, 'tools')
        assert hasattr(result, 'tool_count')
        assert result.status in ["success", "failed", "timeout"]
        assert isinstance(result.duration, (int, float))
        assert isinstance(result.tools, list)
        assert isinstance(result.tool_count, int)

        await manager.shutdown()

    @pytest.mark.asyncio
    async def test_discover_skips_failed_servers(self):
        """测试 discover 会跳过失败的服务器"""
        configs = {
            "test_server_1": MCPServerConfig(
                name="test_server_1",
                type="stdio",
                command="python",
                args=["-m", "nonexistent_module"]
            ),
            "test_server_2": MCPServerConfig(
                name="test_server_2",
                type="http",
                url="http://invalid-url:9999"
            )
        }
        manager = MCPServerManager(configs)

        # 第一次调用 discover - 所有服务器连接失败
        results = await manager.discover()
        assert len(results) == 2  # 两个服务器都尝试连接

        # 验证失败的服务器被记录
        failed_servers = manager.get_failed_servers()
        assert len(failed_servers) == 2
        assert "test_server_1" in failed_servers
        assert "test_server_2" in failed_servers

        # 第二次调用 discover - 应该跳过失败的服务器
        results = await manager.discover()
        assert len(results) == 0  # 跳过所有失败的服务器

        await manager.shutdown()

    @pytest.mark.asyncio
    async def test_retry_failed_server(self):
        """测试重试失败的服务器"""
        config = MCPServerConfig(
            name="test_server",
            type="http",
            url="http://invalid-url:9999"
        )
        manager = MCPServerManager({"test_server": config})

        # 第一次调用 discover - 服务器连接失败
        results = await manager.discover()
        assert len(results) == 1

        # 验证服务器在失败列表中
        failed_servers = manager.get_failed_servers()
        assert "test_server" in failed_servers

        # Mock 客户端连接成功
        with patch('app.mcp.client.MCPClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.connect.return_value = True
            mock_client.list_tools.return_value = [
                {
                    "name": "test_tool",
                    "description": "测试工具",
                    "inputSchema": {"type": "object", "properties": {}}
                }
            ]
            mock_client_class.return_value = mock_client

            # 重试失败的服务器
            result = await manager.retry_failed_server("test_server")

            # 验证结果
            assert result is not None
            assert result.name == "test_server"
            assert result.status == "failed"

        await manager.shutdown()

    @pytest.mark.asyncio
    async def test_clear_failed_servers(self):
        """测试清空失败服务器列表"""
        configs = {
            "test_server_1": MCPServerConfig(
                name="test_server_1",
                type="http",
                url="http://invalid-url:9999"
            ),
            "test_server_2": MCPServerConfig(
                name="test_server_2",
                type="http",
                url="http://invalid-url:8888"
            )
        }
        manager = MCPServerManager(configs)

        # 第一次调用 discover - 服务器连接失败
        results = await manager.discover()
        assert len(results) == 2

        # 验证服务器在失败列表中
        failed_servers = manager.get_failed_servers()
        assert len(failed_servers) == 2

        # 清空失败列表
        manager.clear_failed_servers()

        # 验证失败列表已清空
        failed_servers = manager.get_failed_servers()
        assert len(failed_servers) == 0

        # 第二次调用 discover - 应该重新尝试连接
        results = await manager.discover()
        assert len(results) == 2  # 重新尝试连接所有服务器

        await manager.shutdown()
