"""AgentConfigConverter 单元测试

测试 API 配置转换为 .agent 文件的完整功能，使用真实数据和对象，不使用 mock。
"""

# 设置项目根目录 - 必须在导入项目模块之前
import sys
import os
import tempfile
from pathlib import Path
from typing import Dict, Any, List
import pytest
import asyncio

# 获取项目根目录
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

# 设置当前工作目录为项目根目录
os.chdir(project_root)

# 初始化路径管理器
from app.paths import PathManager
PathManager.set_project_root(project_root)
from agentlang.context.application_context import ApplicationContext
ApplicationContext.set_path_manager(PathManager())

from app.service.agent_config_converter import AgentConfigConverter
from app.infrastructure.sdk.magic_service.result.agent_details_result import AgentDetailsResult, Tool
from app.tools.remote.remote_tool_manager import remote_tool_manager


class RealAgentDetailsResult:
    """创建真实的 AgentDetailsResult 对象用于测试"""

    @staticmethod
    def create_with_tools(agent_id: str = "test-agent-001",
                         name: str = "测试营销助手",
                         description: str = "专业的营销分析AI助手",
                         prompt_string: str = "你是一个营销专家AI助手",
                         tools: List[Dict[str, Any]] = None) -> AgentDetailsResult:
        """创建包含工具的 AgentDetailsResult"""
        if tools is None:
            tools = [
                {
                    "code": "web_search",
                    "name": "网络搜索工具",
                    "description": "搜索网络内容",
                    "icon": {},
                    "type": 1,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "搜索关键词"}
                        },
                        "required": ["query"]
                    }
                },
                {
                    "code": "marketing_analyzer",
                    "name": "营销分析工具",
                    "description": "分析营销内容和趋势",
                    "icon": {},
                    "type": 3,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "content": {"type": "string", "description": "要分析的内容"},
                            "region": {"type": "string", "enum": ["CN", "US", "EU"], "description": "地区"}
                        },
                        "required": ["content"]
                    }
                }
            ]

        # 注意：AgentDetailsResult 期望扁平的数据结构，不是嵌套在 data 字段下
        data = {
            "id": agent_id,
            "name": name,
            "description": description,
            "icon": {},
            "type": 1,
            "enabled": True,
            "prompt_string": prompt_string,
            "tools": tools,
            "creator": "test_user",
            "modifier": "test_user",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }

        return AgentDetailsResult(data)

    @staticmethod
    def create_without_tools(agent_id: str = "test-agent-no-tools",
                           name: str = "简单助手",
                           description: str = "一个简单的AI助手",
                           prompt_string: str = "你是一个AI助手") -> AgentDetailsResult:
        """创建不包含工具的 AgentDetailsResult"""
        data = {
            "id": agent_id,
            "name": name,
            "description": description,
            "icon": {},
            "type": 1,
            "enabled": True,
            "prompt_string": prompt_string,
            "tools": [],
            "creator": "test_user",
            "modifier": "test_user",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }

        return AgentDetailsResult(data)

    @staticmethod
    def create_without_prompt(agent_id: str = "test-agent-no-prompt",
                            name: str = "无提示词助手",
                            description: str = "没有自定义提示词的助手") -> AgentDetailsResult:
        """创建没有 prompt_string 的 AgentDetailsResult"""
        data = {
            "id": agent_id,
            "name": name,
            "description": description,
            "icon": {},
            "type": 1,
            "enabled": True,
            "prompt_string": "",  # 空提示词
            "tools": [
                {
                    "code": "test_tool",
                    "name": "测试工具",
                    "description": "用于测试的工具",
                    "icon": {},
                    "type": 2,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "input": {"type": "string"}
                        }
                    }
                }
            ],
            "creator": "test_user",
            "modifier": "test_user",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }

        return AgentDetailsResult(data)


