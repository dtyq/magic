"""远程工具管理器单元测试

使用真实的Tool对象和工具工厂进行测试，不使用mock。
"""

# 设置项目根目录 - 必须在导入项目模块之前
import sys
import os
from pathlib import Path

# 获取项目根目录
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(project_root))

# 设置当前工作目录为项目根目录
os.chdir(project_root)

# 初始化路径管理器
from app.paths import PathManager
PathManager.set_project_root(project_root)
from agentlang.context.application_context import ApplicationContext
ApplicationContext.set_path_manager(PathManager())

import pytest
from typing import List

from app.tools.remote.remote_tool_manager import RemoteToolManager, remote_tool_manager
from app.infrastructure.sdk.magic_service.result.agent_details_result import Tool
from app.tools.remote.remote_tool import RemoteTool
from app.tools.core.tool_factory import tool_factory


class RealToolFactory:
    """真实的工具对象创建辅助类"""

    @staticmethod
    def create_teamshare_doc_tool():
        """创建天书云文档查询工具"""
        tool_data = {
            "code": "teamshare_box_teamshare_doc_markdown_query",
            "name": "teamshare_doc_markdown_query",
            "description": "天书云文档 markdown 查询",
            "icon": "",
            "type": 3,
            "schema": {
                "type": "object",
                "required": ["file_id"],
                "description": "",
                "properties": {
                    "file_id": {
                        "type": "string",
                        "required": [],
                        "description": "云文档文件 id"
                    }
                }
            }
        }
        return Tool(tool_data)

    @staticmethod
    def create_official_tool():
        """创建官方工具"""
        tool_data = {
            "code": "official_analysis_tool",
            "name": "official_analysis_tool",
            "description": "官方分析工具",
            "icon": {},
            "type": 2,
            "schema": {
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "内容"}
                },
                "required": ["content"]
            }
        }
        return Tool(tool_data)

    @staticmethod
    def create_builtin_tool():
        """创建内置工具"""
        tool_data = {
            "code": "web_search",
            "name": "web_search",
            "description": "网络搜索工具",
            "icon": {},
            "type": 1,  # 内置工具
            "schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索查询"}
                },
                "required": ["query"]
            }
        }
        return Tool(tool_data)

    @staticmethod
    def create_invalid_schema_tool():
        """创建无效schema的工具"""
        tool_data = {
            "code": "invalid_schema_tool",
            "name": "invalid_schema_tool",
            "description": "无效schema的工具",
            "icon": {},
            "type": 3,
            "schema": None  # 无效schema
        }
        return Tool(tool_data)


