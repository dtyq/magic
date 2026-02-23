"""MCP 工具包装器

将 MCP 工具包装为标准的 BaseTool，实现动态参数类创建和工具执行。
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, Optional, Type

import aiofiles
from pydantic import Field, create_model

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.path_manager import PathManager
from app.tools.core.base_tool import BaseTool
from app.tools.core.base_tool_params import BaseToolParams

if TYPE_CHECKING:
    from app.core.entity.message.server_message import ToolDetail

    from .server_manager import MCPServerManager

logger = get_logger(__name__)


class MCPToolParams(BaseToolParams):
    """MCP 工具的动态参数类基础"""

    # 固定参数：输出文件路径
    output_file_path: str = Field(
        default="",
        description="工具结果输出到文件的路径，最好具有优雅的目录结构，文件必须是 json 格式。用于将工具的执行结果保存到指定文件中，避免大结果输出。建议在需要保留详细执行结果或结果可能很大时使用此参数，如 mysql 没有使用 WHERE 或 LIMIT 时可能返回上万行数据、查询文章详情等。如果不指定（为空），但工具结果很大时，系统会自动保存结果到工作区下。"
    )

    class Config:
        extra = "allow"  # 允许额外字段

    @classmethod
    def create_from_schema(cls, schema: Dict[str, Any]) -> Type["MCPToolParams"]:
        """从 MCP 工具的 inputSchema 创建参数类

        Args:
            schema: MCP 工具的 JSON Schema 定义

        Returns:
            Type[MCPToolParams]: 动态创建的参数类
        """
        # 确保 schema 不为 None 且为字典类型
        if not schema or not isinstance(schema, dict):
            schema = {}

        properties = schema.get("properties", {})
        required = schema.get("required", [])

        # 动态创建字段字典
        fields = {}
        annotations = {}

        for field_name, field_info in properties.items():
            field_description = field_info.get("description", "")

            # 根据 JSON Schema 类型映射到 Python 类型
            json_type = field_info.get("type", "string")
            field_type = cls._map_json_type_to_python(json_type)

            # 设置是否必填
            if field_name in required:
                annotations[field_name] = field_type
                fields[field_name] = Field(description=field_description)
            else:
                annotations[field_name] = Optional[field_type]
                fields[field_name] = Field(default=None, description=field_description)

        # 动态创建类
        return create_model(
            "MCPToolParams", __base__=cls, __module__=cls.__module__, __annotations__=annotations, **fields
        )

    @staticmethod
    def _map_json_type_to_python(json_type: str) -> Type:
        """将 JSON Schema 类型映射到 Python 类型

        Args:
            json_type: JSON Schema 类型字符串

        Returns:
            Type: 对应的 Python 类型
        """
        type_mapping = {
            "string": str,
            "integer": int,
            "number": float,
            "boolean": bool,
            "array": list,
            "object": dict,
        }
        return type_mapping.get(json_type, str)


class MCPTool(BaseTool):
    """MCP 工具包装器，将 MCP 工具转换为标准的 BaseTool

    支持从 server_options 中解析 label_name 等自定义配置，
    提供丰富的工具信息展示和特殊用法支持。
    """

    # 结果大小阈值，超过此大小将自动保存到文件
    RESULT_SIZE_THRESHOLD = 8 * 1024

    # MCP 输出目录名
    MCP_OUTPUT_DIR_NAME = "tool_outputs"

    def __init__(self, tool_info: Dict[str, Any], manager: "MCPServerManager"):
        """初始化 MCP 工具包装器

        Args:
            tool_info: MCP 工具信息，包含 name, description, inputSchema, server_options 等
            manager: MCP 服务器管理器实例
        """
        self.tool_info = tool_info
        self.manager = manager

        # 保存原始的 inputSchema
        self._original_schema = tool_info.get("inputSchema", {})

        # 验证 schema 有效性，设置可用性标志
        self._is_schema_valid = self._validate_schema(self._original_schema)

        # 动态创建参数类
        input_schema = tool_info.get("inputSchema", {})
        self._dynamic_params_class = MCPToolParams.create_from_schema(input_schema)

        # 解析 label_name
        self.label_name = self._parse_label_name()

        # 使用实例级别的名称和描述覆盖
        # name 使用固定值 "mcp_tool_call"，通过 get_effective_name() 获取完整的 MCP 名称
        super().__init__(name="mcp_tool_call", description=tool_info["description"])

        logger.debug(f"创建 MCP 工具包装器: {tool_info['name']} (schema_valid: {self._is_schema_valid}, label_name: {self.label_name})")

    def _parse_label_name(self) -> str:
        """解析工具的 label_name

        从 server_options 中的 tools 对象中查找当前工具的 label_name

        Returns:
            str: 工具的显示名称，如果没有找到则返回空字符串
        """
        server_options = self.tool_info.get("server_options")

        # 兼容各种无效情况：None, [], "", 非字典类型等
        if not server_options or not isinstance(server_options, dict):
            return ""

        tools = server_options.get("tools")
        if not tools or not isinstance(tools, dict):
            return ""

        # 获取原始工具名称
        original_name = self.tool_info.get("original_name", "")

        # 在 tools 对象中查找匹配的工具配置
        tool_config = tools.get(original_name)
        if isinstance(tool_config, dict):
            return tool_config.get("label_name", "")

        return ""

    def is_available(self) -> bool:
        """检查工具是否可用

        Returns:
            bool: 工具是否可用
        """
        return self._is_schema_valid

    def _validate_schema(self, schema: Dict[str, Any]) -> bool:
        """验证 MCP schema 是否符合 OpenAI 函数调用规范

        Args:
            schema: 要验证的 schema 字典

        Returns:
            bool: schema 是否有效
        """
        try:
            return self._validate_schema_recursive(schema, "root")
        except Exception as e:
            logger.warning(f"验证 MCP 工具 '{self.tool_info['name']}' schema 时出错: {e}")
            return False

    def _validate_schema_recursive(self, schema: Any, path: str) -> bool:
        """递归验证 schema 结构

        Args:
            schema: 要验证的 schema 节点
            path: 当前路径，用于错误报告

        Returns:
            bool: 当前节点是否有效
        """
        if not isinstance(schema, dict):
            return True

        schema_type = schema.get("type")

        if schema_type == "object":
            # 只有第一层（root level）的对象才允许没有 properties 字段（无参数工具的情况）
            # 嵌套的对象如果是 type: "object" 但没有 properties 字段，则是无效的 schema
            if path == "root":
                # 第一层对象可以没有 properties 字段，但如果有则需要验证
                if "properties" in schema:
                    properties = schema.get("properties", {})

                    # 递归验证 properties 中的每个字段
                    for prop_name, prop_schema in properties.items():
                        prop_path = f"{path}.properties.{prop_name}"
                        if not self._validate_schema_recursive(prop_schema, prop_path):
                            return False
            else:
                # 嵌套对象必须有 properties 字段
                if "properties" not in schema:
                    logger.warning(f"MCP 工具 '{self.tool_info['name']}' 在路径 '{path}' 处发现无效的嵌套 object 类型: 缺少 properties 字段")
                    return False

                properties = schema.get("properties", {})
                # 递归验证 properties 中的每个字段
                for prop_name, prop_schema in properties.items():
                    prop_path = f"{path}.properties.{prop_name}"
                    if not self._validate_schema_recursive(prop_schema, prop_path):
                        return False

        elif schema_type == "array":
            # array 类型必须有 items 字段
            if "items" not in schema:
                logger.warning(f"MCP 工具 '{self.tool_info['name']}' 在路径 '{path}' 处发现无效的 array 类型: 缺少 items 字段")
                return False

            # 递归验证 items 字段
            items_schema = schema.get("items")
            if not self._validate_schema_recursive(items_schema, f"{path}.items"):
                return False

        # 验证其他可能的嵌套结构
        for key in ["allOf", "anyOf", "oneOf"]:
            if key in schema:
                schema_list = schema[key]
                if isinstance(schema_list, list):
                    for i, sub_schema in enumerate(schema_list):
                        if not self._validate_schema_recursive(sub_schema, f"{path}.{key}[{i}]"):
                            return False

        return True

    def get_params_class(self) -> Type[BaseToolParams]:
        """获取工具参数类

        Returns:
            Type[BaseToolParams]: 工具参数类
        """
        return self._dynamic_params_class

    def get_effective_name(self) -> str:
        """获取最终生效的工具名称

        对于 MCP 工具，总是返回完整的 MCP 工具名称（带前缀），而不是原始名称

        Returns:
            str: 完整的 MCP 工具名称
        """
        # 对于 MCP 工具，总是返回完整的 MCP 工具名称
        return self.tool_info["name"]

    def get_server_options(self) -> Optional[Dict[str, Any]]:
        """获取服务器选项配置

        Returns:
            Optional[Dict[str, Any]]: 服务器选项配置，如果没有配置或配置无效则返回 None
        """
        server_options = self.tool_info.get("server_options")

        # 兼容各种无效情况：None, [], "", 非字典类型等
        if not server_options or not isinstance(server_options, dict):
            return None

        return server_options

    def to_param(self) -> Dict:
        """转换工具为函数调用格式，使用原始 MCP schema

        先使用父类方法获取基础结构，然后合并原始 schema 的嵌套信息

        Returns:
            Dict: 函数调用格式的工具描述
        """
        # 先获取父类生成的基础参数结构
        base_param = super().to_param()

        # 如果没有原始 schema，直接返回基础结构
        if not self._original_schema:
            return base_param

        # 获取基础参数中的 properties
        base_properties = base_param.get("function", {}).get("parameters", {}).get("properties", {})

        # 如果基础 properties 为空，直接返回
        if not base_properties:
            return base_param

        # 合并原始 schema 的属性信息（只处理第一层，以原始为准）
        if "properties" in self._original_schema:
            merged_properties = self._merge_first_level_properties(base_properties, self._original_schema["properties"])
            base_param["function"]["parameters"]["properties"] = merged_properties

        return base_param

    def _merge_first_level_properties(
        self, base_properties: Dict[str, Any], original_properties: Dict[str, Any]
    ) -> Dict[str, Any]:
        """合并第一层属性，以原始 schema 为准

        Args:
            base_properties: 父类生成的基础属性字典
            original_properties: 原始 MCP schema 的属性字典

        Returns:
            Dict[str, Any]: 合并后的属性字典
        """
        # 从基础属性开始
        merged = base_properties.copy()

        # 遍历原始属性，直接覆盖对应的基础属性（以原始为准）
        for prop_name, original_prop in original_properties.items():
            if prop_name in merged:
                # 如果基础属性中有这个字段，用原始的覆盖（保留基础的description如果原始没有）
                base_prop = merged[prop_name]
                merged_prop = original_prop.copy()

                # 如果原始没有description但基础有，保留基础的description
                if "description" not in merged_prop and "description" in base_prop:
                    merged_prop["description"] = base_prop["description"]

                merged[prop_name] = merged_prop
            else:
                # 如果基础属性中没有这个字段，直接添加
                merged[prop_name] = original_prop.copy()

        return merged

    async def execute(self, tool_context: ToolContext, params: BaseToolParams) -> ToolResult:
        """执行 MCP 工具

        Args:
            tool_context: 工具执行上下文
            params: 工具参数

        Returns:
            ToolResult: 工具执行结果
        """
        try:
            # 将参数转换为字典，排除 None 值
            all_params = params.model_dump(exclude_none=True)

            # 提取输出文件路径参数，确保默认为空字符串
            output_file_path = all_params.get("output_file_path", "") or ""

            # 只传递工具 schema 中定义的参数，排除 BaseToolParams 的基础字段和固定参数
            input_schema = self.tool_info.get("inputSchema", {})
            schema_properties = input_schema.get("properties", {})

            # 过滤出只属于工具 schema 的参数
            arguments = {key: value for key, value in all_params.items() if key in schema_properties}

            logger.info(f"执行 MCP 工具 '{self.get_effective_name()}'，参数: {arguments}")

            # 调用 MCP 管理器执行工具
            result = await self.manager.call_mcp_tool(self.tool_info["name"], arguments)

            # 检查是否需要将结果保存到文件
            if result.ok and self._should_save_to_file(result, output_file_path):
                try:
                    # 直接使用 _save_result_to_file 返回的 ToolResult
                    result = await self._save_result_to_file(result, output_file_path)
                except Exception as save_error:
                    logger.error(f"Failed to save MCP result to file: {save_error}")
                    # 继续返回原始结果，不因为保存失败而影响工具执行

            logger.debug(f"MCP 工具 '{self.get_effective_name()}' 执行完成")
            return result

        except Exception as e:
            error_msg = f"MCP 工具执行失败: {e}"
            logger.warning(f"执行 MCP 工具 '{self.get_effective_name()}' 失败: {e}")
            return ToolResult(error=error_msg)  # type: ignore

    def __str__(self) -> str:
        """字符串表示"""
        server_name = self.tool_info.get("server_name", "unknown")
        return f"MCPTool(name='{self.get_effective_name()}', server='{server_name}')"

    def __repr__(self) -> str:
        """详细字符串表示"""
        return self.__str__()

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: Optional[Dict[str, Any]] = None
    ) -> Dict:
        """
        获取工具调用前的友好动作和备注

        Args:
            tool_name: 工具名称
            tool_context: 工具上下文
            arguments: 执行参数

        Returns:
            Dict: 包含action、remark和tool_name的字典
        """
        server_name = self.tool_info.get("server_name", "unknown")
        return {"tool_name": "mcp_tool_call", "action": "调用 MCP", "remark": server_name}

    async def get_before_tool_detail(
        self, tool_context: ToolContext, arguments: Optional[Dict[str, Any]] = None
    ) -> Optional["ToolDetail"]:
        """
        获取工具调用前的详细信息，展示MCP工具的定义和入参

        Args:
            tool_context: 工具上下文
            arguments: 工具执行的参数字典

        Returns:
            Optional[ToolDetail]: 工具详情对象，包含tool_definition和input_parameters
        """
        from app.core.entity.message.server_message import DisplayType, ToolDetail

        # 构建MCP工具详情的JSON数据（仅包含定义和输入参数）
        mcp_tool_data = {
            "tool_definition": {
                "name": self.get_effective_name(),
                "original_name": self.tool_info.get("original_name", self.get_effective_name()),
                "label_name": self.label_name,
                "server_name": self.tool_info.get("server_name", "unknown"),
                "description": self.tool_info.get("description", ""),
                "input_schema": self.tool_info.get("inputSchema", {}),
            },
            "input_parameters": arguments or {},
        }

        # 返回工具详情
        return ToolDetail(type=DisplayType.MCP_TOOL_CALL, data=mcp_tool_data)

    def _get_mcp_output_dir(self) -> Path:
        """获取 MCP 输出目录路径

        Returns:
            Path: MCP 输出目录路径
        """
        output_dir = PathManager.get_workspace_dir() / self.MCP_OUTPUT_DIR_NAME
        output_dir.mkdir(exist_ok=True)
        return output_dir

    def _generate_output_filename(self, tool_name: str) -> str:
        """生成输出文件名

        Args:
            tool_name: 工具名称

        Returns:
            str: 生成的文件名，格式为 {tool_name}_{timestamp}.json
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        # 清理工具名中的特殊字符
        clean_tool_name = "".join(c for c in (tool_name or "") if c.isalnum() or c in "-_")
        # 如果清理后的工具名为空，使用默认名称
        if not clean_tool_name:
            clean_tool_name = "mcp_tool"
        return f"{clean_tool_name}_{timestamp}.json"

    def _get_result_size(self, result: ToolResult) -> int:
        """获取结果大小（字节）

        Args:
            result: 工具执行结果

        Returns:
            int: 结果大小（字节）
        """
        if not result.content:
            return 0
        return len(str(result.content).encode('utf-8'))

    def _should_save_to_file(self, result: ToolResult, output_file_path: str) -> bool:
        """判断是否应该将结果保存到文件

        Args:
            result: 工具执行结果
            output_file_path: 用户指定的输出文件路径

        Returns:
            bool: 是否应该保存到文件
        """
        # 如果用户指定了输出路径（非空），则保存
        if output_file_path.strip():
            return True

        # 如果结果大小超过阈值，则自动保存
        result_size = self._get_result_size(result)
        return result_size > self.RESULT_SIZE_THRESHOLD

    async def _save_result_to_file(self, result: ToolResult, output_file_path: str) -> ToolResult:
        """将结果保存到文件并返回包含文件信息的 ToolResult

        Args:
            result: 工具执行结果
            output_file_path: 输出文件路径，如果为空则使用默认路径

        Returns:
            ToolResult: 包含文件路径和说明的 JSON 字符串结果
        """
        try:
            workspace_dir = PathManager.get_workspace_dir()

            reason = ""
            if output_file_path.strip():
                # 使用用户指定的相对路径（相对于 workspace）
                # 清理路径中的危险字符和路径遍历
                clean_path = output_file_path.strip().replace('..', '').replace('//', '/')
                if clean_path.startswith('/'):
                    clean_path = clean_path[1:]  # 移除开头的斜杠

                file_path = workspace_dir / clean_path
                # 确保文件路径仍在 workspace 内（安全检查）
                try:
                    file_path.resolve().relative_to(workspace_dir.resolve())
                except ValueError:
                    # 如果路径不在 workspace 内，使用默认路径
                    logger.warning(f"Unsafe file path detected: {output_file_path}, using default path")
                    output_dir = self._get_mcp_output_dir()
                    filename = self._generate_output_filename(self.get_effective_name())
                    file_path = output_dir / filename
                    reason = "路径不安全，已使用默认路径保存"
                else:
                    # 确保目录存在
                    file_path.parent.mkdir(parents=True, exist_ok=True)
                    reason = "指定保存到文件"

                # 检查文件是否存在，如果存在则在文件名后增加时间戳
                if file_path.exists():
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    stem = file_path.stem
                    suffix = file_path.suffix
                    new_name = f"{stem}_{timestamp}{suffix}"
                    file_path = file_path.parent / new_name
            else:
                # 使用默认路径
                output_dir = self._get_mcp_output_dir()
                filename = self._generate_output_filename(self.get_effective_name())
                file_path = output_dir / filename

                # 检查文件是否存在，如果存在则在文件名后增加时间戳
                if file_path.exists():
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    stem = file_path.stem
                    suffix = file_path.suffix
                    new_name = f"{stem}_{timestamp}{suffix}"
                    file_path = file_path.parent / new_name

                reason = "输出内容过长，已自动保存结果为文件，如需详情请读取该文件"

            # 尝试解析 content 中的 JSON 字符串
            parsed_content = self._parse_json_content(result.content)

            # 构建保存的数据
            output_data = {
                "tool_name": self.tool_info.get("original_name", self.get_effective_name()),
                "server_name": self.tool_info.get("server_name", "unknown"),
                "timestamp": datetime.now().isoformat(),
                "result_size_bytes": self._get_result_size(result),
                "execution_time": result.execution_time or 0.0,
                "status": "success" if result.ok else "failed",
                "result": parsed_content
            }

            # 异步保存到文件
            async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(output_data, ensure_ascii=False, indent=2))

            logger.info(f"MCP tool result saved to file: {file_path}")

            # 构建返回的 JSON 字筆串
            result_size = self._get_result_size(result)

            # 获取相对于 workspace 的路径
            relative_path = file_path.relative_to(workspace_dir)

            file_info = {
                "output_file_path": str(relative_path),
                "reason": reason,
                "file_size": result_size,
                "tool_name": self.tool_info.get("original_name", self.get_effective_name()),
                "server_name": self.tool_info.get("server_name", "unknown"),
                "timestamp": datetime.now().isoformat(),
                "status": "success" if result.ok else "failed"
            }

            return ToolResult(
                content=json.dumps(file_info, ensure_ascii=False, indent=2),
                ok=result.ok,
                name=result.name,
                execution_time=result.execution_time
            )

        except Exception as e:
            logger.error(f"Failed to save MCP result to file: {e}")
            raise

    def _parse_json_content(self, content: Any) -> Any:
        """尝试解析内容中的 JSON 字符串

        如果内容是有效的 JSON 字符串，则解析为对象；否则返回原内容

        Args:
            content: 原始内容

        Returns:
            Any: 解析后的内容（如果是 JSON）或原始内容
        """
        # 只处理字符串类型的内容
        if not isinstance(content, str):
            return content

        try:
            # 直接尝试解析 JSON
            parsed = json.loads(content.strip())
            logger.debug(f"Successfully parsed JSON content for MCP tool result")
            return parsed
        except (json.JSONDecodeError, ValueError) as e:
            # 解析失败，返回原内容
            logger.debug(f"Failed to parse content as JSON: {e}")
            return content

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Optional[Dict[str, Any]] = None,
    ) -> Dict:
        """
        获取工具调用后的友好动作和备注

        Args:
            tool_name: 工具名称
            tool_context: 工具上下文
            result: 工具执行结果
            execution_time: 执行耗时
            arguments: 执行参数

        Returns:
            Dict: 包含action和remark的字典
        """
        server_name = self.tool_info.get("server_name", "unknown")
        return {"tool_name":"mcp_tool_call", "action": "调用 MCP", "remark": server_name}



    def _safe_get_nested_value(self, data: Any, path: str, default: Any = None) -> Any:
        """
        安全地获取嵌套字典/对象的值

        Args:
            data: 要查询的数据
            path: 点分隔的路径，如 "tools.call_magic_agent.agents.123.name"
            default: 默认值

        Returns:
            Any: 获取到的值或默认值
        """
        try:
            if not path:
                return default

            keys = path.split('.')
            current = data

            for key in keys:
                if isinstance(current, dict) and key in current:
                    current = current[key]
                else:
                    return default

            return current
        except (AttributeError, TypeError, KeyError):
            return default

    def _process_mcp_tool_data(
        self,
        mcp_tool_data: Dict[str, Any],
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        处理 MCP 工具数据，可以被子类重写以实现特殊功能

        Args:
            mcp_tool_data: MCP工具数据字典
            tool_context: 工具上下文
            result: 工具执行结果
            arguments: 工具执行参数

        Returns:
            Dict[str, Any]: 处理后的 MCP 工具数据
        """
        # 处理 call_magic_agent 工具的特殊逻辑
        original_name = self.tool_info.get("original_name", "")
        if original_name == "call_magic_agent" and arguments:
            # 获取 agent_id 参数
            agent_id = arguments.get("agent_id")
            if agent_id:
                # 获取 server_options 配置
                server_options = self.get_server_options()
                if server_options:
                    # 一步到位地获取 agent 名称
                    agent_name = self._safe_get_nested_value(
                        server_options,
                        f"tools.call_magic_agent.agents.{agent_id}.name"
                    )

                    if agent_name:
                        # 更新 label_name 为 agent 的 name
                        if "tool_definition" in mcp_tool_data:
                            mcp_tool_data["tool_definition"]["label_name"] = agent_name

        return mcp_tool_data

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Optional[Dict[str, Any]] = None
    ) -> Optional["ToolDetail"]:
        """
        根据工具执行结果获取对应的ToolDetail，展示MCP工具的详细信息

        Args:
            tool_context: 工具上下文
            result: 工具执行的结果
            arguments: 工具执行的参数字典

        Returns:
            Optional[ToolDetail]: 工具详情对象，展示MCP工具的入参、出参和定义
        """
        from app.core.entity.message.server_message import DisplayType, ToolDetail

        if not result.ok:
            return None

        # 构建MCP工具详情的JSON数据
        mcp_tool_data = {
            "tool_definition": {
                "name": self.get_effective_name(),
                "original_name": self.tool_info.get("original_name", self.get_effective_name()),
                "label_name": self.label_name, # 自定义的显示名称
                "server_name": self.tool_info.get("server_name", "unknown"),
                "description": self.tool_info.get("description", ""),
                "input_schema": self.tool_info.get("inputSchema", {}),
            },
            "input_parameters": arguments or {},
            "execution_result": {
                "status": "success" if result.ok else "failed",
                "execution_time": result.execution_time,
                "tool_name": result.name or "",
                "content": result.content or "",
            },
        }

        # 处理工具数据（可以被子类重写）
        mcp_tool_data = self._process_mcp_tool_data(mcp_tool_data, tool_context, result, arguments)

        # 返回工具详情
        return ToolDetail(type=DisplayType.MCP_TOOL_CALL, data=mcp_tool_data)
