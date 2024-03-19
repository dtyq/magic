"""MCP 工具包装器单元测试"""

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
from unittest.mock import Mock, AsyncMock
from typing import Dict, Any

from app.mcp.mcp_tool import MCPTool, MCPToolParams
from app.mcp.server_manager import MCPServerManager
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult


class TestMCPToolParams:
    """测试 MCP 工具参数类"""

    def test_create_from_schema_simple(self):
        """测试从简单 schema 创建参数类"""
        schema = {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索查询"
                },
                "limit": {
                    "type": "integer",
                    "description": "结果数量限制"
                }
            },
            "required": ["query"]
        }

        params_class = MCPToolParams.create_from_schema(schema)

        # 测试必填参数
        params = params_class(query="test query", limit=10)  # type: ignore
        params_dict = params.model_dump()
        assert params_dict["query"] == "test query"
        assert params_dict["limit"] == 10


        # 测试可选参数
        params = params_class(query="test query")  # type: ignore
        params_dict = params.model_dump()
        assert params_dict["query"] == "test query"
        assert params_dict["limit"] is None


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

        params_class = MCPToolParams.create_from_schema(schema)

        # 创建参数实例时使用字典方式，避免类型检查错误
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

        params_class = MCPToolParams.create_from_schema(schema)
        params = params_class()

        # 应该能够创建空参数实例
        assert params is not None
        params_dict = params.model_dump()


    def test_map_json_type_to_python(self):
        """测试 JSON 类型到 Python 类型的映射"""
        assert MCPToolParams._map_json_type_to_python("string") == str
        assert MCPToolParams._map_json_type_to_python("integer") == int
        assert MCPToolParams._map_json_type_to_python("number") == float
        assert MCPToolParams._map_json_type_to_python("boolean") == bool
        assert MCPToolParams._map_json_type_to_python("array") == list
        assert MCPToolParams._map_json_type_to_python("object") == dict
        assert MCPToolParams._map_json_type_to_python("unknown") == str  # 默认类型


