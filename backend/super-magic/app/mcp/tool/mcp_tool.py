"""MCP 工具包装器

将 MCP 工具适配为标准 BaseTool，实现：
- 动态参数类创建（委托给 params.py）
- Schema 有效性验证（委托给 schema_validator.py）
- 工具执行与结果落盘（委托给 result_saver.py）
- before/after 工具详情展示
"""

from typing import TYPE_CHECKING, Any, Dict, Optional, Type

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult

from app.tools.core.base_tool import BaseTool
from app.tools.core.base_tool_params import BaseToolParams

from .params import MCPToolParams
from .schema_validator import validate_mcp_schema
from . import result_saver

if TYPE_CHECKING:
    from app.core.entity.message.server_message import ToolDetail
    from ..connection.server_manager import MCPServerManager

logger = get_logger(__name__)


class MCPTool(BaseTool):
    """MCP 工具包装器，将 MCP 工具转换为标准 BaseTool

    支持从 server_options 中解析 label_name 等自定义配置，
    提供工具调用前后的详情展示。
    """

    def __init__(self, tool_info: Dict[str, Any], manager: "MCPServerManager"):
        """初始化 MCP 工具包装器

        Args:
            tool_info: MCP 工具信息字典（name, description, inputSchema, server_options 等）
            manager: MCP 服务器管理器实例，用于实际调用
        """
        self.tool_info = tool_info
        self.manager = manager
        self._original_schema = tool_info.get("inputSchema", {})
        self._is_schema_valid = validate_mcp_schema(self._original_schema, tool_info.get("name", ""))
        self._dynamic_params_class = MCPToolParams.create_from_schema(self._original_schema)
        self.label_name = self._parse_label_name()

        super().__init__(name="mcp_tool_call", description=tool_info["description"])

        logger.debug(
            f"创建 MCP 工具包装器: {tool_info['name']} "
            f"(schema_valid: {self._is_schema_valid}, label_name: {self.label_name})"
        )

    def is_available(self) -> bool:
        """schema 验证通过时工具才可用"""
        return self._is_schema_valid

    def get_params_class(self) -> Type[BaseToolParams]:
        return self._dynamic_params_class

    def get_effective_name(self) -> str:
        """返回完整的 MCP 工具名称（带前缀）"""
        return self.tool_info["name"]

    def get_server_options(self) -> Optional[Dict[str, Any]]:
        """获取服务器选项配置，无效时返回 None"""
        server_options = self.tool_info.get("server_options")
        if not server_options or not isinstance(server_options, dict):
            return None
        return server_options

    def to_param(self) -> Dict:
        """生成函数调用格式的工具描述，合并原始 MCP schema 的嵌套信息"""
        base_param = super().to_param()
        if not self._original_schema:
            return base_param

        base_properties = base_param.get("function", {}).get("parameters", {}).get("properties", {})
        if not base_properties:
            return base_param

        if "properties" in self._original_schema:
            merged = self._merge_first_level_properties(
                base_properties, self._original_schema["properties"]
            )
            base_param["function"]["parameters"]["properties"] = merged

        return base_param

    async def execute(self, tool_context: ToolContext, params: BaseToolParams) -> ToolResult:
        """执行 MCP 工具

        过滤参数 → 调用管理器 → 按需落盘结果。
        """
        try:
            all_params = params.model_dump(exclude_none=True)
            output_file_path = all_params.get("output_file_path", "") or ""

            schema_properties = self._original_schema.get("properties", {})
            arguments = {k: v for k, v in all_params.items() if k in schema_properties}

            logger.info(f"执行 MCP 工具 '{self.get_effective_name()}'，参数: {arguments}")

            result = await self.manager.call_mcp_tool(self.tool_info["name"], arguments)

            if result.ok and result_saver.should_save_to_file(result, output_file_path):
                try:
                    result = await result_saver.save_result_to_file(
                        result=result,
                        output_file_path=output_file_path,
                        tool_original_name=self.tool_info.get("original_name", self.get_effective_name()),
                        tool_full_name=self.get_effective_name(),
                        server_name=self.tool_info.get("server_name", "unknown"),
                    )
                except Exception as save_error:
                    logger.error(f"Failed to save MCP result to file: {save_error}")
                    # 落盘失败不影响工具执行结果

            logger.debug(f"MCP 工具 '{self.get_effective_name()}' 执行完成")
            return result

        except Exception as e:
            logger.warning(f"执行 MCP 工具 '{self.get_effective_name()}' 失败: {e}")
            return ToolResult.error(f"MCP 工具执行失败: {e}")  # type: ignore

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: Optional[Dict[str, Any]] = None,
    ) -> Dict:
        server_name = self.tool_info.get("server_name", "unknown")
        return {"tool_name": "mcp_tool_call", "action": "调用 MCP", "remark": server_name}

    async def get_before_tool_detail(
        self, tool_context: ToolContext, arguments: Optional[Dict[str, Any]] = None
    ) -> Optional["ToolDetail"]:
        """调用前工具详情：展示工具定义和入参"""
        from app.core.entity.message.server_message import DisplayType, ToolDetail

        data = {
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
        return ToolDetail(type=DisplayType.MCP_TOOL_CALL, data=data)

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Optional[Dict[str, Any]] = None,
    ) -> Dict:
        server_name = self.tool_info.get("server_name", "unknown")
        return {"tool_name": "mcp_tool_call", "action": "调用 MCP", "remark": server_name}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Optional[Dict[str, Any]] = None
    ) -> Optional["ToolDetail"]:
        """调用后工具详情：展示工具定义、入参和执行结果"""
        from app.core.entity.message.server_message import DisplayType, ToolDetail

        if not result.ok:
            return None

        data = {
            "tool_definition": {
                "name": self.get_effective_name(),
                "original_name": self.tool_info.get("original_name", self.get_effective_name()),
                "label_name": self.label_name,
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
        return ToolDetail(type=DisplayType.MCP_TOOL_CALL, data=data)

    def __str__(self) -> str:
        server_name = self.tool_info.get("server_name", "unknown")
        return f"MCPTool(name='{self.get_effective_name()}', server='{server_name}')"

    def __repr__(self) -> str:
        return self.__str__()

    # ------------------------------------------------------------------ #
    # 内部辅助                                                             #
    # ------------------------------------------------------------------ #

    def _parse_label_name(self) -> str:
        """从 server_options.tools.{original_name}.label_name 解析显示名称"""
        server_options = self.tool_info.get("server_options")
        if not server_options or not isinstance(server_options, dict):
            return ""

        tools = server_options.get("tools")
        if not tools or not isinstance(tools, dict):
            return ""

        original_name = self.tool_info.get("original_name", "")
        tool_config = tools.get(original_name)
        if isinstance(tool_config, dict):
            return tool_config.get("label_name", "")
        return ""

    def _merge_first_level_properties(
        self, base: Dict[str, Any], original: Dict[str, Any]
    ) -> Dict[str, Any]:
        """合并第一层属性：以原始 MCP schema 为准，保留基础属性中有而原始没有的 description"""
        merged = base.copy()
        for prop_name, orig_prop in original.items():
            if prop_name in merged:
                base_prop = merged[prop_name]
                merged_prop = orig_prop.copy()
                if "description" not in merged_prop and "description" in base_prop:
                    merged_prop["description"] = base_prop["description"]
                merged[prop_name] = merged_prop
            else:
                merged[prop_name] = orig_prop.copy()
        return merged