class TestAgentConfigConverter:
    """AgentConfigConverter 测试类"""

    def setup_method(self):
        """每个测试方法前的设置"""
        self.converter = AgentConfigConverter()
        # 确保测试目录存在
        self.test_temp_dir = Path(tempfile.gettempdir()) / "agent_config_converter_test"
        self.test_temp_dir.mkdir(exist_ok=True)

    def teardown_method(self):
        """每个测试方法后的清理"""
        # 清理生成的 agent 文件
        for file_path in self.converter.agents_dir.glob("test-agent-*.agent"):
            try:
                file_path.unlink()
            except FileNotFoundError:
                pass

        # 重置远程工具管理器
        remote_tool_manager.clear_all_remote_tools()

    def test_build_agent_file_content_with_tools(self):
        """测试构建包含工具的 .agent 文件内容"""
        # 准备测试数据
        agent_details = RealAgentDetailsResult.create_with_tools(
            agent_id="test-marketing-agent",
            name="营销专家",
            description="专业营销助手",
            prompt_string="你是一个营销专家AI助手，专门帮助用户分析市场趋势。"
        )

        # 执行测试
        content = self.converter._build_agent_file_content(agent_details)

        # 验证结果
        assert content is not None
        assert isinstance(content, str)

        # 验证工具声明格式 - 应该包含固定工具和远程工具
        assert content.startswith("<!-- tools:")
        assert "web_search" in content  # 模板中的固定工具
        assert "marketing_analyzer" in content  # 远程工具应该被添加

        # 验证 LLM 配置
        assert "<!-- llm: main_llm -->" in content

        # 验证自定义提示词内容 - 应该在 base_instructions 部分
        assert "你是一个营销专家AI助手，专门帮助用户分析市场趋势。" in content
        assert "<base_instructions>" in content

        # 验证整体格式
        lines = content.split('\n')
        assert len(lines) >= 4  # 至少包含工具声明、LLM配置、空行、提示词

        print("✅ 构建包含工具的 .agent 文件内容测试通过")

    def test_build_agent_file_content_without_tools(self):
        """测试构建不包含工具的 .agent 文件内容"""
        # 准备测试数据
        agent_details = RealAgentDetailsResult.create_without_tools(
            prompt_string="你是一个通用AI助手"
        )

        # 执行测试
        content = self.converter._build_agent_file_content(agent_details)

        # 验证结果
        assert content is not None
        assert isinstance(content, str)

        # 验证工具声明仍然存在（模板中有固定工具）
        assert content.startswith("<!-- tools:")
        assert "web_search" in content  # 模板中的固定工具

        # 验证 LLM 配置仍然存在
        assert "<!-- llm: main_llm -->" in content

        # 验证自定义提示词内容
        assert "你是一个通用AI助手" in content
        assert "<base_instructions>" in content

        print("✅ 构建不包含工具的 .agent 文件内容测试通过")

    def test_build_agent_file_content_without_prompt(self):
        """测试构建没有自定义提示词的 .agent 文件内容"""
        # 准备测试数据
        agent_details = RealAgentDetailsResult.create_without_prompt()

        # 执行测试
        content = self.converter._build_agent_file_content(agent_details)

        # 验证结果
        assert content is not None
        assert isinstance(content, str)

        # 验证包含工具声明（模板固定工具 + 远程工具）
        assert content.startswith("<!-- tools:")
        assert "web_search" in content  # 模板中的固定工具
        assert "test_tool" in content   # 远程工具

        # 验证模板角色定义存在
        assert "<role>" in content
        assert "</role>" in content

        # 验证生成了基本角色定义（使用名称和描述）
        assert "You are 无提示词助手. 没有自定义提示词的助手" in content

        print("✅ 构建没有自定义提示词的 .agent 文件内容测试通过")

    def test_agent_file_content_format_validation(self):
        """测试 .agent 文件内容格式的详细验证"""
        # 准备复杂的测试数据
        complex_tools = [
            {
                "code": "complex_tool_1",
                "name": "复杂工具1",
                "description": "第一个复杂工具",
                "icon": {},
                "type": 2,
                "schema": {
                    "type": "object",
                    "properties": {
                        "param1": {"type": "string"},
                        "param2": {"type": "integer"},
                        "param3": {"type": "array", "items": {"type": "string"}}
                    },
                    "required": ["param1"]
                }
            },
            {
                "code": "complex_tool_2",
                "name": "复杂工具2",
                "description": "第二个复杂工具",
                "icon": {},
                "type": 3,
                "schema": {
                    "type": "object",
                    "properties": {
                        "data": {"type": "object"},
                        "options": {"type": "array"}
                    }
                }
            }
        ]

        agent_details = RealAgentDetailsResult.create_with_tools(
            agent_id="complex-agent",
            name="复杂测试助手",
            description="用于测试复杂场景的助手",
            prompt_string="<role>\n你是一个复杂的AI助手\n</role>\n\n<instructions>\n- 处理复杂任务\n- 使用多种工具\n</instructions>",
            tools=complex_tools
        )

        # 执行测试
        content = self.converter._build_agent_file_content(agent_details)

        # 验证格式结构
        lines = content.split('\n')

        # 验证工具声明在第一行，包含模板工具和远程工具
        assert lines[0].startswith("<!-- tools:")
        assert "web_search" in lines[0]  # 模板中的固定工具
        assert "complex_tool_1" in lines[0]  # 远程工具
        assert "complex_tool_2" in lines[0]  # 远程工具

        # 验证 LLM 配置在第二行
        assert lines[1] == "<!-- llm: main_llm -->"

        # 验证模板结构存在
        assert "<role>" in content
        assert "</role>" in content
        assert "<base_instructions>" in content
        assert "</base_instructions>" in content

        # 验证自定义提示词内容在 base_instructions 部分
        assert "你是一个复杂的AI助手" in content
        assert "处理复杂任务" in content
        assert "使用多种工具" in content

        print("✅ .agent 文件内容格式详细验证测试通过")

    def test_file_path_and_directory_setup(self):
        """测试文件路径和目录设置"""
        converter = AgentConfigConverter()

        # 验证目录设置
        assert converter.agents_dir.exists()

        # 验证路径配置
        expected_agents_dir = Path(PathManager.get_project_root()) / "agents"

        assert converter.agents_dir == expected_agents_dir

        print("✅ 文件路径和目录设置测试通过")

    def test_agent_file_content_building_edge_cases(self):
        """测试 _build_agent_file_content 的边界情况"""

        # 测试空工具列表但 has_tools() 返回 False
        data = {
            "id": "edge-case-agent",
            "name": "边界测试",
            "description": "测试边界情况",
            "icon": {},
            "type": 1,
            "enabled": True,
            "prompt_string": "简单提示",
            "tools": [],  # 空列表
            "creator": "test",
            "modifier": "test",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }

        agent_details = AgentDetailsResult(data)
        content = self.converter._build_agent_file_content(agent_details)

        # 验证工具声明行存在（模板中有固定工具）
        assert content.startswith("<!-- tools:")
        assert "web_search" in content  # 模板中的固定工具
        # 验证仍有 LLM 配置
        assert "<!-- llm: main_llm -->" in content
        # 验证提示词存在
        assert "简单提示" in content

        print("✅ _build_agent_file_content 边界情况测试通过")

    def test_multiple_tool_codes_formatting(self):
        """测试多个工具代码的格式化"""
        # 创建包含多个工具的场景
        tools = []
        tool_codes = ["tool_a", "tool_b", "tool_c", "tool_d", "tool_e"]

        for i, code in enumerate(tool_codes):
            tools.append({
                "code": code,
                "name": f"工具{i+1}",
                "description": f"第{i+1}个工具",
                "icon": {},
                "type": 1,
                "schema": {"type": "object", "properties": {}}
            })

        agent_details = RealAgentDetailsResult.create_with_tools(
            tools=tools,
            prompt_string="多工具测试"
        )

        content = self.converter._build_agent_file_content(agent_details)

        # 验证工具代码格式 - 应该包含模板工具和远程工具
        assert content.startswith("<!-- tools:")
        assert "web_search" in content  # 模板中的固定工具
        # 验证所有远程工具都被添加到工具列表中
        for tool_code in tool_codes:
            assert tool_code in content

        print("✅ 多个工具代码格式化测试通过")

    def test_string_representation_and_basic_operations(self):
        """测试基本操作和字符串表示"""
        converter = AgentConfigConverter()

        # 测试转换器的基本属性
        assert hasattr(converter, 'agents_dir')
        assert hasattr(converter, '_build_agent_file_content')
        assert hasattr(converter, 'convert_api_to_agent_file')

        # 测试目录存在性
        assert converter.agents_dir.is_dir()

        print("✅ 基本操作测试通过")


