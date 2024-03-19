"""全局 MCP 管理器单元测试

测试 app.mcp.manager 模块的核心功能，包括：
- 全局配置读取
- enabled 参数支持
- 配置合并逻辑
- 初始化和清理
"""

import pytest
import json
import tempfile
import shutil
from unittest.mock import patch, AsyncMock, MagicMock

from app.mcp import manager
from app.mcp.manager import (
    initialize_global_mcp_manager,
    get_global_mcp_manager,
    shutdown_global_mcp_manager,
    _load_global_mcp_config,
    _merge_mcp_configurations
)
from app.paths import PathManager
from pathlib import Path


class TestMCPManager:
    """测试全局 MCP 管理器"""

    @pytest.fixture
    def sample_mcp_config(self):
        """示例 MCP 配置数据"""
        return {
            "mcpServers": {
                "test-server-1": {
                    "enabled": True,
                    "type": "stdio",
                    "command": "python",
                    "args": ["-m", "test_server"]
                },
                "test-server-2": {
                    "enabled": False,
                    "url": "https://example.com/mcp"
                },
                "test-server-3": {
                    "enabled": True,
                    "url": "https://api.example.com/mcp",
                    "token": "test-token"
                }
            }
        }

    @pytest.fixture
    def temp_config_dir(self, sample_mcp_config):
        """创建临时配置目录和文件"""
        temp_dir = tempfile.mkdtemp()
        config_dir = Path(temp_dir) / "config"
        config_dir.mkdir()

        # 创建 mcp.json 文件
        mcp_config_file = config_dir / "mcp.json"
        with open(mcp_config_file, 'w', encoding='utf-8') as f:
            json.dump(sample_mcp_config, f, ensure_ascii=False, indent=2)

        yield temp_dir

        # 清理
        shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.fixture
    def sample_server_configs(self):
        """示例服务器配置列表"""
        return [
            {
                "name": "param-server-1",
                "type": "stdio",
                "command": "python",
                "args": ["-m", "param_server"]
            },
            {
                "name": "param-server-2",
                "type": "http",
                "url": "https://param.example.com/mcp"
            }
        ]

    def setup_method(self):
        """每个测试方法前的设置"""
        # 重置全局状态
        manager._global_manager = None

    async def teardown_method(self):
        """每个测试方法后的清理"""
        # 确保全局管理器被清理
        await shutdown_global_mcp_manager()

    @pytest.mark.asyncio
    async def test_load_global_mcp_config_success(self, temp_config_dir):
        """测试成功加载全局 MCP 配置"""
        with patch.object(PathManager, 'get_project_root', return_value=Path(temp_config_dir)):
            servers = await _load_global_mcp_config()

            # 验证只加载了 enabled=True 的服务器
            assert len(servers) == 2  # test-server-1 和 test-server-3

            # 验证服务器配置
            server_names = [s["name"] for s in servers]
            assert "test-server-1" in server_names
            assert "test-server-3" in server_names
            assert "test-server-2" not in server_names  # enabled=False 应该被跳过

            # 验证类型转换
            server_1 = next(s for s in servers if s["name"] == "test-server-1")
            assert server_1["type"] == "stdio"
            assert "enabled" not in server_1  # enabled 字段应该被移除

            server_3 = next(s for s in servers if s["name"] == "test-server-3")
            assert server_3["type"] == "http"  # URL 类型应该转换为 http
            assert "enabled" not in server_3

    @pytest.mark.asyncio
    async def test_load_global_mcp_config_file_not_exists(self):
        """测试配置文件不存在的情况"""
        with patch.object(PathManager, 'get_project_root', return_value=Path("/non/existent/path")):
            servers = await _load_global_mcp_config()
            assert servers == []

    @pytest.mark.asyncio
    async def test_load_global_mcp_config_invalid_format(self, temp_config_dir):
        """测试无效配置格式"""
        # 创建无效的配置文件
        config_dir = Path(temp_config_dir) / "config"
        mcp_config_file = config_dir / "mcp.json"
        with open(mcp_config_file, 'w', encoding='utf-8') as f:
            json.dump({"invalid": "format"}, f)

        with patch.object(PathManager, 'get_project_root', return_value=Path(temp_config_dir)):
            servers = await _load_global_mcp_config()
            assert servers == []

    def test_merge_mcp_configurations(self):
        """测试 MCP 配置合并逻辑"""
        existing_servers = [
            {"name": "existing-1", "type": "stdio", "command": "old-cmd"},
            {"name": "existing-2", "type": "http", "url": "old-url"}
        ]

        new_servers = [
            {"name": "existing-1", "type": "stdio", "command": "new-cmd"},  # 覆盖现有
            {"name": "new-1", "type": "http", "url": "new-url"}  # 新增
        ]

        merged = _merge_mcp_configurations(new_servers, existing_servers)

        # 验证合并结果
        assert len(merged) == 3

        # 验证新配置覆盖现有配置
        existing_1 = next(s for s in merged if s["name"] == "existing-1")
        assert existing_1["command"] == "new-cmd"  # 应该是新值

        # 验证保留的现有配置
        existing_2 = next(s for s in merged if s["name"] == "existing-2")
        assert existing_2["url"] == "old-url"

        # 验证新增配置
        new_1 = next(s for s in merged if s["name"] == "new-1")
        assert new_1["url"] == "new-url"

    @pytest.mark.asyncio
    async def test_initialize_global_mcp_manager_with_config_file(self, temp_config_dir):
        """测试使用配置文件初始化全局管理器"""
        with patch.object(PathManager, 'get_project_root', return_value=Path(temp_config_dir)):
            with patch.object(PathManager, 'get_chat_history_dir', return_value=Path(temp_config_dir) / ".chat_history"):
                # Mock MCPServerManager 以避免真实连接
                with patch('app.mcp.manager.MCPServerManager') as mock_manager_class:
                    mock_instance = AsyncMock()
                    mock_instance.discover = AsyncMock(return_value=[])
                    mock_instance.tools = {"mcp_test_tool": {"name": "test_tool"}}
                    mock_instance.session_letters = {"test-server": "a"}
                    mock_instance.server_configs = {}
                    mock_instance.clients = {}
                    mock_manager_class.return_value = mock_instance

                    # 初始化管理器
                    await initialize_global_mcp_manager()

                    # 验证全局管理器被设置
                    global_manager = get_global_mcp_manager()
                    assert global_manager is not None

                    # 验证 discover 被调用
                    mock_instance.discover.assert_called_once()

    @pytest.mark.asyncio
    async def test_initialize_global_mcp_manager_with_parameters(self, sample_server_configs):
        """测试使用参数初始化全局管理器"""
        with patch.object(PathManager, 'get_chat_history_dir', return_value=Path("/tmp/.chat_history")):
            with patch('app.mcp.manager.MCPServerManager') as mock_manager_class:
                mock_instance = AsyncMock()
                mock_instance.discover = AsyncMock(return_value=[])
                mock_instance.tools = {}
                mock_instance.session_letters = {}
                mock_instance.server_configs = {}
                mock_instance.clients = {}
                mock_manager_class.return_value = mock_instance

                # 使用参数初始化
                await initialize_global_mcp_manager(sample_server_configs)

                # 验证管理器被创建时传入了正确的配置
                mock_manager_class.assert_called_once()
                # 第一个参数是字典: {server_name: MCPServerConfig}
                call_args = mock_manager_class.call_args[0][0]

                # 验证传入的配置包含参数配置（从字典键获取服务器名称）
                server_names = list(call_args.keys())
                assert "param-server-1" in server_names
                assert "param-server-2" in server_names

    @pytest.mark.asyncio
    async def test_initialize_global_mcp_manager_merge_configs(self, temp_config_dir, sample_server_configs):
        """测试配置文件和参数配置的合并"""
        with patch.object(PathManager, 'get_project_root', return_value=Path(temp_config_dir)):
            with patch.object(PathManager, 'get_chat_history_dir', return_value=Path(temp_config_dir) / ".chat_history"):
                with patch('app.mcp.manager.MCPServerManager') as mock_manager_class:
                    mock_instance = AsyncMock()
                    mock_instance.discover = AsyncMock(return_value=[])
                    mock_instance.tools = {}
                    mock_instance.session_letters = {}
                    mock_instance.server_configs = {}
                    mock_instance.clients = {}
                    mock_manager_class.return_value = mock_instance

                    # 使用参数和配置文件初始化
                    await initialize_global_mcp_manager(sample_server_configs)

                    # 验证配置被合并
                    # 第一个参数是字典: {server_name: MCPServerConfig}
                    call_args = mock_manager_class.call_args[0][0]
                    server_names = list(call_args.keys())

                    # 应该包含配置文件中 enabled=True 的服务器
                    assert "test-server-1" in server_names
                    assert "test-server-3" in server_names
                    assert "test-server-2" not in server_names  # enabled=False

                    # 应该包含参数中的服务器
                    assert "param-server-1" in server_names
                    assert "param-server-2" in server_names

    @pytest.mark.asyncio
    async def test_initialize_global_mcp_manager_no_config(self):
        """测试无配置时的初始化"""
        with patch.object(PathManager, 'get_project_root', return_value=Path("/non/existent")):
            with patch.object(PathManager, 'get_chat_history_dir', return_value=Path("/tmp/.chat_history")):
                # 无配置时不应该抛异常
                await initialize_global_mcp_manager()

                # 全局管理器应该为 None
                assert get_global_mcp_manager() is None

    @pytest.mark.asyncio
    async def test_shutdown_global_mcp_manager(self):
        """测试关闭全局管理器"""
        # 设置一个模拟的全局管理器
        mock_manager = AsyncMock()
        mock_manager.shutdown = AsyncMock()
        manager._global_manager = mock_manager

        await shutdown_global_mcp_manager()

        # 验证 shutdown 被调用
        mock_manager.shutdown.assert_called_once()

        # 验证全局状态被重置
        assert manager._global_manager is None