class TestMCPTool:
    """测试 MCP 工具包装器"""

    @pytest.fixture
    def mock_manager(self):
        """创建模拟的 MCP 服务器管理器"""
        manager = Mock(spec=MCPServerManager)
        manager.call_mcp_tool = AsyncMock()
        return manager

    @pytest.fixture
    def tool_info(self):
        """创建测试用的工具信息"""
        return {
            "name": "mcp_a_search",
            "original_name": "search",
            "description": "MCP server [test-server] - 搜索工具",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索查询"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "结果数量"
                    }
                },
                "required": ["query"]
            },
            "server_name": "test-server",
            "session_letter": "a"
        }

    @pytest.fixture
    def complex_tool_info(self):
        """创建包含复杂嵌套结构的工具信息"""
        return {
            "name": "mcp_a_maps_schema_personal_map",
            "original_name": "maps_schema_personal_map",
            "description": "MCP server [高得地图] - 用于行程规划结果在高德地图展示",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "orgName": {
                        "type": "string",
                        "description": "行程规划地图小程序名称"
                    },
                    "lineList": {
                        "type": "array",
                        "description": "行程列表",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {
                                    "type": "string",
                                    "description": "行程名称描述（按行程顺序）"
                                },
                                "pointInfoList": {
                                    "type": "array",
                                    "description": "行程目标位置点描述",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "name": {
                                                "type": "string",
                                                "description": "行程目标位置点名称"
                                            },
                                            "lon": {
                                                "type": "number",
                                                "description": "行程目标位置点经度"
                                            },
                                            "lat": {
                                                "type": "number",
                                                "description": "行程目标位置点纬度"
                                            },
                                            "poiId": {
                                                "type": "string",
                                                "description": "行程目标位置点POIID"
                                            }
                                        },
                                        "required": ["name", "lon", "lat", "poiId"]
                                    }
                                }
                            },
                            "required": ["title", "pointInfoList"]
                        }
                    }
                },
                "required": ["orgName", "lineList"]
            },
            "server_name": "高得地图",
            "session_letter": "a"
        }

    @pytest.fixture
    def mcp_tool(self, tool_info, mock_manager):
        """创建 MCP 工具实例"""
        return MCPTool(tool_info, mock_manager)

    @pytest.fixture
    def complex_mcp_tool(self, complex_tool_info, mock_manager):
        """创建复杂嵌套结构的 MCP 工具实例"""
        return MCPTool(complex_tool_info, mock_manager)

    def test_mcp_tool_initialization(self, mcp_tool, tool_info):
        """测试 MCP 工具初始化"""
        assert mcp_tool.tool_info == tool_info
        assert mcp_tool.get_effective_name() == "mcp_a_search"
        assert mcp_tool.get_effective_description() == "MCP server [test-server] - 搜索工具"

        # 测试原始 schema 保存
        assert mcp_tool._original_schema == tool_info["inputSchema"]

        # 测试参数类创建
        params_class = mcp_tool.get_params_class()
        assert params_class is not None

        # 测试参数类功能
        params = params_class(output_file_path="test/output.json", query="test", limit=5)
        params_dict = params.model_dump()
        assert params_dict["query"] == "test"
        assert params_dict["limit"] == 5


    def test_to_param_simple(self, mcp_tool):
        """测试简单工具的 to_param 方法"""
        param_dict = mcp_tool.to_param()

        # 验证基本结构
        assert param_dict["type"] == "function"
        assert "function" in param_dict

        function_def = param_dict["function"]
        assert function_def["name"] == "mcp_a_search"
        assert function_def["description"] == "MCP server [test-server] - 搜索工具"

        # 验证参数结构
        parameters = function_def["parameters"]
        assert parameters["type"] == "object"
        assert "properties" in parameters
        assert "required" in parameters

        # 验证属性
        properties = parameters["properties"]
        assert "query" in properties
        assert "limit" in properties
        assert "output_file_path" in properties

        # 验证 query 属性（来自原始 schema）
        query_prop = properties["query"]
        assert query_prop["type"] == "string"
        assert query_prop["description"] == "搜索查询"

        # 验证 limit 属性（来自原始 schema）
        limit_prop = properties["limit"]
        assert limit_prop["type"] == "integer"
        assert limit_prop["description"] == "结果数量"

        # 验证 output_file_path 属性（来自 MCPToolParams 基类）
        output_file_prop = properties["output_file_path"]
        assert output_file_prop["type"] == "string"
        assert "description" in output_file_prop
        assert "工具结果输出到文件的路径" in output_file_prop["description"]

    def test_to_param_complex_nested_structure(self, complex_mcp_tool):
        """测试复杂嵌套结构的 to_param 方法"""
        param_dict = complex_mcp_tool.to_param()

        # 验证基本结构
        assert param_dict["type"] == "function"
        function_def = param_dict["function"]
        parameters = function_def["parameters"]
        properties = parameters["properties"]

        # 验证 lineList 数组类型保留了 items
        line_list_prop = properties["lineList"]
        assert line_list_prop["type"] == "array"
        assert line_list_prop["description"] == "行程列表"
        assert "items" in line_list_prop
        assert line_list_prop["items"] is not None
        assert isinstance(line_list_prop["items"], dict)

        # 验证数组 items 的 object 结构
        line_item = line_list_prop["items"]
        assert line_item["type"] == "object"
        assert "properties" in line_item
        assert "required" in line_item
        assert line_item["required"] == ["title", "pointInfoList"]

        # 验证嵌套的 object properties
        line_item_props = line_item["properties"]
        assert "title" in line_item_props
        assert "pointInfoList" in line_item_props

        # 验证嵌套数组的 items
        point_info_list = line_item_props["pointInfoList"]
        assert point_info_list["type"] == "array"
        assert "items" in point_info_list

        # 验证深层嵌套的 object
        point_item = point_info_list["items"]
        assert point_item["type"] == "object"
        assert "properties" in point_item
        assert "required" in point_item
        assert point_item["required"] == ["name", "lon", "lat", "poiId"]

        # 验证深层嵌套的属性
        point_props = point_item["properties"]
        assert "name" in point_props
        assert "lon" in point_props
        assert "lat" in point_props
        assert "poiId" in point_props

        # 验证具体属性类型
        assert point_props["name"]["type"] == "string"
        assert point_props["lon"]["type"] == "number"
        assert point_props["lat"]["type"] == "number"
        assert point_props["poiId"]["type"] == "string"

    def test_to_param_no_original_schema(self, mock_manager):
        """测试没有原始 schema 的情况"""
        tool_info = {
            "name": "mcp_b_simple",
            "original_name": "simple",
            "description": "简单工具",
            "inputSchema": {},
            "server_name": "test-server",
            "session_letter": "b"
        }

        mcp_tool = MCPTool(tool_info, mock_manager)
        param_dict = mcp_tool.to_param()

        # 应该返回基于父类的基础结构
        assert param_dict["type"] == "function"
        function_def = param_dict["function"]
        assert function_def["name"] == "mcp_b_simple"

        # 应该至少有 output_file_path 参数
        parameters = function_def["parameters"]
        properties = parameters["properties"]
        assert "output_file_path" in properties

    def test_merge_first_level_properties(self, mcp_tool):
        """测试第一层属性合并逻辑"""
        base_properties = {
            "query": {
                "type": "string",
                "description": "Base query description"
            },
            "output_file_path": {
                "type": "string",
                "description": "Base output_file_path description"
            }
        }

        original_properties = {
            "query": {
                "type": "string",
                "description": "Original query description",
                "maxLength": 100  # 额外属性
            },
            "limit": {
                "type": "integer",
                "description": "Original limit description"
            }
        }

        merged = mcp_tool._merge_first_level_properties(base_properties, original_properties)

        # 验证冲突处理：query 应该使用原始的
        assert merged["query"]["description"] == "Original query description"
        assert merged["query"]["maxLength"] == 100  # 原始的额外属性应该保留

        # 验证保留基础属性：output_file_path 应该保持不变
        assert merged["output_file_path"]["description"] == "Base output_file_path description"

        # 验证新增属性：limit 应该添加进来
        assert merged["limit"]["type"] == "integer"
        assert merged["limit"]["description"] == "Original limit description"

    def test_merge_preserves_base_description_when_original_missing(self, mcp_tool):
        """测试当原始属性缺少 description 时保留基础 description"""
        base_properties = {
            "query": {
                "type": "string",
                "description": "Base query description"
            }
        }

        original_properties = {
            "query": {
                "type": "string",
                # 没有 description
                "maxLength": 100
            }
        }

        merged = mcp_tool._merge_first_level_properties(base_properties, original_properties)

        # 应该保留基础的 description
        assert merged["query"]["description"] == "Base query description"
        assert merged["query"]["maxLength"] == 100

    @pytest.mark.asyncio
    async def test_execute_success(self, mcp_tool, mock_manager):
        """测试工具执行成功"""
        # 设置模拟返回值
        mock_manager.call_mcp_tool.return_value = ToolResult(content="搜索结果")

        # 创建工具上下文和参数
        tool_context = Mock(spec=ToolContext)
        params_class = mcp_tool.get_params_class()
        params = params_class(output_file_path="", query="test query", limit=10)

        # 执行工具
        result = await mcp_tool.execute(tool_context, params)

        # 验证结果
        assert isinstance(result, ToolResult)
        assert result.content == "搜索结果"
        assert result.ok == True

        # 验证管理器被正确调用
        mock_manager.call_mcp_tool.assert_called_once_with(
            "mcp_a_search",
            {"query": "test query", "limit": 10}
        )

    @pytest.mark.asyncio
    async def test_execute_with_none_values(self, mcp_tool, mock_manager):
        """测试执行时排除 None 值"""
        mock_manager.call_mcp_tool.return_value = ToolResult(content="结果")

        tool_context = Mock(spec=ToolContext)
        params_class = mcp_tool.get_params_class()
        params = params_class(output_file_path="", query="test", limit=None)  # limit 为 None

        result = await mcp_tool.execute(tool_context, params)

        # 验证 None 值被排除
        mock_manager.call_mcp_tool.assert_called_once_with(
            "mcp_a_search",
            {"query": "test"}  # 不包含 limit
        )

    @pytest.mark.asyncio
    async def test_execute_failure(self, mcp_tool, mock_manager):
        """测试工具执行失败"""
        # 设置管理器抛出异常
        mock_manager.call_mcp_tool.side_effect = Exception("连接失败")

        tool_context = Mock(spec=ToolContext)
        params_class = mcp_tool.get_params_class()
        params = params_class(output_file_path="", query="test")

        result = await mcp_tool.execute(tool_context, params)

        # 验证错误结果
        assert isinstance(result, ToolResult)
        assert result.ok == False
        assert "MCP 工具执行失败: 连接失败" in result.content

    @pytest.mark.asyncio
    async def test_execute_manager_returns_error(self, mcp_tool, mock_manager):
        """测试管理器返回错误结果"""
        # 设置管理器返回错误结果
        mock_manager.call_mcp_tool.return_value = ToolResult(content="工具调用失败", ok=False)

        tool_context = Mock(spec=ToolContext)
        params_class = mcp_tool.get_params_class()
        params = params_class(output_file_path="", query="test")

        result = await mcp_tool.execute(tool_context, params)

        # 验证结果传递
        assert isinstance(result, ToolResult)
        assert result.ok == False
        assert "工具调用失败" in result.content

    def test_string_representation(self, mcp_tool):
        """测试字符串表示"""
        str_repr = str(mcp_tool)
        assert "MCPTool" in str_repr
        assert "mcp_a_search" in str_repr
        assert "test-server" in str_repr

        repr_str = repr(mcp_tool)
        assert repr_str == str_repr

    def test_tool_with_no_input_schema(self, mock_manager):
        """测试没有输入 schema 的工具"""
        tool_info = {
            "name": "mcp_b_simple",
            "original_name": "simple",
            "description": "简单工具",
            "inputSchema": {},  # 空 schema
            "server_name": "test-server",
            "session_letter": "b"
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 应该能够创建参数类
        params_class = mcp_tool.get_params_class()
        assert params_class is not None

        # 应该能够创建空参数实例
        params = params_class()
        assert params is not None
        params_dict = params.model_dump()


    @pytest.mark.asyncio
    async def test_get_after_tool_call_friendly_action_and_remark(self, mcp_tool):
        """测试获取工具调用后的友好动作和备注"""
        # 创建模拟参数
        tool_context = Mock(spec=ToolContext)
        result = ToolResult(content="测试结果")
        execution_time = 1.5
        arguments = {"query": "test query", "limit": 10}

        # 调用方法
        action_and_remark = await mcp_tool.get_after_tool_call_friendly_action_and_remark(
            tool_name="mcp_a_search",
            tool_context=tool_context,
            result=result,
            execution_time=execution_time,
            arguments=arguments
        )

        # 验证返回值
        assert isinstance(action_and_remark, dict)
        assert "action" in action_and_remark
        assert "remark" in action_and_remark
        assert action_and_remark["action"] == "调用 MCP"
        assert action_and_remark["remark"] == "test-server"  # 应该返回 server_name

    @pytest.mark.asyncio
    async def test_get_after_tool_call_friendly_action_and_remark_no_server_name(self, mock_manager):
        """测试没有 server_name 时的默认值"""
        # 创建没有 server_name 的工具信息
        tool_info_no_server = {
            "name": "mcp_c_nosever",
            "original_name": "noserver",
            "description": "没有服务器名称的工具",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "查询"}
                },
                "required": ["query"]
            },
            "session_letter": "c"
            # 没有 server_name
        }

        mcp_tool_no_server = MCPTool(tool_info_no_server, mock_manager)

        # 创建模拟参数
        tool_context = Mock(spec=ToolContext)
        result = ToolResult(content="测试结果")
        execution_time = 1.0

        # 调用方法
        action_and_remark = await mcp_tool_no_server.get_after_tool_call_friendly_action_and_remark(
            tool_name="mcp_c_nosever",
            tool_context=tool_context,
            result=result,
            execution_time=execution_time,
            arguments=None
        )

        # 验证返回值
        assert isinstance(action_and_remark, dict)
        assert action_and_remark["action"] == "调用 MCP"
        assert action_and_remark["remark"] == "unknown"  # 应该返回默认值

    @pytest.mark.asyncio
    async def test_get_after_tool_call_friendly_action_and_remark_with_none_arguments(self, mcp_tool):
        """测试 arguments 为 None 的情况"""
        tool_context = Mock(spec=ToolContext)
        result = ToolResult(content="测试结果")
        execution_time = 2.0

        # 调用方法，arguments 为 None
        action_and_remark = await mcp_tool.get_after_tool_call_friendly_action_and_remark(
            tool_name="mcp_a_search",
            tool_context=tool_context,
            result=result,
            execution_time=execution_time,
            arguments=None
        )

        # 验证返回值
        assert isinstance(action_and_remark, dict)
        assert action_and_remark["action"] == "调用 MCP"
        assert action_and_remark["remark"] == "test-server"

    def test_get_effective_name_returns_full_mcp_name(self, mcp_tool):
        """测试 get_effective_name 返回完整的 MCP 工具名称（带前缀）"""
        # get_effective_name 应该返回完整的 MCP 工具名称，用于对外调用
        effective_name = mcp_tool.get_effective_name()
        assert effective_name == "mcp_a_search"  # 完整的 MCP 工具名称

        # 验证它确实是从 tool_info["name"] 获取的
        assert effective_name == mcp_tool.tool_info["name"]

        # 验证基础名称是 original_name
        assert mcp_tool.tool_info["original_name"] == "search"

    def test_get_effective_description_returns_real_description(self, mcp_tool):
        """测试 get_effective_description 返回真实工具描述"""
        effective_description = mcp_tool.get_effective_description()
        assert effective_description == "MCP server [test-server] - 搜索工具"

        # 验证它确实是从 tool_info 获取的
        assert effective_description == mcp_tool.tool_info["description"]

    async def test_get_tool_detail(self, mcp_tool):
        """测试 get_tool_detail 方法返回正确的MCP工具详情"""
        from agentlang.context.tool_context import ToolContext
        from agentlang.tools.tool_result import ToolResult
        from app.core.entity.message.server_message import DisplayType

        # 创建模拟的工具上下文和结果
        tool_context = ToolContext()
        result = ToolResult(content="搜索成功", execution_time=1.23)
        arguments = {"query": "test query", "limit": 10}

        # 调用方法
        tool_detail = await mcp_tool.get_tool_detail(tool_context, result, arguments)

        # 验证返回的工具详情
        assert tool_detail is not None
        assert tool_detail.type == DisplayType.MCP_TOOL_CALL

        # 验证数据结构
        data = tool_detail.data
        assert isinstance(data, dict)

        # 验证工具定义
        assert "tool_definition" in data
        tool_def = data["tool_definition"]
        assert tool_def["name"] == "mcp_a_search"
        assert tool_def["original_name"] == "search"
        assert tool_def["server_name"] == "test-server"
        assert tool_def["description"] == "MCP server [test-server] - 搜索工具"
        assert "input_schema" in tool_def

        # 验证输入参数
        assert "input_parameters" in data
        assert data["input_parameters"] == arguments

        # 验证执行结果
        assert "execution_result" in data
        exec_result = data["execution_result"]
        assert exec_result["status"] == "success"
        assert exec_result["execution_time"] == 1.23
        assert exec_result["content"] == "搜索成功"

    async def test_get_tool_detail_failed_result(self, mcp_tool):
        """测试 get_tool_detail 对失败结果返回 None"""
        from agentlang.context.tool_context import ToolContext
        from agentlang.tools.tool_result import ToolResult

        # 创建失败的结果
        tool_context = ToolContext()
        result = ToolResult(content="执行失败", ok=False)  # 明确设置 ok=False
        arguments = {"query": "test query"}

        # 调用方法
        tool_detail = await mcp_tool.get_tool_detail(tool_context, result, arguments)

        # 验证返回 None
        assert tool_detail is None

    async def test_get_tool_detail_no_arguments(self, mcp_tool):
        """测试 get_tool_detail 处理无参数的情况"""
        from agentlang.context.tool_context import ToolContext
        from agentlang.tools.tool_result import ToolResult
        from app.core.entity.message.server_message import DisplayType

        # 创建成功的结果但无参数
        tool_context = ToolContext()
        result = ToolResult(content="执行成功", execution_time=0.5)

        # 调用方法（不传递 arguments）
        tool_detail = await mcp_tool.get_tool_detail(tool_context, result)

        # 验证返回的工具详情
        assert tool_detail is not None
        assert tool_detail.type == DisplayType.MCP_TOOL_CALL

        # 验证输入参数为空字典
        data = tool_detail.data
        assert data["input_parameters"] == {}

    def test_validate_schema_no_parameters(self, mock_manager):
        """测试验证无参数工具的 schema（只有 type 和 required）"""
        # 无参数工具的 schema - 应该通过验证
        tool_info = {
            "name": "mcp_a_start_task",
            "original_name": "start_task",
            "description": "开始任务",
            "inputSchema": {
                "type": "object",
                "required": []
            },
            "server_name": "test-server",
            "session_letter": "a"
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 验证工具应该可用
        assert mcp_tool.is_available() is True
        assert mcp_tool._is_schema_valid is True

    def test_validate_schema_empty_properties(self, mock_manager):
        """测试验证有空 properties 字段的 schema"""
        tool_info = {
            "name": "mcp_a_empty_task",
            "original_name": "empty_task",
            "description": "空任务",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "required": []
            },
            "server_name": "test-server",
            "session_letter": "a"
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 验证工具应该可用
        assert mcp_tool.is_available() is True
        assert mcp_tool._is_schema_valid is True

    def test_validate_schema_with_parameters(self, mock_manager):
        """测试验证有参数工具的 schema（确保现有功能不受影响）"""
        tool_info = {
            "name": "mcp_a_search",
            "original_name": "search",
            "description": "搜索工具",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索查询"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "结果数量"
                    }
                },
                "required": ["query"]
            },
            "server_name": "test-server",
            "session_letter": "a"
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 验证工具应该可用
        assert mcp_tool.is_available() is True
        assert mcp_tool._is_schema_valid is True

    def test_validate_schema_invalid_array_without_items(self, mock_manager):
        """测试验证无效的 array 类型 schema（没有 items 字段）"""
        tool_info = {
            "name": "mcp_a_invalid_array",
            "original_name": "invalid_array",
            "description": "无效的数组工具",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "list_param": {
                        "type": "array",
                        "description": "缺少 items 字段的数组"
                        # 故意不包含 items 字段
                    }
                },
                "required": ["list_param"]
            },
            "server_name": "test-server",
            "session_letter": "a"
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 验证工具应该不可用
        assert mcp_tool.is_available() is False
        assert mcp_tool._is_schema_valid is False

    def test_validate_schema_nested_object(self, mock_manager):
        """测试验证嵌套对象的 schema"""
        tool_info = {
            "name": "mcp_a_nested_object",
            "original_name": "nested_object",
            "description": "嵌套对象工具",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "user": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "用户名"
                            },
                            "age": {
                                "type": "integer",
                                "description": "年龄"
                            }
                        },
                        "required": ["name"]
                    }
                },
                "required": ["user"]
            },
            "server_name": "test-server",
            "session_letter": "a"
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 验证工具应该可用
        assert mcp_tool.is_available() is True
        assert mcp_tool._is_schema_valid is True

    def test_validate_schema_nested_object_no_properties(self, mock_manager):
        """测试验证嵌套对象但没有 properties 字段的 schema（应该失败）"""
        tool_info = {
            "name": "mcp_a_nested_no_props",
            "original_name": "nested_no_props",
            "description": "嵌套对象但无属性",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "config": {
                        "type": "object",
                        "description": "配置对象",
                        "required": []
                        # 故意不包含 properties 字段
                    }
                },
                "required": ["config"]
            },
            "server_name": "test-server",
            "session_letter": "a"
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 验证工具应该不可用（嵌套对象没有 properties 字段是无效的）
        assert mcp_tool.is_available() is False
        assert mcp_tool._is_schema_valid is False


    @pytest.mark.asyncio
    async def test_get_tool_detail_includes_all_parameters(self, mock_manager, tool_info):
        """测试 get_tool_detail 方法包含所有参数"""
        mcp_tool = MCPTool(tool_info, mock_manager)

        # 创建模拟的工具上下文和执行结果
        tool_context = Mock(spec=ToolContext)
        result = ToolResult(content="Search results", ok=True, execution_time=1.5, name="mcp_a_search")

        # 模拟包含各种参数的参数字典
        arguments = {
            "query": "test search",
            "limit": 5,
            "output_file_path": "test/output.json",
            "next_plan": "I will analyze the search results"
        }

        # 调用 get_tool_detail 方法
        tool_detail = await mcp_tool.get_tool_detail(tool_context, result, arguments)

        # 验证返回的工具详情不为空
        assert tool_detail is not None

        # 获取工具详情数据
        tool_data = tool_detail.data

        # 验证 input_parameters 包含所有参数
        input_params = tool_data["input_parameters"]
        assert input_params["query"] == "test search"
        assert input_params["limit"] == 5
        assert input_params["output_file_path"] == "test/output.json"
        assert input_params["next_plan"] == "I will analyze the search results"

        # 验证其他数据结构正确
        assert tool_data["tool_definition"]["name"] == "mcp_a_search"
        assert tool_data["tool_definition"]["server_name"] == "test-server"
        assert tool_data["execution_result"]["status"] == "success"
        assert tool_data["execution_result"]["execution_time"] == 1.5

    @pytest.mark.asyncio
    async def test_get_tool_detail_with_empty_arguments(self, mock_manager, tool_info):
        """测试 get_tool_detail 方法处理空参数的情况"""
        mcp_tool = MCPTool(tool_info, mock_manager)

        tool_context = Mock(spec=ToolContext)
        result = ToolResult(content="No params result", ok=True, execution_time=0.5, name="mcp_a_search")

        # 测试 None 参数
        tool_detail = await mcp_tool.get_tool_detail(tool_context, result, None)
        assert tool_detail is not None
        assert tool_detail.data["input_parameters"] == {}

        # 测试空字典参数
        tool_detail = await mcp_tool.get_tool_detail(tool_context, result, {})
        assert tool_detail is not None
        assert tool_detail.data["input_parameters"] == {}

    @pytest.mark.asyncio
    async def test_get_tool_detail_failed_result(self, mock_manager, tool_info):
        """测试 get_tool_detail 方法处理失败结果的情况"""
        mcp_tool = MCPTool(tool_info, mock_manager)

        tool_context = Mock(spec=ToolContext)
        result = ToolResult(error="Tool execution failed", ok=False, execution_time=0.1, name="mcp_a_search")

        # 对于失败的结果，应该返回 None
        tool_detail = await mcp_tool.get_tool_detail(tool_context, result, {"query": "test"})
        assert tool_detail is None


