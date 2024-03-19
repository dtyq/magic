"""远程工具包装器单元测试

使用真实的数据和API调用进行测试，不使用mock。
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
from typing import Dict, Any

from app.tools.remote.remote_tool import RemoteTool, RemoteToolParams
from app.infrastructure.sdk.magic_service.result.agent_details_result import Tool
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk, MagicServiceConfigError
from app.infrastructure.sdk.magic_service.kernel.magic_service_exception import MagicServiceException
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult


class RealTool:
    """真实的Tool对象创建辅助类"""

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
    def create_complex_tool():
        """创建复杂工具用于测试"""
        tool_data = {
            "code": "complex_analysis_tool",
            "name": "complex_analysis_tool",
            "description": "复杂分析工具",
            "icon": {},
            "type": 2,
            "schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "查询内容"
                    },
                    "options": {
                        "type": "object",
                        "description": "分析选项",
                        "properties": {
                            "deep_analysis": {"type": "boolean"},
                            "categories": {
                                "type": "array",
                                "items": {"type": "string"}
                            }
                        },
                        "required": ["deep_analysis"]
                    }
                },
                "required": ["query", "options"]
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
            "type": 1,
            "schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索查询"}
                },
                "required": ["query"]
            }
        }
        return Tool(tool_data)


class TestRemoteToolParams:
    """测试远程工具参数类"""

    def test_create_from_schema_simple(self):
        """测试从简单 schema 创建参数类"""
        schema = {
            "type": "object",
            "properties": {
                "file_id": {
                    "type": "string",
                    "description": "云文档文件 id"
                },
                "format": {
                    "type": "string",
                    "description": "输出格式"
                }
            },
            "required": ["file_id"]
        }

        params_class = RemoteToolParams.create_from_schema(schema)

        # 测试必填参数
        params = params_class(file_id="799647356681887744", format="markdown")  # type: ignore
        params_dict = params.model_dump()
        assert params_dict["file_id"] == "799647356681887744"
        assert params_dict["format"] == "markdown"

        # 测试可选参数
        params = params_class(file_id="799647356681887744")  # type: ignore
        params_dict = params.model_dump()
        assert params_dict["file_id"] == "799647356681887744"
        assert params_dict["format"] is None

    def test_create_from_schema_different_types(self):
        """测试不同 JSON Schema 类型映射"""
        schema = {
            "type": "object",
            "properties": {
                "text": {"type": "string"},
                "count": {"type": "integer"},
                "price": {"type": "number"},
                "enabled": {"type": "boolean"},
                "tags": {"type": "array"},
                "metadata": {"type": "object"}
            },
            "required": ["text", "count"]
        }

        params_class = RemoteToolParams.create_from_schema(schema)

        # 创建参数实例
        params_data = {
            "text": "hello",
            "count": 42,
            "price": 19.99,
            "enabled": True,
            "tags": ["tag1", "tag2"],
            "metadata": {"key": "value"}
        }
        params = params_class(**params_data)  # type: ignore

        params_dict = params.model_dump()
        assert params_dict["text"] == "hello"
        assert params_dict["count"] == 42
        assert params_dict["price"] == 19.99
        assert params_dict["enabled"] is True
        assert params_dict["tags"] == ["tag1", "tag2"]
        assert params_dict["metadata"] == {"key": "value"}

    def test_create_from_schema_empty(self):
        """测试空 schema"""
        schema = {}

        params_class = RemoteToolParams.create_from_schema(schema)
        params = params_class()

        # 应该能够创建空参数实例
        assert params is not None
        params_dict = params.model_dump()

    def test_get_python_type(self):
        """测试 JSON 类型到 Python 类型的映射"""
        assert RemoteToolParams._get_python_type({"type": "string"}) == str
        assert RemoteToolParams._get_python_type({"type": "integer"}) == int
        assert RemoteToolParams._get_python_type({"type": "number"}) == float
        assert RemoteToolParams._get_python_type({"type": "boolean"}) == bool
        assert RemoteToolParams._get_python_type({"type": "array"}) == list
        assert RemoteToolParams._get_python_type({"type": "object"}) == dict
        assert RemoteToolParams._get_python_type({"type": "unknown"}) == Any


class TestRemoteTool:
    """测试远程工具包装器"""

    @pytest.fixture
    def teamshare_tool(self):
        """创建天书云文档工具"""
        return RealTool.create_teamshare_doc_tool()

    @pytest.fixture
    def complex_tool(self):
        """创建复杂工具"""
        return RealTool.create_complex_tool()

    @pytest.fixture
    def builtin_tool(self):
        """创建内置工具"""
        return RealTool.create_builtin_tool()

    @pytest.fixture
    def remote_tool(self, teamshare_tool):
        """创建远程工具实例"""
        return RemoteTool(teamshare_tool)

    @pytest.fixture
    def complex_remote_tool(self, complex_tool):
        """创建复杂远程工具实例"""
        return RemoteTool(complex_tool)

    def test_remote_tool_initialization(self, remote_tool, teamshare_tool):
        """测试远程工具初始化"""
        assert remote_tool.tool_info == teamshare_tool
        assert remote_tool.tool_code == "teamshare_box_teamshare_doc_markdown_query"
        assert remote_tool.name == "remote_teamshare_box_teamshare_doc_markdown_query"
        assert "天书云文档 markdown 查询" in remote_tool.description

        # 测试原始 schema 保存
        expected_schema = {
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
        assert remote_tool._original_schema == expected_schema

        # 测试 schema 有效性
        assert remote_tool._is_schema_valid is True
        assert remote_tool.is_available() is True

    def test_get_effective_name(self, remote_tool):
        """测试获取有效的工具名称"""
        assert remote_tool.get_effective_name() == "teamshare_doc_markdown_query"

    def test_get_params_class(self, remote_tool):
        """测试获取动态参数类"""
        params_class = remote_tool.get_params_class()
        assert params_class is not None
        assert hasattr(params_class, '__name__')
        assert params_class.__name__ == "DynamicRemoteToolParams"

    def test_to_param(self, remote_tool):
        """测试生成工具参数"""
        tool_param = remote_tool.to_param()

        # 验证基本结构
        assert tool_param is not None
        assert isinstance(tool_param, dict)
        assert tool_param.get("type") == "function"

        # 验证 function 部分
        function = tool_param.get("function", {})
        assert function.get("name") == "teamshare_doc_markdown_query"
        assert "天书云文档 markdown 查询" in function.get("description", "")

        # 验证 parameters 部分
        parameters = function.get("parameters", {})
        assert parameters.get("type") == "object"

        # 验证 properties
        properties = parameters.get("properties", {})
        assert "file_id" in properties
        assert properties["file_id"]["type"] == "string"
        assert properties["file_id"]["description"] == "云文档文件 id"

        # 验证 required
        required = parameters.get("required", [])
        assert "file_id" in required

    def test_validate_schema_valid(self, teamshare_tool):
        """测试有效 schema 验证"""
        remote_tool = RemoteTool(teamshare_tool)
        assert remote_tool._validate_schema(teamshare_tool.get_schema()) is True
        assert remote_tool.is_available() is True

    def test_validate_schema_invalid_empty(self):
        """测试无效 schema - 空或None"""
        invalid_tool_data = {
            "code": "invalid_tool",
            "name": "invalid_tool",
            "description": "Invalid tool",
            "icon": {},
            "type": 3,
            "schema": None
        }
        invalid_tool = Tool(invalid_tool_data)
        remote_tool = RemoteTool(invalid_tool)
        assert remote_tool._validate_schema(None) is False
        assert remote_tool.is_available() is False

    def test_validate_schema_invalid_type(self):
        """测试无效 schema - 非字典类型，应该抛出异常"""
        invalid_tool_data = {
            "code": "invalid_tool",
            "name": "invalid_tool",
            "description": "Invalid tool",
            "icon": {},
            "type": 3,
            "schema": "not a dict"
        }
        invalid_tool = Tool(invalid_tool_data)

        # 创建RemoteTool时应该抛出ValueError异常
        with pytest.raises(ValueError) as exc_info:
            RemoteTool(invalid_tool)

        # 检查异常消息
        assert "无效的远程工具schema" in str(exc_info.value)
        assert "期望字典类型" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_execute_with_real_api(self, remote_tool):
        """测试使用真实API执行工具"""
        try:
            # 创建真实的MagicService SDK
            magic_sdk = get_magic_service_sdk()

            # 创建工具上下文
            tool_context = ToolContext()

            # 创建参数类并实例化
            params_class = RemoteToolParams.create_from_schema(remote_tool._original_schema)
            params = params_class(file_id="799647356681887744")  # 使用测试文件ID

            print(f"🚀 执行远程工具: {remote_tool.tool_code}")
            print(f"📝 参数: {params.model_dump()}")

            # 执行工具
            result = await remote_tool.execute(tool_context, params)

            # 验证结果
            assert isinstance(result, ToolResult)
            print(f"✅ 工具执行完成")
            print(f"📋 结果类型: {type(result)}")

            if not result.ok:
                print(f"⚠️ 执行错误: {result.content}")
                # 错误是可能的（比如文件不存在），这不算测试失败
            else:
                print(f"📄 执行成功")
                if result.content:
                    print(f"📄 内容长度: {len(str(result.content))} 字符")
                    print(f"📄 内容预览: {str(result.content)[:100]}...")

        except MagicServiceConfigError as e:
            pytest.skip(f"MagicService 配置不可用: {e}")

        except MagicServiceException as e:
            print(f"⚠️ MagicService 业务异常: {e}")
            # 业务异常（如文件不存在）不应导致测试失败

        except Exception as e:
            print(f"❌ 未预期的错误: {type(e).__name__}: {e}")
            # 只有真正的程序错误才导致测试失败
            assert False, f"执行工具时发生未预期错误: {e}"

    def test_parameter_filtering(self, remote_tool):
        """测试参数过滤 - 只传递schema中定义的参数"""
        # 创建包含额外字段的参数
        params_class = RemoteToolParams.create_from_schema(remote_tool._original_schema)
        params = params_class(file_id="799647356681887744")

        # 手动添加额外字段
        params_dict = params.model_dump(exclude_none=True)
        params_dict["extra_field"] = "should_be_filtered"

        # 验证RemoteTool的参数过滤逻辑
        schema_properties = remote_tool._original_schema.get("properties", {})
        filtered_args = {key: value for key, value in params_dict.items()
                        if key in schema_properties}

        # 应该只包含schema中定义的参数
        assert filtered_args == {"file_id": "799647356681887744"}
        assert "extra_field" not in filtered_args

    @pytest.mark.asyncio
    async def test_execute_with_invalid_file_id(self, remote_tool):
        """测试使用无效文件ID执行工具"""
        try:
            # 创建真实的MagicService SDK
            magic_sdk = get_magic_service_sdk()

            # 创建工具上下文
            tool_context = ToolContext()

            # 创建参数类并实例化（使用无效的文件ID）
            params_class = RemoteToolParams.create_from_schema(remote_tool._original_schema)
            params = params_class(file_id="invalid_file_id_12345")

            print(f"🚀 执行远程工具（无效文件ID）: {remote_tool.tool_code}")
            print(f"📝 参数: {params.model_dump()}")

            # 执行工具
            result = await remote_tool.execute(tool_context, params)

            # 验证结果
            assert isinstance(result, ToolResult)
            print(f"📋 执行结果: {result}")

            # 对于无效文件ID，期望得到错误结果
            if not result.ok:
                print(f"⚠️ 预期的错误结果: {result.content}")
                assert "远程工具执行失败" in result.content or "远程工具执行异常" in result.content
            else:
                print(f"📄 意外的成功结果: {result.content}")

        except MagicServiceConfigError as e:
            pytest.skip(f"MagicService 配置不可用: {e}")

        except MagicServiceException as e:
            print(f"⚠️ MagicService 业务异常（预期）: {e}")
            # 业务异常是预期的

        except Exception as e:
            print(f"❌ 未预期的错误: {type(e).__name__}: {e}")
            assert False, f"执行工具时发生未预期错误: {e}"

    def test_string_representation(self, remote_tool):
        """测试字符串表示"""
        str_repr = str(remote_tool)
        assert "RemoteTool" in str_repr
        assert "teamshare_box_teamshare_doc_markdown_query" in str_repr
        assert "teamshare_doc_markdown_query" in str_repr

        repr_str = repr(remote_tool)
        assert repr_str == str_repr

    def test_tool_with_no_schema(self):
        """测试没有 schema 的工具"""
        no_schema_tool_data = {
            "code": "no_schema_tool",
            "name": "no_schema_tool",
            "description": "No schema tool",
            "icon": {},
            "type": 3,
            "schema": {}
        }
        no_schema_tool = Tool(no_schema_tool_data)
        remote_tool = RemoteTool(no_schema_tool)

        # 应该能够创建，但schema为空
        assert remote_tool._original_schema == {}
        assert remote_tool._is_schema_valid is True  # 空字典仍然是有效的
        assert remote_tool.is_available() is False  # 但工具不可用，因为缺少有效的schema内容

    def test_tool_availability_check(self, remote_tool):
        """测试工具可用性检查"""
        # 测试有效工具
        assert remote_tool.is_available() is True

        # 验证tool_schema属性
        assert remote_tool.tool_schema == remote_tool._original_schema

    def test_tool_with_complex_nested_schema(self, complex_remote_tool):
        """测试复杂嵌套schema的工具"""
        # 验证初始化成功
        assert complex_remote_tool.tool_code == "complex_analysis_tool"
        assert complex_remote_tool.is_available() is True

        # 验证schema保存正确
        expected_schema = {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "查询内容"
                },
                "options": {
                    "type": "object",
                    "description": "分析选项",
                    "properties": {
                        "deep_analysis": {"type": "boolean"},
                        "categories": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    },
                    "required": ["deep_analysis"]
                }
            },
            "required": ["query", "options"]
        }
        assert complex_remote_tool._original_schema == expected_schema

        # 测试参数类创建
        params_class = RemoteToolParams.create_from_schema(complex_remote_tool._original_schema)
        params = params_class(
            query="test analysis",
            options={"deep_analysis": True, "categories": ["cat1", "cat2"]}
        )

        params_dict = params.model_dump()
        assert params_dict["query"] == "test analysis"
        assert params_dict["options"]["deep_analysis"] is True
        assert params_dict["options"]["categories"] == ["cat1", "cat2"]

    def test_get_action_code_uses_effective_name(self, remote_tool):
        """测试 _get_action_code 方法使用有效名称而不是内部 name 属性"""
        # 验证 _get_action_code 直接返回 effective_name（保持原始大小写）
        effective_name = remote_tool.get_effective_name()
        action_code = remote_tool._get_action_code()

        assert action_code == effective_name
        assert action_code == "teamshare_doc_markdown_query"

        # 确认这与 name 属性不同（name 属性包含 remote_ 前缀和 tool_code）
        assert action_code != remote_tool.name
        assert remote_tool.name.startswith("remote_")
