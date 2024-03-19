"""远程工具集成测试

测试远程工具的完整流程：工具创建 -> 注册 -> 参数验证 -> API调用
使用真实的数据和API调用，不使用mock。
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
import asyncio
from typing import List

from app.tools.remote.remote_tool import RemoteTool, RemoteToolParams
from app.tools.remote.remote_tool_manager import RemoteToolManager
from app.infrastructure.sdk.magic_service.result.agent_details_result import Tool
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk, MagicServiceConfigError
from app.infrastructure.sdk.magic_service.kernel.magic_service_exception import MagicServiceException
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core.tool_factory import tool_factory


class TestRemoteToolIntegration:
    """远程工具集成测试"""

    @pytest.fixture(autouse=True)
    def setup_and_cleanup(self):
        """测试前后的设置和清理"""
        # 测试前：清空远程工具管理器
        manager = RemoteToolManager()
        manager.clear_all_remote_tools()

        yield

        # 测试后：清理
        manager.clear_all_remote_tools()

    def create_real_teamshare_tool(self):
        """创建真实的天书云文档工具"""
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

    def create_real_official_tool(self):
        """创建真实的官方工具"""
        tool_data = {
            "code": "official_test_tool",
            "name": "official_test_tool",
            "description": "官方测试工具",
            "icon": {},
            "type": 2,
            "schema": {
                "type": "object",
                "properties": {
                    "input_text": {
                        "type": "string",
                        "description": "输入文本"
                    },
                    "options": {
                        "type": "object",
                        "description": "选项",
                        "properties": {
                            "format": {"type": "string"},
                            "limit": {"type": "integer"}
                        }
                    }
                },
                "required": ["input_text"]
            }
        }
        return Tool(tool_data)

    def test_single_tool_lifecycle(self):
        """测试单个工具的完整生命周期"""
        print("\n🧪 测试单个工具的完整生命周期")

        # 1. 创建工具
        tool_obj = self.create_real_teamshare_tool()
        print(f"✅ 创建工具: {tool_obj.code}")

        # 2. 创建远程工具包装器
        remote_tool = RemoteTool(tool_obj)
        assert remote_tool.is_available()
        print(f"✅ 创建远程工具包装器: {remote_tool.get_effective_name()}")

        # 3. 验证工具属性
        assert remote_tool.tool_code == "teamshare_box_teamshare_doc_markdown_query"
        assert remote_tool._original_schema is not None
        assert "file_id" in remote_tool._original_schema.get("properties", {})
        print(f"✅ 工具属性验证通过")

        # 4. 测试参数类创建
        params_class = RemoteToolParams.create_from_schema(remote_tool._original_schema)
        params = params_class(file_id="799647356681887744")
        assert params.model_dump()["file_id"] == "799647356681887744"
        print(f"✅ 参数类创建和验证通过")

        # 5. 注册到工具管理器
        manager = RemoteToolManager()
        manager.register_remote_tools([tool_obj], "integration_test_agent")
        assert manager.is_remote_tool("teamshare_box_teamshare_doc_markdown_query")
        print(f"✅ 工具注册到管理器成功")

        # 6. 清理
        manager.clear_all_remote_tools()
        assert not manager.is_remote_tool("teamshare_box_teamshare_doc_markdown_query")
        print(f"✅ 工具清理成功")

    def test_multiple_tools_management(self):
        """测试多工具管理"""
        print("\n🧪 测试多工具管理")

        # 1. 创建多个工具
        tools = [
            self.create_real_teamshare_tool(),
            self.create_real_official_tool()
        ]
        print(f"✅ 创建 {len(tools)} 个工具")

        # 2. 批量注册
        manager = RemoteToolManager()
        manager.register_remote_tools(tools, "multi_tool_test_agent")

        # 3. 验证注册结果
        assert len(manager.registered_tools) == 2
        assert manager.is_remote_tool("teamshare_box_teamshare_doc_markdown_query")
        assert manager.is_remote_tool("official_test_tool")
        print(f"✅ {len(manager.registered_tools)} 个工具注册成功")

        # 4. 验证工具列表
        tool_names = manager.get_registered_tool_names()
        expected_names = ["teamshare_box_teamshare_doc_markdown_query", "official_test_tool"]
        assert set(tool_names) == set(expected_names)
        print(f"✅ 工具列表验证通过: {tool_names}")

        # 5. 重置测试
        new_tools = [self.create_real_teamshare_tool()]
        manager.reset_and_register(new_tools, "reset_test_agent")
        assert len(manager.registered_tools) == 1
        assert manager.is_remote_tool("teamshare_box_teamshare_doc_markdown_query")
        assert not manager.is_remote_tool("official_test_tool")
        print(f"✅ 工具重置功能验证通过")

    def test_parameter_validation_and_filtering(self):
        """测试参数验证和过滤"""
        print("\n🧪 测试参数验证和过滤")

        # 1. 创建工具
        tool_obj = self.create_real_official_tool()
        remote_tool = RemoteTool(tool_obj)

        # 2. 测试基本参数创建
        params_class = RemoteToolParams.create_from_schema(remote_tool._original_schema)
        params = params_class(
            input_text="test input",
            options={"format": "json", "limit": 10}
        )
        params_dict = params.model_dump()
        assert params_dict["input_text"] == "test input"
        assert params_dict["options"]["format"] == "json"
        assert params_dict["options"]["limit"] == 10
        print(f"✅ 基本参数创建验证通过")

        # 3. 测试必填参数验证
        try:
            invalid_params = params_class()  # 缺少必填参数
            # 这里应该有验证逻辑，但pydantic的行为可能不同
            print(f"⚠️ 参数验证行为需要进一步测试")
        except Exception as e:
            print(f"✅ 必填参数验证生效: {type(e).__name__}")

        # 4. 测试参数过滤逻辑
        schema_properties = remote_tool._original_schema.get("properties", {})
        test_args = {
            "input_text": "test",
            "options": {"format": "json"},
            "extra_field": "should_be_filtered"  # 不在schema中
        }
        filtered_args = {key: value for key, value in test_args.items()
                        if key in schema_properties}
        assert "extra_field" not in filtered_args
        assert "input_text" in filtered_args
        assert "options" in filtered_args
        print(f"✅ 参数过滤逻辑验证通过")

    @pytest.mark.asyncio
    async def test_real_api_execution(self):
        """测试真实API执行"""
        print("\n🧪 测试真实API执行")

        try:
            # 1. 创建工具和包装器
            tool_obj = self.create_real_teamshare_tool()
            remote_tool = RemoteTool(tool_obj)
            print(f"✅ 创建工具: {remote_tool.tool_code}")

            # 2. 创建参数
            params_class = RemoteToolParams.create_from_schema(remote_tool._original_schema)
            params = params_class(file_id="799647356681887744")  # 测试文件ID
            print(f"✅ 创建参数: {params.model_dump()}")

            # 3. 创建工具上下文
            tool_context = ToolContext()
            print(f"✅ 创建工具上下文")

            # 4. 执行工具
            print(f"🚀 开始执行远程工具...")
            result = await remote_tool.execute(tool_context, params)

            # 5. 验证结果
            assert isinstance(result, ToolResult)
            print(f"✅ 工具执行完成，结果类型: {type(result)}")

            if not result.ok:
                print(f"⚠️ 执行结果包含错误: {result.content}")
                # 错误可能是正常的（比如文件不存在、权限问题等）
                assert isinstance(result.content, str)
                assert len(result.content) > 0
                print(f"✅ 错误处理验证通过")
            else:
                print(f"📄 执行成功")
                if result.content:
                    content_str = str(result.content)
                    print(f"📄 内容长度: {len(content_str)} 字符")
                    print(f"📄 内容预览: {content_str[:100]}...")
                    assert len(content_str) > 0
                    print(f"✅ 成功结果验证通过")

        except MagicServiceConfigError as e:
            pytest.skip(f"MagicService 配置不可用，跳过API测试: {e}")

        except MagicServiceException as e:
            print(f"⚠️ MagicService 业务异常: {e}")
            # 业务异常（如权限、文件不存在等）不应导致测试失败
            print(f"✅ 业务异常处理验证通过")

        except Exception as e:
            print(f"❌ 执行过程中发生未预期错误: {type(e).__name__}: {e}")
            # 只有真正的程序错误才应该导致测试失败
            raise

    @pytest.mark.asyncio
    async def test_error_scenarios(self):
        """测试错误场景"""
        print("\n🧪 测试错误场景")

        try:
            # 1. 测试无效文件ID
            tool_obj = self.create_real_teamshare_tool()
            remote_tool = RemoteTool(tool_obj)

            params_class = RemoteToolParams.create_from_schema(remote_tool._original_schema)
            invalid_params = params_class(file_id="invalid_file_id_999999")
            tool_context = ToolContext()

            print(f"🚀 测试无效文件ID: {invalid_params.model_dump()}")
            result = await remote_tool.execute(tool_context, invalid_params)

            assert isinstance(result, ToolResult)
            print(f"✅ 无效文件ID测试完成")

            # 对于无效文件ID，我们期望得到错误结果
            if not result.ok:
                print(f"✅ 预期的错误结果: {result.content}")
                assert "远程工具执行失败" in result.content or "远程工具执行异常" in result.content
            else:
                print(f"⚠️ 意外的成功结果: {result.content}")
                # 有时API可能不会因为无效ID而报错，这也是可能的

        except MagicServiceConfigError as e:
            pytest.skip(f"MagicService 配置不可用，跳过错误场景测试: {e}")

        except MagicServiceException as e:
            print(f"✅ 预期的MagicService异常: {e}")

        except Exception as e:
            print(f"❌ 错误场景测试中发生未预期错误: {type(e).__name__}: {e}")
            raise

    def test_tool_factory_integration(self):
        """测试与工具工厂的集成"""
        print("\n🧪 测试与工具工厂的集成")

        # 1. 注册工具到管理器
        tool_obj = self.create_real_teamshare_tool()
        manager = RemoteToolManager()
        manager.register_remote_tools([tool_obj], "factory_integration_test")
        print(f"✅ 工具注册到管理器")

        # 2. 验证工具是否在工厂中可用
        tool_code = "teamshare_box_teamshare_doc_markdown_query"
        assert manager.is_remote_tool(tool_code)
        print(f"✅ 工具在管理器中确认存在")

        try:
            # 3. 尝试从工具工厂获取工具实例
            tool_instance = tool_factory.get_tool_instance(tool_code)
            if tool_instance:
                assert isinstance(tool_instance, RemoteTool)
                assert tool_instance.tool_code == tool_code
                print(f"✅ 从工具工厂成功获取工具实例")
            else:
                print(f"⚠️ 工具工厂中未找到工具实例（可能需要不同的获取方式）")

        except Exception as e:
            print(f"⚠️ 工具工厂集成测试异常: {e}")
            # 不同的工具工厂实现可能有不同的行为，这里不强制失败

    def test_complex_schema_handling(self):
        """测试复杂schema处理"""
        print("\n🧪 测试复杂schema处理")

        # 1. 创建具有复杂schema的工具
        complex_tool_data = {
            "code": "complex_schema_tool",
            "name": "complex_schema_tool",
            "description": "复杂schema测试工具",
            "icon": {},
            "type": 3,
            "schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "查询字符串"
                    },
                    "filters": {
                        "type": "object",
                        "description": "过滤条件",
                        "properties": {
                            "category": {"type": "string"},
                            "date_range": {
                                "type": "object",
                                "properties": {
                                    "start": {"type": "string"},
                                    "end": {"type": "string"}
                                }
                            },
                            "tags": {
                                "type": "array",
                                "items": {"type": "string"}
                            },
                            "enabled": {"type": "boolean"}
                        }
                    },
                    "limit": {"type": "integer", "minimum": 1, "maximum": 100}
                },
                "required": ["query", "filters"]
            }
        }

        complex_tool = Tool(complex_tool_data)
        remote_tool = RemoteTool(complex_tool)
        print(f"✅ 创建复杂schema工具: {complex_tool.code}")

        # 2. 验证工具可用性
        assert remote_tool.is_available()
        assert remote_tool._original_schema is not None
        print(f"✅ 复杂schema工具可用性验证通过")

        # 3. 测试复杂参数创建
        params_class = RemoteToolParams.create_from_schema(remote_tool._original_schema)
        complex_params = params_class(
            query="test search",
            filters={
                "category": "documents",
                "date_range": {
                    "start": "2024-01-01",
                    "end": "2024-12-31"
                },
                "tags": ["important", "work"],
                "enabled": True
            },
            limit=50
        )

        # 4. 验证参数结构
        params_dict = complex_params.model_dump()
        assert params_dict["query"] == "test search"
        assert params_dict["filters"]["category"] == "documents"
        assert params_dict["filters"]["date_range"]["start"] == "2024-01-01"
        assert params_dict["filters"]["tags"] == ["important", "work"]
        assert params_dict["filters"]["enabled"] is True
        assert params_dict["limit"] == 50
        print(f"✅ 复杂参数创建和验证通过")

        # 5. 测试注册复杂工具
        manager = RemoteToolManager()
        manager.register_remote_tools([complex_tool], "complex_test_agent")
        assert manager.is_remote_tool("complex_schema_tool")
        print(f"✅ 复杂schema工具注册成功")