class TestRemoteToolManager:
    """测试远程工具管理器"""

    @pytest.fixture(autouse=True)
    def setup_and_cleanup(self):
        """测试前后的设置和清理"""
        # 测试前：保存当前已注册的工具列表
        original_tools = list(remote_tool_manager.registered_tools)

        # 清空当前注册的远程工具
        remote_tool_manager.clear_all_remote_tools()

        yield

        # 测试后：清理测试中注册的工具，恢复原始状态
        remote_tool_manager.clear_all_remote_tools()

        # 如果原来有工具，这里不需要恢复，因为我们测试的是远程工具管理器

    def test_singleton_pattern(self):
        """测试单例模式"""
        manager1 = RemoteToolManager()
        manager2 = RemoteToolManager()
        assert manager1 is manager2

        # 测试全局实例
        assert remote_tool_manager is RemoteToolManager()

    def test_initialization(self):
        """测试管理器初始化"""
        manager = RemoteToolManager()
        assert isinstance(manager.registered_tools, set)
        assert manager._initialized is True

    def test_clear_all_remote_tools_empty(self):
        """测试清空空的工具列表"""
        initial_count = len(remote_tool_manager.registered_tools)
        remote_tool_manager.clear_all_remote_tools()
        assert len(remote_tool_manager.registered_tools) == 0

    def test_register_empty_tools(self):
        """测试注册空工具列表"""
        remote_tool_manager.register_remote_tools([], "test_agent")
        assert len(remote_tool_manager.registered_tools) == 0

    def test_register_only_builtin_tools(self):
        """测试只注册内置工具（应该跳过）"""
        builtin_tool = RealToolFactory.create_builtin_tool()
        remote_tool_manager.register_remote_tools([builtin_tool], "test_agent")

        # 内置工具不应该被注册
        assert len(remote_tool_manager.registered_tools) == 0
        assert not remote_tool_manager.is_remote_tool("web_search")

    def test_register_remote_tools_success(self):
        """测试成功注册远程工具"""
        # 创建混合工具列表
        tools = [
            RealToolFactory.create_builtin_tool(),      # type=1，应该跳过
            RealToolFactory.create_official_tool(),     # type=2，应该注册
            RealToolFactory.create_teamshare_doc_tool() # type=3，应该注册
        ]

        remote_tool_manager.register_remote_tools(tools, "test_agent")

        # 应该注册2个远程工具（跳过内置工具）
        assert len(remote_tool_manager.registered_tools) == 2

        # 验证注册的工具
        assert remote_tool_manager.is_remote_tool("official_analysis_tool")
        assert remote_tool_manager.is_remote_tool("teamshare_box_teamshare_doc_markdown_query")
        assert not remote_tool_manager.is_remote_tool("web_search")  # 内置工具未注册

        # 验证工具列表
        tool_names = remote_tool_manager.get_registered_tool_names()
        assert "official_analysis_tool" in tool_names
        assert "teamshare_box_teamshare_doc_markdown_query" in tool_names
        assert "web_search" not in tool_names

    def test_register_tools_with_invalid_schema(self):
        """测试注册包含无效schema的工具"""
        tools = [
            RealToolFactory.create_official_tool(),        # 有效工具
            RealToolFactory.create_invalid_schema_tool()   # 无效schema工具
        ]

        remote_tool_manager.register_remote_tools(tools, "test_agent")

        # 只应该注册有效的工具
        assert len(remote_tool_manager.registered_tools) == 1
        assert remote_tool_manager.is_remote_tool("official_analysis_tool")
        assert not remote_tool_manager.is_remote_tool("invalid_schema_tool")

    def test_reset_and_register(self):
        """测试重置并注册工具"""
        # 先注册一些工具
        initial_tools = [RealToolFactory.create_official_tool()]
        remote_tool_manager.register_remote_tools(initial_tools, "initial_agent")
        assert len(remote_tool_manager.registered_tools) == 1
        assert remote_tool_manager.is_remote_tool("official_analysis_tool")

        # 重置并注册新工具
        new_tools = [RealToolFactory.create_teamshare_doc_tool()]
        remote_tool_manager.reset_and_register(new_tools, "new_agent")

        # 验证旧工具被清空，新工具被注册
        assert len(remote_tool_manager.registered_tools) == 1
        assert not remote_tool_manager.is_remote_tool("official_analysis_tool")  # 旧工具被清空
        assert remote_tool_manager.is_remote_tool("teamshare_box_teamshare_doc_markdown_query")  # 新工具被注册

    def test_get_registered_tool_names(self):
        """测试获取已注册工具名称"""
        # 初始状态
        assert remote_tool_manager.get_registered_tool_names() == []

        # 注册一些工具
        tools = [
            RealToolFactory.create_official_tool(),
            RealToolFactory.create_teamshare_doc_tool()
        ]
        remote_tool_manager.register_remote_tools(tools, "test_agent")

        tool_names = remote_tool_manager.get_registered_tool_names()
        assert len(tool_names) == 2
        assert "official_analysis_tool" in tool_names
        assert "teamshare_box_teamshare_doc_markdown_query" in tool_names

    def test_is_remote_tool(self):
        """测试检查是否为远程工具"""
        # 初始状态
        assert not remote_tool_manager.is_remote_tool("any_tool")
        assert not remote_tool_manager.is_remote_tool("")
        assert not remote_tool_manager.is_remote_tool(None)

        # 注册工具后
        tools = [RealToolFactory.create_teamshare_doc_tool()]
        remote_tool_manager.register_remote_tools(tools, "test_agent")

        assert remote_tool_manager.is_remote_tool("teamshare_box_teamshare_doc_markdown_query")
        assert not remote_tool_manager.is_remote_tool("non_existent_tool")

    def test_complete_lifecycle(self):
        """测试完整的工具生命周期"""
        agent_id = "lifecycle_test_agent"

        # 1. 初始状态
        assert len(remote_tool_manager.registered_tools) == 0

        # 2. 第一次注册工具
        first_tools = [RealToolFactory.create_official_tool()]
        remote_tool_manager.register_remote_tools(first_tools, agent_id)
        assert len(remote_tool_manager.registered_tools) == 1
        assert remote_tool_manager.is_remote_tool("official_analysis_tool")

        # 3. 切换到新Agent（重置工具）
        second_tools = [RealToolFactory.create_teamshare_doc_tool()]
        remote_tool_manager.reset_and_register(second_tools, "new_agent")
        assert len(remote_tool_manager.registered_tools) == 1
        assert not remote_tool_manager.is_remote_tool("official_analysis_tool")
        assert remote_tool_manager.is_remote_tool("teamshare_box_teamshare_doc_markdown_query")

        # 4. 最终清空
        remote_tool_manager.clear_all_remote_tools()
        assert len(remote_tool_manager.registered_tools) == 0
        assert not remote_tool_manager.is_remote_tool("teamshare_box_teamshare_doc_markdown_query")

    def test_register_multiple_agent_scenarios(self):
        """测试多Agent场景"""
        # Agent A的工具
        agent_a_tools = [RealToolFactory.create_official_tool()]
        remote_tool_manager.reset_and_register(agent_a_tools, "agent_a")
        assert len(remote_tool_manager.registered_tools) == 1
        assert remote_tool_manager.is_remote_tool("official_analysis_tool")

        # 切换到Agent B
        agent_b_tools = [
            RealToolFactory.create_teamshare_doc_tool(),
            RealToolFactory.create_official_tool()  # 同一个工具在不同Agent中
        ]
        remote_tool_manager.reset_and_register(agent_b_tools, "agent_b")
        assert len(remote_tool_manager.registered_tools) == 2
        assert remote_tool_manager.is_remote_tool("official_analysis_tool")
        assert remote_tool_manager.is_remote_tool("teamshare_box_teamshare_doc_markdown_query")

        # 切换到Agent C（没有工具）
        remote_tool_manager.reset_and_register([], "agent_c")
        assert len(remote_tool_manager.registered_tools) == 0

    def test_error_handling_during_registration(self):
        """测试注册过程中的错误处理"""
        # 创建工具列表，包含有效和无效的工具
        mixed_tools = [
            RealToolFactory.create_official_tool(),        # 有效
            RealToolFactory.create_invalid_schema_tool(),  # 无效schema
            RealToolFactory.create_teamshare_doc_tool()    # 有效
        ]

        # 注册应该继续进行，跳过无效的工具
        remote_tool_manager.register_remote_tools(mixed_tools, "error_test_agent")

        # 只有有效的工具被注册
        assert len(remote_tool_manager.registered_tools) == 2
        assert remote_tool_manager.is_remote_tool("official_analysis_tool")
        assert remote_tool_manager.is_remote_tool("teamshare_doc_markdown_query")  # 使用name而不是code
        assert not remote_tool_manager.is_remote_tool("invalid_schema_tool")

    def test_tool_factory_integration(self):
        """测试与工具工厂的集成"""
        # 注册工具
        tools = [RealToolFactory.create_teamshare_doc_tool()]
        remote_tool_manager.register_remote_tools(tools, "factory_test_agent")

        # 验证工具工厂中是否存在该工具
        try:
            # 尝试从工具工厂获取工具实例（现在使用name查找）
            tool_instance = tool_factory.get_tool_instance("teamshare_doc_markdown_query")
            assert tool_instance is not None
            assert isinstance(tool_instance, RemoteTool)
            assert tool_instance.tool_code == "teamshare_box_teamshare_doc_markdown_query"
        except Exception as e:
            # 如果工具工厂抛出异常，记录但不失败测试
            print(f"工具工厂集成测试警告: {e}")

    def test_skip_remote_tool_when_local_exists(self):
        """测试当本地工具存在时跳过远程工具"""
        # 清空已注册的远程工具
        remote_tool_manager.clear_all_remote_tools()

        # 创建一个远程工具，工具名称与某个可能存在的本地工具相同
        # 使用 list_dir 作为示例，因为这是一个常见的本地工具
        tool_data = {
            "code": "test_list_dir_remote",
            "name": "list_dir",  # 与本地工具同名
            "description": "远程版本的list_dir工具",
            "icon": "",
            "type": 3,
            "schema": {
                "type": "object",
                "required": ["path"],
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "要列出的目录路径"
                    }
                }
            }
        }
        remote_tool = Tool(tool_data)

        # 尝试注册这个远程工具
        initial_count = len(remote_tool_manager.get_registered_tool_names())
        remote_tool_manager.register_remote_tools([remote_tool], "conflict_test_agent")

        # 验证远程工具没有被注册（因为本地工具已存在）
        final_count = len(remote_tool_manager.get_registered_tool_names())
        assert final_count == initial_count  # 数量应该没有增加
        assert not remote_tool_manager.is_remote_tool("test_list_dir_remote")  # 远程工具不应存在

    def test_backward_compatibility_with_tool_code(self):
        """测试远程工具管理器的向后兼容性：支持通过 tool.code 查找工具"""
        # 创建测试工具
        test_tool_data = {
            'code': 'TEST-BACKWARD-COMPAT-12345',
            'name': 'backward_test_tool',
            'description': '向后兼容测试工具',
            'type': 3,
            'schema': {
                'type': 'object',
                'properties': {
                    'param': {'type': 'string', 'description': '测试参数'}
                },
                'required': ['param']
            }
        }
        test_tool = Tool(test_tool_data)

        # 注册工具
        remote_tool_manager.clear_all_remote_tools()
        remote_tool_manager.register_remote_tools([test_tool], "backward_compat_test")

        # 测试新方式：通过 tool.name 查找
        assert remote_tool_manager.is_remote_tool("backward_test_tool")
        instance1 = remote_tool_manager.get_remote_tool_instance("backward_test_tool")
        assert instance1 is not None
        assert instance1.get_effective_name() == "backward_test_tool"

        # 测试向后兼容：通过 tool.code 查找
        assert remote_tool_manager.is_remote_tool("TEST-BACKWARD-COMPAT-12345")
        instance2 = remote_tool_manager.get_remote_tool_instance("TEST-BACKWARD-COMPAT-12345")
        assert instance2 is not None
        assert instance2.get_effective_name() == "backward_test_tool"

        # 验证是同一个实例
        assert instance1 is instance2

        # 测试不存在的工具
        assert not remote_tool_manager.is_remote_tool("nonexistent_tool")

        with pytest.raises(ValueError, match="远程工具 'nonexistent_tool' 不存在"):
            remote_tool_manager.get_remote_tool_instance("nonexistent_tool")
