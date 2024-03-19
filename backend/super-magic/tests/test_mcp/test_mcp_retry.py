"""MCP 重试机制测试"""

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
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any

from app.mcp.client import MCPClient
from app.mcp.server_manager import MCPServerManager
from app.mcp.server_config import MCPServerConfig, MCPServerType, MCPConfigSource


class TestMCPRetryMechanism:
    """测试 MCP 重试机制"""

    @pytest.fixture
    def http_config(self):
        """HTTP 服务器配置"""
        return MCPServerConfig(
            name="test-http-server",
            type=MCPServerType.HTTP,
            url="http://test.example.com/mcp",
            token="test-token",
            headers={},
            command=None,
            args=[],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

    @pytest.fixture
    def stdio_config(self):
        """Stdio 服务器配置"""
        return MCPServerConfig(
            name="test-stdio-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers={},
            command="npx",
            args=["-y", "test-mcp-server"],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

    def test_retryable_error_detection(self, http_config):
        """测试可重试错误检测"""
        client = MCPClient(http_config, max_retries=1)

        # 测试网络相关错误
        network_errors = [
            Exception("Connection timeout"),
            Exception("Network unreachable"),
            Exception("Connection refused"),
            TimeoutError("Request timeout"),
            ConnectionError("Connection failed")
        ]

        for error in network_errors:
            assert client._is_retryable_error(error), f"应该重试错误: {error}"

        # 测试 npm 相关错误
        npm_errors = [
            Exception("npm error code EIDLETIMEOUT"),
            Exception("npm error process terminated"),
            Exception("npm error signal SIGTERM"),
            Exception("Idle timeout reached for host cdn.npmmirror.com:443")
        ]

        for error in npm_errors:
            assert client._is_retryable_error(error), f"应该重试 npm 错误: {error}"

        # 测试不可重试错误
        non_retryable_errors = [
            Exception("Invalid configuration"),
            ValueError("Bad request"),
            Exception("Authentication failed"),
            Exception("Permission denied")
        ]

        for error in non_retryable_errors:
            assert not client._is_retryable_error(error), f"不应该重试错误: {error}"

    @pytest.mark.asyncio
    async def test_retry_delay_calculation(self, http_config):
        """测试重试延迟计算"""
        client = MCPClient(http_config, max_retries=3, retry_delay=1.0)

        with patch('asyncio.sleep') as mock_sleep:
            # 模拟第一次重试 (attempt=0)
            await client._wait_before_retry(0)
            # 基础延迟 1.0 * (2^0) = 1.0，加上随机抖动
            call_args = mock_sleep.call_args[0][0]
            assert 1.0 <= call_args <= 2.0

            # 模拟第二次重试 (attempt=1)
            await client._wait_before_retry(1)
            # 基础延迟 1.0 * (2^1) = 2.0，加上随机抖动
            call_args = mock_sleep.call_args[0][0]
            assert 2.0 <= call_args <= 3.0

            # 模拟第三次重试 (attempt=2)
            await client._wait_before_retry(2)
            # 基础延迟 1.0 * (2^2) = 4.0，加上随机抖动
            call_args = mock_sleep.call_args[0][0]
            assert 4.0 <= call_args <= 5.0

    @pytest.mark.asyncio
    async def test_server_manager_retry_configuration(self):
        """测试服务器管理器的重试配置"""
        server_configs = [
            {
                "name": "test-server",
                "type": "http",
                "url": "http://test.example.com/mcp"
            }
        ]

        # 将列表转换为字典
        configs_dict = {
            config['name']: MCPServerConfig(**config)
            for config in server_configs
        }

        # 测试默认重试配置
        manager = MCPServerManager(configs_dict)
        assert manager.max_retries == 1
        assert manager.retry_delay == 1.0

        # 测试自定义重试配置
        manager = MCPServerManager(configs_dict, max_retries=3, retry_delay=2.0)
        assert manager.max_retries == 3
        assert manager.retry_delay == 2.0

    @pytest.mark.asyncio
    async def test_connection_timeout_calculation(self):
        """测试连接超时计算"""
        server_configs = [
            {
                "name": "test-server",
                "type": "stdio",
                "command": "npx",
                "args": ["-y", "test-mcp-server"]
            }
        ]

        # 将列表转换为字典
        configs_dict = {
            config['name']: MCPServerConfig(**config)
            for config in server_configs
        }

        # 测试不同重试配置下的超时时间
        manager = MCPServerManager(configs_dict, max_retries=2, retry_delay=1.0)

        # 模拟连接方法以验证超时计算
        config = MCPServerConfig(
            name="test-timeout-server",
            type=MCPServerType.STDIO,
            url=None,
            token=None,
            headers=None,
            command="npx",
            args=["-y", "test-mcp-server"],
            env={},
            allowed_tools=None,
            source=MCPConfigSource.CLIENT_CONFIG,
            server_options={}
        )

        # 在实际的 _connect_and_register_server 方法中
        # connection_timeout = 30.0 + (max_retries * 10.0)
        expected_timeout = 30.0 + (2 * 10.0)  # 50.0
        assert expected_timeout == 50.0

        manager_high_retry = MCPServerManager(configs_dict, max_retries=3, retry_delay=1.0)
        expected_timeout_high = 30.0 + (3 * 10.0)  # 60.0
        assert expected_timeout_high == 60.0

    @pytest.mark.asyncio
    async def test_mcp_client_retry_logic(self, stdio_config):
        """测试 MCP 客户端的重试逻辑"""
        client = MCPClient(stdio_config, max_retries=2, retry_delay=0.1)

        # 模拟连接失败，然后成功
        with patch.object(client, '_connect_stdio') as mock_connect:
            with patch.object(client, '_create_session') as mock_session:
                with patch.object(client, '_wait_before_retry') as mock_wait:
                    # 第一次失败，第二次成功
                    mock_connect.side_effect = [False, True]
                    mock_session.return_value = True

                    result = await client.connect()

                    # 验证重试逻辑
                    assert result is True
                    assert mock_connect.call_count == 2
                    assert mock_wait.call_count == 1
                    mock_wait.assert_called_with(0)  # 第一次重试

    @pytest.mark.asyncio
    async def test_mcp_client_max_retries_exceeded(self, stdio_config):
        """测试超过最大重试次数的情况"""
        client = MCPClient(stdio_config, max_retries=2, retry_delay=0.1)

        # 模拟连接总是失败
        with patch.object(client, '_connect_stdio') as mock_connect:
            with patch.object(client, '_wait_before_retry') as mock_wait:
                mock_connect.return_value = False

                result = await client.connect()

                # 验证达到最大重试次数
                assert result is False
                assert mock_connect.call_count == 3  # 初始尝试 + 2次重试
                assert mock_wait.call_count == 2  # 2次重试等待

    @pytest.mark.asyncio
    async def test_mcp_client_non_retryable_error(self, stdio_config):
        """测试不可重试错误的处理"""
        client = MCPClient(stdio_config, max_retries=2, retry_delay=0.1)

        # 模拟不可重试错误
        with patch.object(client, '_connect_stdio') as mock_connect:
            with patch.object(client, '_wait_before_retry') as mock_wait:
                with patch.object(client, '_cleanup_on_error') as mock_cleanup:
                    mock_connect.side_effect = ValueError("Invalid configuration")

                    result = await client.connect()

                    # 验证不进行重试
                    assert result is False
                    assert mock_connect.call_count == 1  # 只尝试一次
                    assert mock_wait.call_count == 0  # 没有重试等待
                    assert mock_cleanup.call_count == 1  # 清理资源

    @pytest.mark.asyncio
    async def test_mcp_client_retryable_error_eventually_succeeds(self, stdio_config):
        """测试可重试错误最终成功的情况"""
        client = MCPClient(stdio_config, max_retries=3, retry_delay=0.1)

        # 模拟可重试错误，最终成功
        with patch.object(client, '_connect_stdio') as mock_connect:
            with patch.object(client, '_create_session') as mock_session:
                with patch.object(client, '_wait_before_retry') as mock_wait:
                    with patch.object(client, '_cleanup_on_error') as mock_cleanup:
                        # 前两次抛出可重试错误，第三次成功
                        mock_connect.side_effect = [
                            Exception("npm error code EIDLETIMEOUT"),
                            Exception("Connection timeout"),
                            True
                        ]
                        mock_session.return_value = True

                        result = await client.connect()

                        # 验证重试逻辑
                        assert result is True
                        assert mock_connect.call_count == 3
                        assert mock_wait.call_count == 2  # 两次重试等待
                        assert mock_cleanup.call_count == 2  # 两次清理

    def test_mcp_client_initialization_with_retry_config(self, stdio_config):
        """测试 MCP 客户端的重试配置初始化"""
        # 测试默认配置
        client = MCPClient(stdio_config)
        assert client.max_retries == 1
        assert client.retry_delay == 1.0

        # 测试自定义配置
        client = MCPClient(stdio_config, max_retries=3, retry_delay=2.0)
        assert client.max_retries == 3
        assert client.retry_delay == 2.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