class TestMCPToolServerOptions:
    """测试 MCP 工具的 server_options 相关功能"""

    @pytest.fixture
    def mock_manager(self):
        """创建模拟的管理器"""
        return Mock(spec=MCPServerManager)

    @pytest.fixture
    def tool_info_with_server_options(self):
        """创建包含 server_options 的工具信息"""
        return {
            "name": "mcp_a_call_magic_agent",
            "original_name": "call_magic_agent",
            "description": "MCP server [magic-server] - 调用魔法代理",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "查询内容"
                    }
                },
                "required": ["query"]
            },
            "server_name": "magic-server",
            "session_letter": "a",
            "server_options": {
                "label_name": "天书云文档",
                "tools": {
                    "call_magic_agent": {
                        "label_name": "调用 AI 助理",
                        "agents": [
                            {
                                "id": "123",
                                "name": "麦吉人事助理",
                                "description": "麦吉人事助理"
                            }
                        ]
                    }
                }
            }
        }

    @pytest.fixture
    def tool_info_invalid_server_options_null(self):
        """创建包含无效 server_options (null) 的工具信息"""
        return {
            "name": "mcp_a_search",
            "original_name": "search",
            "description": "MCP server [test-server] - 搜索工具",
            "inputSchema": {"type": "object", "properties": {}},
            "server_name": "test-server",
            "session_letter": "a",
            "server_options": None
        }

    @pytest.fixture
    def tool_info_invalid_server_options_array(self):
        """创建包含无效 server_options (array) 的工具信息"""
        return {
            "name": "mcp_a_search",
            "original_name": "search",
            "description": "MCP server [test-server] - 搜索工具",
            "inputSchema": {"type": "object", "properties": {}},
            "server_name": "test-server",
            "session_letter": "a",
            "server_options": []
        }

    @pytest.fixture
    def tool_info_invalid_server_options_string(self):
        """创建包含无效 server_options (string) 的工具信息"""
        return {
            "name": "mcp_a_search",
            "original_name": "search",
            "description": "MCP server [test-server] - 搜索工具",
            "inputSchema": {"type": "object", "properties": {}},
            "server_name": "test-server",
            "session_letter": "a",
            "server_options": ""
        }

    @pytest.fixture
    def tool_info_no_server_options(self):
        """创建不包含 server_options 的工具信息"""
        return {
            "name": "mcp_a_search",
            "original_name": "search",
            "description": "MCP server [test-server] - 搜索工具",
            "inputSchema": {"type": "object", "properties": {}},
            "server_name": "test-server",
            "session_letter": "a"
        }

    def test_parse_label_name_with_valid_server_options(self, tool_info_with_server_options, mock_manager):
        """测试从有效 server_options 中解析 label_name"""
        mcp_tool = MCPTool(tool_info_with_server_options, mock_manager)

        # 验证 label_name 被正确解析
        assert mcp_tool.label_name == "调用 AI 助理"

    def test_parse_label_name_with_null_server_options(self, tool_info_invalid_server_options_null, mock_manager):
        """测试 server_options 为 null 时的处理"""
        mcp_tool = MCPTool(tool_info_invalid_server_options_null, mock_manager)

        # 验证 label_name 为空字符串
        assert mcp_tool.label_name == ""

    def test_parse_label_name_with_array_server_options(self, tool_info_invalid_server_options_array, mock_manager):
        """测试 server_options 为数组时的处理"""
        mcp_tool = MCPTool(tool_info_invalid_server_options_array, mock_manager)

        # 验证 label_name 为空字符串
        assert mcp_tool.label_name == ""

    def test_parse_label_name_with_string_server_options(self, tool_info_invalid_server_options_string, mock_manager):
        """测试 server_options 为字符串时的处理"""
        mcp_tool = MCPTool(tool_info_invalid_server_options_string, mock_manager)

        # 验证 label_name 为空字符串
        assert mcp_tool.label_name == ""

    def test_parse_label_name_with_no_server_options(self, tool_info_no_server_options, mock_manager):
        """测试没有 server_options 时的处理"""
        mcp_tool = MCPTool(tool_info_no_server_options, mock_manager)

        # 验证 label_name 为空字符串
        assert mcp_tool.label_name == ""

    def test_parse_label_name_with_missing_tools(self, mock_manager):
        """测试 server_options 中缺少 tools 字段时的处理"""
        tool_info = {
            "name": "mcp_a_test",
            "original_name": "test",
            "description": "Test tool",
            "inputSchema": {"type": "object", "properties": {}},
            "server_name": "test-server",
            "session_letter": "a",
            "server_options": {
                "label_name": "服务器名称"
                # 缺少 tools 字段
            }
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 验证 label_name 为空字符串
        assert mcp_tool.label_name == ""

    def test_parse_label_name_with_invalid_tools(self, mock_manager):
        """测试 server_options 中 tools 字段为无效类型时的处理"""
        tool_info = {
            "name": "mcp_a_test",
            "original_name": "test",
            "description": "Test tool",
            "inputSchema": {"type": "object", "properties": {}},
            "server_name": "test-server",
            "session_letter": "a",
            "server_options": {
                "label_name": "服务器名称",
                "tools": "invalid_type"  # 应该是字典，这里是字符串
            }
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 验证 label_name 为空字符串
        assert mcp_tool.label_name == ""

    def test_parse_label_name_with_missing_tool_config(self, mock_manager):
        """测试 tools 中缺少当前工具配置时的处理"""
        tool_info = {
            "name": "mcp_a_test",
            "original_name": "test",
            "description": "Test tool",
            "inputSchema": {"type": "object", "properties": {}},
            "server_name": "test-server",
            "session_letter": "a",
            "server_options": {
                "label_name": "服务器名称",
                "tools": {
                    "other_tool": {
                        "label_name": "其他工具"
                    }
                    # 缺少 "test" 工具的配置
                }
            }
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 验证 label_name 为空字符串
        assert mcp_tool.label_name == ""

    def test_get_server_options_with_valid_options(self, tool_info_with_server_options, mock_manager):
        """测试获取有效的 server_options"""
        mcp_tool = MCPTool(tool_info_with_server_options, mock_manager)

        server_options = mcp_tool.get_server_options()

        # 验证返回的 server_options
        assert server_options is not None
        assert server_options["label_name"] == "天书云文档"
        assert "tools" in server_options
        assert "call_magic_agent" in server_options["tools"]

    def test_get_server_options_with_invalid_options(self, tool_info_invalid_server_options_null, mock_manager):
        """测试获取无效的 server_options"""
        mcp_tool = MCPTool(tool_info_invalid_server_options_null, mock_manager)

        server_options = mcp_tool.get_server_options()

        # 验证返回 None
        assert server_options is None

    def test_get_server_options_with_no_options(self, tool_info_no_server_options, mock_manager):
        """测试获取不存在的 server_options"""
        mcp_tool = MCPTool(tool_info_no_server_options, mock_manager)

        server_options = mcp_tool.get_server_options()

        # 验证返回 None
        assert server_options is None

    def test_process_mcp_tool_data_default_behavior(self, tool_info_with_server_options, mock_manager):
        """测试 _process_mcp_tool_data 方法的默认行为"""
        from agentlang.context.tool_context import ToolContext
        from agentlang.tools.tool_result import ToolResult

        mcp_tool = MCPTool(tool_info_with_server_options, mock_manager)

        # 创建测试数据
        tool_context = ToolContext()
        result = ToolResult(content="test result", execution_time=1.0)
        arguments = {"query": "test query"}

        original_data = {
            "tool_definition": {
                "name": "test_tool",
                "description": "Test tool"
            },
            "input_parameters": arguments,
            "execution_result": {
                "status": "success",
                "content": "test result"
            }
        }

        # 调用方法
        processed_data = mcp_tool._process_mcp_tool_data(
            original_data, tool_context, result, arguments
        )

        # 验证默认行为：直接返回原数据
        assert processed_data == original_data

    @pytest.mark.asyncio
    async def test_process_mcp_tool_data_call_magic_agent_with_valid_agent_id(self, mock_manager):
        """测试 call_magic_agent 工具使用有效 agent_id 的情况"""
        # 模拟 server_options 配置 - 使用新的对象格式
        server_options = {
            "tools": {
                "call_magic_agent": {
                    "label_name": "调用 AI 助理",
                    "agents": {
                        "123": {
                            "id": "123",
                            "name": "麦吉人事助理",
                            "description": "麦吉人事助理"
                        },
                        "456": {
                            "id": "456",
                            "name": "麦吉技术支持助理",
                            "description": "麦吉技术支持助理"
                        }
                    }
                }
            }
        }

        # 创建工具信息
        tool_info = {
            "name": "call_magic_agent",
            "original_name": "call_magic_agent",
            "description": "调用 AI 助理",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "agent_id": {"type": "string"},
                    "message": {"type": "string"}
                }
            },
            "server_name": "test-server",
            "server_options": server_options
        }

        # 创建工具实例
        mcp_tool = MCPTool(tool_info, mock_manager)

        # 创建 mcp_tool_data
        mcp_tool_data = {
            "tool_definition": {
                "name": "call_magic_agent",
                "original_name": "call_magic_agent",
                "label_name": "调用 AI 助理",
                "server_name": "test-server",
                "description": "调用 AI 助理",
                "input_schema": {}
            },
            "input_parameters": {"agent_id": "123", "message": "测试消息"},
            "execution_result": {
                "status": "success",
                "execution_time": 1.0,
                "tool_name": "call_magic_agent",
                "content": "执行成功"
            }
        }

        # 调用 _process_mcp_tool_data 方法
        from unittest.mock import Mock
        mock_tool_context = Mock()
        mock_tool_result = Mock()
        result = mcp_tool._process_mcp_tool_data(
            mcp_tool_data,
            mock_tool_context,
            mock_tool_result,
            {"agent_id": "123", "message": "测试消息"}
        )

        # 验证 label_name 被更新为对应的 agent name
        assert result["tool_definition"]["label_name"] == "麦吉人事助理"

    def test_process_mcp_tool_data_call_magic_agent_with_invalid_agent_id(self, mock_manager):
        """测试 call_magic_agent 工具使用无效 agent_id 的情况"""
        # 模拟 server_options 配置 - 使用新的对象格式
        server_options = {
            "tools": {
                "call_magic_agent": {
                    "label_name": "调用 AI 助理",
                    "agents": {
                        "123": {
                            "id": "123",
                            "name": "麦吉人事助理",
                            "description": "麦吉人事助理"
                        }
                    }
                }
            }
        }

        # 创建工具信息
        tool_info = {
            "name": "call_magic_agent",
            "original_name": "call_magic_agent",
            "description": "调用 AI 助理",
            "inputSchema": {},
            "server_name": "test-server",
            "server_options": server_options
        }

        # 创建工具实例
        mcp_tool = MCPTool(tool_info, mock_manager)

        # 创建 mcp_tool_data
        mcp_tool_data = {
            "tool_definition": {
                "name": "call_magic_agent",
                "original_name": "call_magic_agent",
                "label_name": "调用 AI 助理",
                "server_name": "test-server",
                "description": "调用 AI 助理",
                "input_schema": {}
            },
            "input_parameters": {"agent_id": "999", "message": "测试消息"},
            "execution_result": {
                "status": "success",
                "execution_time": 1.0,
                "tool_name": "call_magic_agent",
                "content": "执行成功"
            }
        }

        # 调用 _process_mcp_tool_data 方法
        from unittest.mock import Mock
        mock_tool_context = Mock()
        mock_tool_result = Mock()
        result = mcp_tool._process_mcp_tool_data(
            mcp_tool_data,
            mock_tool_context,
            mock_tool_result,
            {"agent_id": "999", "message": "测试消息"}
        )

        # 验证 label_name 保持不变
        assert result["tool_definition"]["label_name"] == "调用 AI 助理"

    def test_process_mcp_tool_data_other_tool_unchanged(self, mock_manager):
        """测试其他工具不受影响"""
        # 创建工具信息
        tool_info = {
            "name": "other_tool",
            "original_name": "other_tool",
            "description": "其他工具",
            "inputSchema": {},
            "server_name": "test-server",
            "server_options": {}
        }

        # 创建工具实例
        mcp_tool = MCPTool(tool_info, mock_manager)

        # 创建 mcp_tool_data
        mcp_tool_data = {
            "tool_definition": {
                "name": "other_tool",
                "original_name": "other_tool",
                "label_name": "其他工具",
                "server_name": "test-server",
                "description": "其他工具",
                "input_schema": {}
            },
            "input_parameters": {"param": "value"},
            "execution_result": {
                "status": "success",
                "execution_time": 1.0,
                "tool_name": "other_tool",
                "content": "执行成功"
            }
        }

        # 调用 _process_mcp_tool_data 方法
        from unittest.mock import Mock
        mock_tool_context = Mock()
        mock_tool_result = Mock()
        result = mcp_tool._process_mcp_tool_data(
            mcp_tool_data,
            mock_tool_context,
            mock_tool_result,
            {"param": "value"}
        )

        # 验证 label_name 保持不变
        assert result["tool_definition"]["label_name"] == "其他工具"

    def test_process_mcp_tool_data_call_magic_agent_no_arguments(self, mock_manager):
        """测试 call_magic_agent 工具没有参数的情况"""
        # 模拟 server_options 配置 - 使用新的对象格式
        server_options = {
            "tools": {
                "call_magic_agent": {
                    "label_name": "调用 AI 助理",
                    "agents": {
                        "123": {
                            "id": "123",
                            "name": "麦吉人事助理",
                            "description": "麦吉人事助理"
                        }
                    }
                }
            }
        }

        # 创建工具信息
        tool_info = {
            "name": "call_magic_agent",
            "original_name": "call_magic_agent",
            "description": "调用 AI 助理",
            "inputSchema": {},
            "server_name": "test-server",
            "server_options": server_options
        }

        # 创建工具实例
        mcp_tool = MCPTool(tool_info, mock_manager)

        # 创建 mcp_tool_data
        mcp_tool_data = {
            "tool_definition": {
                "name": "call_magic_agent",
                "original_name": "call_magic_agent",
                "label_name": "调用 AI 助理",
                "server_name": "test-server",
                "description": "调用 AI 助理",
                "input_schema": {}
            },
            "input_parameters": {},
            "execution_result": {
                "status": "success",
                "execution_time": 1.0,
                "tool_name": "call_magic_agent",
                "content": "执行成功"
            }
        }

        # 调用 _process_mcp_tool_data 方法（没有参数）
        from unittest.mock import Mock
        mock_tool_context = Mock()
        mock_tool_result = Mock()
        result = mcp_tool._process_mcp_tool_data(
            mcp_tool_data,
            mock_tool_context,
            mock_tool_result,
            None
        )

        # 验证 label_name 保持不变
        assert result["tool_definition"]["label_name"] == "调用 AI 助理"

    @pytest.mark.asyncio
    async def test_get_tool_detail_with_label_name(self, tool_info_with_server_options, mock_manager):
        """测试 get_tool_detail 方法包含 label_name 字段"""
        from agentlang.context.tool_context import ToolContext
        from agentlang.tools.tool_result import ToolResult
        from app.core.entity.message.server_message import DisplayType

        mcp_tool = MCPTool(tool_info_with_server_options, mock_manager)

        # 创建模拟的工具上下文和结果
        tool_context = ToolContext()
        result = ToolResult(content="执行成功", execution_time=1.5)
        arguments = {"query": "test query"}

        # 调用方法
        tool_detail = await mcp_tool.get_tool_detail(tool_context, result, arguments)

        # 验证返回的工具详情
        assert tool_detail is not None
        assert tool_detail.type == DisplayType.MCP_TOOL_CALL

        # 验证数据结构
        data = tool_detail.data
        assert isinstance(data, dict)

        # 验证工具定义中包含 label_name
        assert "tool_definition" in data
        tool_def = data["tool_definition"]
        assert tool_def["label_name"] == "调用 AI 助理"
        assert tool_def["name"] == "mcp_a_call_magic_agent"
        assert tool_def["original_name"] == "call_magic_agent"

    @pytest.mark.asyncio
    async def test_get_tool_detail_with_empty_label_name(self, tool_info_no_server_options, mock_manager):
        """测试 get_tool_detail 方法在没有 server_options 时 label_name 为空"""
        from agentlang.context.tool_context import ToolContext
        from agentlang.tools.tool_result import ToolResult
        from app.core.entity.message.server_message import DisplayType

        mcp_tool = MCPTool(tool_info_no_server_options, mock_manager)

        # 创建模拟的工具上下文和结果
        tool_context = ToolContext()
        result = ToolResult(content="执行成功", execution_time=1.0)
        arguments = {"query": "test query"}

        # 调用方法
        tool_detail = await mcp_tool.get_tool_detail(tool_context, result, arguments)

        # 验证返回的工具详情
        assert tool_detail is not None
        assert tool_detail.type == DisplayType.MCP_TOOL_CALL

        # 验证数据结构
        data = tool_detail.data
        assert isinstance(data, dict)

        # 验证工具定义中 label_name 为空字符串
        assert "tool_definition" in data
        tool_def = data["tool_definition"]
        assert tool_def["label_name"] == ""

    def test_safe_get_nested_value_valid_path(self, mock_manager):
        """测试 _safe_get_nested_value 方法使用有效路径"""
        tool_info = {
            "name": "test_tool",
            "original_name": "test_tool",
            "description": "测试工具",
            "inputSchema": {},
            "server_name": "test-server",
            "server_options": {}
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 测试数据
        test_data = {
            "tools": {
                "call_magic_agent": {
                    "agents": {
                        "123": {
                            "id": "123",
                            "name": "麦吉人事助理",
                            "description": "麦吉人事助理"
                        }
                    }
                }
            }
        }

        # 测试有效路径
        result = mcp_tool._safe_get_nested_value(test_data, "tools.call_magic_agent.agents.123.name")
        assert result == "麦吉人事助理"

        # 测试另一个有效路径
        result = mcp_tool._safe_get_nested_value(test_data, "tools.call_magic_agent.agents.123.id")
        assert result == "123"

    def test_safe_get_nested_value_invalid_path(self, mock_manager):
        """测试 _safe_get_nested_value 方法使用无效路径"""
        tool_info = {
            "name": "test_tool",
            "original_name": "test_tool",
            "description": "测试工具",
            "inputSchema": {},
            "server_name": "test-server",
            "server_options": {}
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 测试数据
        test_data = {
            "tools": {
                "call_magic_agent": {
                    "agents": {
                        "123": {
                            "id": "123",
                            "name": "麦吉人事助理"
                        }
                    }
                }
            }
        }

        # 测试不存在的路径
        result = mcp_tool._safe_get_nested_value(test_data, "tools.call_magic_agent.agents.999.name")
        assert result is None

        # 测试部分路径不存在
        result = mcp_tool._safe_get_nested_value(test_data, "tools.nonexistent.agents.123.name")
        assert result is None

        # 测试完全无效的路径
        result = mcp_tool._safe_get_nested_value(test_data, "completely.invalid.path")
        assert result is None

    def test_safe_get_nested_value_with_default(self, mock_manager):
        """测试 _safe_get_nested_value 方法使用默认值"""
        tool_info = {
            "name": "test_tool",
            "original_name": "test_tool",
            "description": "测试工具",
            "inputSchema": {},
            "server_name": "test-server",
            "server_options": {}
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 测试数据
        test_data = {"key": "value"}

        # 测试使用默认值
        result = mcp_tool._safe_get_nested_value(test_data, "nonexistent.path", "default_value")
        assert result == "default_value"

        # 测试使用数字默认值
        result = mcp_tool._safe_get_nested_value(test_data, "nonexistent.path", 42)
        assert result == 42

    def test_safe_get_nested_value_edge_cases(self, mock_manager):
        """测试 _safe_get_nested_value 方法的边界情况"""
        tool_info = {
            "name": "test_tool",
            "original_name": "test_tool",
            "description": "测试工具",
            "inputSchema": {},
            "server_name": "test-server",
            "server_options": {}
        }

        mcp_tool = MCPTool(tool_info, mock_manager)

        # 测试 None 数据
        result = mcp_tool._safe_get_nested_value(None, "any.path")
        assert result is None

        # 测试空字符串路径
        result = mcp_tool._safe_get_nested_value({"key": "value"}, "")
        assert result is None

        # 测试非字典数据
        result = mcp_tool._safe_get_nested_value("not_a_dict", "any.path")
        assert result is None

        # 测试单级路径
        result = mcp_tool._safe_get_nested_value({"key": "value"}, "key")
        assert result == "value"