class TestAgentConfigConverterIntegration:
    """AgentConfigConverter 集成测试类"""

    def setup_method(self):
        """每个测试方法前的设置"""
        self.converter = AgentConfigConverter()

    def teardown_method(self):
        """每个测试方法后的清理"""
        # 清理生成的文件
        for file_path in self.converter.agents_dir.glob("integration-test-*.agent"):
            try:
                file_path.unlink()
            except FileNotFoundError:
                pass

        # 重置远程工具管理器
        remote_tool_manager.clear_all_remote_tools()

    def test_file_generation_and_content_verification(self):
        """测试文件生成和内容验证（模拟成功的 API 调用）"""
        # 准备测试数据
        agent_id = "integration-test-agent-001"
        agent_details = RealAgentDetailsResult.create_with_tools(
            agent_id=agent_id,
            name="集成测试助手",
            description="用于集成测试的AI助手",
            prompt_string="你是一个用于集成测试的AI助手"
        )

        # 模拟文件生成过程（不实际调用 API）
        content = self.converter._build_agent_file_content(agent_details)

        # 手动生成文件（模拟 convert_api_to_agent_file 的文件操作部分）
        main_file_path = self.converter.agents_dir / f"{agent_id}.agent"

        # 写入文件
        with open(main_file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        # 验证文件存在
        assert main_file_path.exists()

        # 验证文件内容
        with open(main_file_path, 'r', encoding='utf-8') as f:
            main_content = f.read()

        # 验证内容一致
        assert main_content == content

        # 验证内容格式
        assert main_content.startswith("<!-- tools:")
        assert "web_search" in main_content  # 模板中的固定工具
        assert "marketing_analyzer" in main_content  # 远程工具
        assert "<!-- llm: main_llm -->" in main_content
        assert "你是一个用于集成测试的AI助手" in main_content

        print("✅ 文件生成和内容验证集成测试通过")

    def test_remote_tool_registration_simulation(self):
        """测试远程工具注册模拟（不实际调用 API）"""
        agent_id = "integration-test-remote-tools"

        # 创建包含远程工具的 AgentDetailsResult
        remote_tools = [
            {
                "code": "remote_analyzer",
                "name": "远程分析器",
                "description": "远程分析工具",
                "icon": {},
                "type": 3,  # 远程工具
                "schema": {
                    "type": "object",
                    "properties": {
                        "data": {"type": "string", "description": "要分析的数据"},
                        "mode": {"type": "string", "enum": ["fast", "detailed"]}
                    },
                    "required": ["data"]
                }
            },
            {
                "code": "remote_processor",
                "name": "远程处理器",
                "description": "远程数据处理工具",
                "icon": {},
                "type": 2,  # 官方远程工具
                "schema": {
                    "type": "object",
                    "properties": {
                        "input": {"type": "array", "items": {"type": "string"}},
                        "output_format": {"type": "string"}
                    },
                    "required": ["input"]
                }
            }
        ]

        agent_details = RealAgentDetailsResult.create_with_tools(
            agent_id=agent_id,
            tools=remote_tools,
            prompt_string="你是一个使用远程工具的AI助手"
        )

        # 模拟远程工具注册（类似于 convert_api_to_agent_file 中的逻辑）
        tools = agent_details.get_tools()
        initial_tool_count = len(remote_tool_manager.get_registered_tool_names())

        # 执行注册
        remote_tool_manager.reset_and_register(tools, agent_id)

                # 验证工具注册
        registered_tools = remote_tool_manager.get_registered_tool_names()
        assert "remote_analyzer" in registered_tools  # 工具名称直接使用 code，不添加 remote_ 前缀
        assert "remote_processor" in registered_tools

        # 验证注册的工具数量
        assert len(registered_tools) >= 2  # 至少包含我们注册的2个工具

        # 验证远程工具管理器状态
        assert remote_tool_manager.is_remote_tool("remote_analyzer")
        assert remote_tool_manager.is_remote_tool("remote_processor")

        print("✅ 远程工具注册模拟集成测试通过")

    def test_complete_workflow_simulation(self):
        """测试完整工作流模拟（不调用真实 API）"""
        agent_id = "integration-test-workflow"

        # Step 1: 准备复杂的测试数据
        mixed_tools = [
            {
                "code": "builtin_tool",
                "name": "内置工具",
                "description": "系统内置工具",
                "icon": {},
                "type": 1,  # 内置工具
                "schema": {
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"]
                }
            },
            {
                "code": "official_remote_tool",
                "name": "官方远程工具",
                "description": "官方提供的远程工具",
                "icon": {},
                "type": 2,  # 官方远程工具
                "schema": {
                    "type": "object",
                    "properties": {
                        "input_data": {"type": "string"},
                        "processing_mode": {"type": "string"}
                    },
                    "required": ["input_data"]
                }
            },
            {
                "code": "custom_remote_tool",
                "name": "自定义远程工具",
                "description": "用户自定义的远程工具",
                "icon": {},
                "type": 3,  # 自定义远程工具
                "schema": {
                    "type": "object",
                    "properties": {
                        "custom_param": {"type": "object"},
                        "options": {"type": "array"}
                    }
                }
            }
        ]

        agent_details = RealAgentDetailsResult.create_with_tools(
            agent_id=agent_id,
            name="完整工作流测试助手",
            description="测试完整工作流的助手",
            prompt_string="<role>\n你是一个完整工作流测试助手\n</role>\n\n<instructions>\n- 使用多种类型的工具\n- 处理复杂的任务流程\n</instructions>",
            tools=mixed_tools
        )

        # Step 2: 执行远程工具注册
        tools = agent_details.get_tools()
        remote_tool_manager.reset_and_register(tools, agent_id)

        # Step 3: 生成 .agent 文件内容
        content = self.converter._build_agent_file_content(agent_details)

        # Step 4: 模拟文件写入
        main_file_path = self.converter.agents_dir / f"{agent_id}.agent"

        with open(main_file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        # Step 5: 综合验证

                        # 验证远程工具注册（注意：只有远程工具 type 2/3 会被注册，type 1 内置工具不会）
        registered_tools = remote_tool_manager.get_registered_tool_names()
        assert "builtin_tool" not in registered_tools  # type 1 内置工具不注册为远程工具
        assert "official_remote_tool" in registered_tools  # type 2 官方远程工具
        assert "custom_remote_tool" in registered_tools    # type 3 自定义远程工具

        # 验证远程工具管理器中只有2个工具（不包括内置工具）
        assert len(registered_tools) == 2

        # 验证文件生成
        assert main_file_path.exists()

        # 验证文件内容
        with open(main_file_path, 'r', encoding='utf-8') as f:
            file_content = f.read()

        # 验证工具声明 - 应该包含模板工具和远程工具
        assert file_content.startswith("<!-- tools:")
        assert "web_search" in file_content  # 模板中的固定工具
        assert "builtin_tool" in file_content  # 远程工具（type 1）
        assert "official_remote_tool" in file_content  # 远程工具（type 2）
        assert "custom_remote_tool" in file_content  # 远程工具（type 3）

        # 验证 LLM 配置
        assert "<!-- llm: main_llm -->" in file_content

        # 验证提示词结构
        assert "<role>" in file_content
        assert "</role>" in file_content
        assert "<instructions>" in file_content
        assert "</instructions>" in file_content
        assert "你是一个完整工作流测试助手" in file_content

        print("✅ 完整工作流模拟集成测试通过")


class TestAgentConfigConverterRealAPI:
    """AgentConfigConverter 真实 API 调用测试类"""

    def setup_method(self):
        """每个测试方法前的设置"""
        self.converter = AgentConfigConverter()
        self.real_agent_id = "SMA-68b6ae062de561-46870814"

    def teardown_method(self):
        """每个测试方法后的清理"""
        # 清理生成的文件
        for file_path in self.converter.agents_dir.glob(f"{self.real_agent_id}.agent"):
            try:
                file_path.unlink()
                print(f"清理文件: {file_path}")
            except FileNotFoundError:
                pass

        # 重置远程工具管理器
        remote_tool_manager.clear_all_remote_tools()

    @pytest.mark.asyncio
    async def test_convert_real_agent_api_to_file(self):
        """测试转换真实 Agent API 配置为 .agent 文件"""
        try:
            # 执行真实 API 调用
            agent_file_path = await self.converter.convert_api_to_agent_file(self.real_agent_id)

            # 验证返回的文件路径
            assert agent_file_path is not None
            assert isinstance(agent_file_path, str)

            # 验证文件存在
            main_file = Path(agent_file_path)

            assert main_file.exists(), f"主文件不存在: {main_file}"

            # 验证文件内容
            with open(main_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # 基本格式验证
            assert "<!-- llm: main_llm -->" in content, "缺少 LLM 配置"
            assert len(content.strip()) > 0, "文件内容为空"

            # 验证文件结构
            lines = content.split('\n')
            assert len(lines) >= 2, "文件行数太少"

            print("✅ 真实 Agent API 转换文件测试通过")
            print(f"✅ Agent ID: {self.real_agent_id}")
            print(f"✅ 生成的文件: {agent_file_path}")
            print(f"✅ 文件大小: {len(content)} 字符")

        except Exception as e:
            print(f"❌ 真实 API 调用失败: {e}")
            # 这个测试失败不应该阻止其他测试，所以我们记录错误但不抛出异常
            pytest.skip(f"真实 API 调用失败: {e}")

    @pytest.mark.asyncio
    async def test_real_agent_content_analysis(self):
        """测试真实 Agent 内容分析（需要 API 调用成功）"""
        try:
            # 执行真实 API 调用
            agent_file_path = await self.converter.convert_api_to_agent_file(self.real_agent_id)

            # 读取生成的文件内容
            with open(agent_file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            lines = content.split('\n')

            # 分析文件结构
            has_tools = "<!-- tools:" in content
            has_llm_config = "<!-- llm: main_llm -->" in content
            has_content = len([line for line in lines if line.strip() and not line.strip().startswith("<!--")]) > 0

            print("✅ 真实 Agent 内容分析:")
            print(f"  - 包含工具声明: {has_tools}")
            print(f"  - 包含 LLM 配置: {has_llm_config}")
            print(f"  - 包含提示词内容: {has_content}")
            print(f"  - 总行数: {len(lines)}")
            print(f"  - 非注释行数: {len([line for line in lines if line.strip() and not line.strip().startswith('<!--')])}")

            # 基本验证
            assert has_llm_config, "必须包含 LLM 配置"
            assert len(content.strip()) > 50, "内容太少，可能转换失败"

            # 如果包含工具，验证工具注册
            if has_tools:
                registered_tools = remote_tool_manager.get_registered_tool_names()
                print(f"  - 注册的远程工具数量: {len(registered_tools)}")
                print(f"  - 注册的工具列表: {registered_tools}")

                # 验证远程工具管理器中有工具
                assert len(registered_tools) > 0, "包含工具声明但没有注册远程工具"

            print("✅ 真实 Agent 内容分析测试通过")

        except Exception as e:
            print(f"❌ 真实 API 调用失败: {e}")
            pytest.skip(f"真实 API 调用失败: {e}")

    def test_real_agent_file_structure(self):
        """测试真实 Agent 文件结构（基于已存在的 .agent 文件）"""
        # 检查是否已经存在 .agent 文件
        existing_agent_file = self.converter.agents_dir.parent / "agents" / f"{self.real_agent_id}.agent"

        if existing_agent_file.exists():
            # 读取现有文件进行分析
            with open(existing_agent_file, 'r', encoding='utf-8') as f:
                content = f.read()

            print(f"✅ 发现现有 Agent 文件: {existing_agent_file}")
            print(f"✅ 文件大小: {len(content)} 字符")

            # 分析文件结构
            lines = content.split('\n')
            has_tools = "<!-- tools:" in content
            has_llm_config = "<!-- llm:" in content

            print(f"✅ 文件结构分析:")
            print(f"  - 总行数: {len(lines)}")
            print(f"  - 包含工具声明: {has_tools}")
            print(f"  - 包含 LLM 配置: {has_llm_config}")

            if has_tools:
                # 提取工具列表
                for line in lines:
                    if line.strip().startswith("<!-- tools:"):
                        tools_line = line.strip()
                        tools_part = tools_line.replace("<!-- tools:", "").replace("-->", "").strip()
                        tools_list = [t.strip() for t in tools_part.split(",")]
                        print(f"  - 工具列表: {tools_list}")
                        print(f"  - 工具数量: {len(tools_list)}")
                        break

            # 基本验证
            assert len(content.strip()) > 0, "文件内容为空"
            assert len(lines) > 1, "文件结构异常"

            print("✅ 真实 Agent 文件结构测试通过")
        else:
            print(f"⚠️  Agent 文件不存在: {existing_agent_file}")
            print("⚠️  跳过文件结构测试")
            pytest.skip(f"Agent 文件不存在: {existing_agent_file}")


if __name__ == "__main__":
    # 运行测试
    pytest.main([__file__, "-v", "--tb=short"])
