"""MCPServerConfig 配置类单元测试"""
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

import os
import pytest
from typing import Dict, Any

from app.mcp.server_config import MCPServerConfig, MCPServerType, MCPConfigSource


class TestMCPServerConfig:
    """MCPServerConfig 测试类"""

    def test_http_server_config_validation_success(self):
        """测试 HTTP 服务器配置验证成功"""
        config = MCPServerConfig(
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

        # 验证应该成功
        config.validate_config()

        # 检查基本属性
        assert config.name == "test-http-server"
        assert config.type == MCPServerType.HTTP
        assert config.url == "https://api.example.com/mcp"
        assert config.token == "test-token"

    def test_http_server_config_without_token(self):
        """测试 HTTP 服务器配置不带认证令牌"""
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

        config.validate_config()
        assert config.token is None

    def test_http_server_config_validation_fail_no_url(self):
        """测试 HTTP 服务器配置验证失败 - 缺少 URL"""
        config = MCPServerConfig(
            name="test-http-server",
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

        with pytest.raises(ValueError, match="HTTP MCP 服务器 'test-http-server' 需要提供 URL"):
            config.validate_config()

    def test_stdio_server_config_validation_success(self):
        """测试 Stdio 服务器配置验证成功"""
        config = MCPServerConfig(
            name="test-stdio-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=None,
            command="npx",
            args=["-y", "@executeautomation/playwright-mcp-server"],
            env={"HEADLESS": "true"},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

        config.validate_config()

        assert config.name == "test-stdio-server"
        assert config.type == MCPServerType.STDIO
        assert config.command == "npx"
        assert config.args == ["-y", "@executeautomation/playwright-mcp-server"]
        assert config.env == {"HEADLESS": "true"}

    def test_stdio_server_config_validation_fail_no_command(self):
        """测试 Stdio 服务器配置验证失败 - 缺少命令"""
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

        with pytest.raises(ValueError, match="Stdio MCP 服务器 'test-stdio-server' 需要提供启动命令"):
            config.validate_config()

    def test_stdio_server_config_validation_fail_no_args(self):
        """测试 Stdio 服务器配置验证失败 - 缺少参数"""
        config = MCPServerConfig(
            name="test-stdio-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=None,
            command="python",
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

        with pytest.raises(ValueError, match="Stdio MCP 服务器 'test-stdio-server' 需要提供命令参数"):
            config.validate_config()

    def test_expand_env_vars_basic(self):
        """测试基本环境变量扩展功能"""
        # 设置测试环境变量
        os.environ["TEST_API_KEY"] = "secret-key-123"

        try:
            config = MCPServerConfig(
            name="test-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=None,
            command="python",
            args=["server.py"],
            env={"API_KEY": "${TEST_API_KEY}", "DEBUG": "true"},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

            assert config.env["API_KEY"] == "secret-key-123"
            assert config.env["DEBUG"] == "true"
        finally:
            # 清理环境变量
            os.environ.pop("TEST_API_KEY", None)

    def test_expand_env_vars_missing_var(self):
        """测试环境变量扩展 - 变量不存在"""
        config = MCPServerConfig(
            name="test-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=None,
            command="python",
            args=["server.py"],
            env={"API_KEY": "${MISSING_VAR}"},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

        # 如果环境变量不存在，应该保持原值
        assert config.env["API_KEY"] == "${MISSING_VAR}"

    def test_expand_env_vars_mixed(self):
        """测试环境变量扩展 - 混合情况"""
        os.environ["TEST_TOKEN"] = "token-456"

        try:
            config = MCPServerConfig(
            name="test-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=None,
            command="python",
            args=["server.py"],
            env={
                "TOKEN": "${TEST_TOKEN}",
                "STATIC_VAR": "static-value",
                "MISSING": "${MISSING_VAR}"
            },
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

            assert config.env["TOKEN"] == "token-456"
            assert config.env["STATIC_VAR"] == "static-value"
            assert config.env["MISSING"] == "${MISSING_VAR}"
        finally:
            os.environ.pop("TEST_TOKEN", None)

    def test_get_http_connect_config(self):
        """测试 HTTP 连接配置生成"""
        config = MCPServerConfig(
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

        connect_config = config.get_connect_config()

        expected = {
            "base_url": "https://api.example.com/mcp",
        }
        assert connect_config == expected

    def test_get_http_connect_config_no_token(self):
        """测试 HTTP 连接配置生成 - 无认证令牌"""
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

        connect_config = config.get_connect_config()

        expected = {"base_url": "https://api.example.com/mcp"}
        assert connect_config == expected

    def test_get_stdio_connect_config(self):
        """测试 Stdio 连接配置生成"""
        config = MCPServerConfig(
            name="test-stdio-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=None,
            command="python",
            args=["server.py"],
            env={"DEBUG": "true"},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

        connect_config = config.get_connect_config()

        expected = {
            "command": "python",
            "args": ["server.py"],
            "env": {"DEBUG": "true"}
        }
        assert connect_config == expected

    def test_allowed_tools_filtering(self):
        """测试工具过滤配置"""
        config = MCPServerConfig(
            name="test-server",
            type=MCPServerType.HTTP,
            url="https://api.example.com/mcp",
            token=None,
            headers=None,
            command=None,
            args=[],
            env={},
            allowed_tools=["tool1", "tool2"],
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

        assert config.allowed_tools == ["tool1", "tool2"]

    def test_allowed_tools_none(self):
        """测试工具过滤配置 - 允许所有工具"""
        config = MCPServerConfig(
            name="test-server",
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

        assert config.allowed_tools is None

    def test_config_str_representation_http(self):
        """测试 HTTP 配置的字符串表示"""
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

        expected = "MCPServer(name='test-http-server', type=HTTP, url='https://api.example.com/mcp')"
        assert str(config) == expected

    def test_config_str_representation_stdio(self):
        """测试 Stdio 服务器配置字符串表示"""
        config = MCPServerConfig(
            name="test-stdio-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=None,
            command="python",
            args=["server.py"],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

        expected = "MCPServer(name='test-stdio-server', type=Stdio, command='python')"
        assert str(config) == expected

    def test_http_server_config_with_headers(self):
        """测试 HTTP 服务器配置带自定义头部"""
        headers = {
            "X-API-Key": "test-api-key",
            "X-Custom-Header": "custom-value",
            "User-Agent": "test-agent"
        }

        config = MCPServerConfig(
            name="test-http-server",
            type=MCPServerType.HTTP,
            url="https://api.example.com/mcp",
            token=None,
            headers=headers,
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

        config.validate_config()

        assert config.headers == headers
        assert config.headers["X-API-Key"] == "test-api-key"
        assert config.headers["X-Custom-Header"] == "custom-value"
        assert config.headers["User-Agent"] == "test-agent"

    def test_http_server_config_with_headers_and_token(self):
        """测试 HTTP 服务器配置同时带自定义头部和令牌"""
        headers = {
            "X-API-Key": "test-api-key",
            "Authorization": "Bearer old-token"  # 应该被 token 字段覆盖
        }

        config = MCPServerConfig(
            name="test-http-server",
            type=MCPServerType.HTTP,
            url="https://api.example.com/mcp",
            token="new-token",
            headers=headers,
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

        config.validate_config()

        assert config.headers == headers
        assert config.token == "new-token"
        assert config.headers["Authorization"] == "Bearer old-token"  # 配置中的值
        assert config.headers["X-API-Key"] == "test-api-key"

    def test_http_server_config_with_empty_headers(self):
        """测试 HTTP 服务器配置带空的头部字典"""
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

        config.validate_config()

        assert config.headers == {}

    def test_http_server_config_without_headers(self):
        """测试 HTTP 服务器配置不带头部字段"""
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

        config.validate_config()

        assert config.headers is None

    def test_stdio_server_config_with_headers_ignored(self):
        """测试 Stdio 服务器配置带头部（应该被忽略）"""
        headers = {
            "X-API-Key": "test-api-key"
        }

        config = MCPServerConfig(
            name="test-stdio-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=headers,
            command="python",
            args=["server.py"],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

        config.validate_config()

        # headers 字段应该存在但不影响 stdio 配置
        assert config.headers == headers
        assert config.type == MCPServerType.STDIO
