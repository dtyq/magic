# app/tools/remote/remote_tool.py
"""远程工具包装器

将远程工具包装为标准的 BaseTool，实现动态参数类创建和工具执行。
完全模仿 mcp_tool.py 的实现模式。
"""

from typing import TYPE_CHECKING, Any, Dict, Optional, Type

from pydantic import Field, create_model

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.tools.core.base_tool import BaseTool
from app.tools.core.base_tool_params import BaseToolParams
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.tool_execute_parameter import ToolExecuteParameter

if TYPE_CHECKING:
    from app.infrastructure.sdk.magic_service.result.agent_details_result import Tool

logger = get_logger(__name__)


class RemoteToolParams(BaseToolParams):
    class Config:
        extra = "allow"  # 允许额外字段

    @classmethod
    def create_from_schema(cls, schema: Dict[str, Any]) -> Type["RemoteToolParams"]:
        """从远程工具的 schema 创建参数类

        Args:
            schema: 远程工具的 JSON Schema 定义

        Returns:
            Type[RemoteToolParams]: 动态创建的参数类
        """
        # 检查schema是否为有效的字典类型
        if not isinstance(schema, dict):
            error_msg = f"无效的远程工具schema: 期望字典类型，实际为 {type(schema).__name__}: {schema}"
            logger.error(error_msg)
            raise ValueError(error_msg)

        properties = schema.get("properties", {})
        required = schema.get("required", [])

        # 动态创建字段，使用pydantic 2.x正确格式
        field_definitions = {}

        for field_name, field_info in properties.items():
            field_description = field_info.get("description", "")

            # 根据 JSON Schema 类型映射到 Python 类型
            field_type = cls._get_python_type(field_info)

            # 判断是否为必需字段
            is_required = field_name in required

            if is_required:
                field_definitions[field_name] = (field_type, Field(description=field_description))
            else:
                field_definitions[field_name] = (field_type, Field(default=None, description=field_description))

        # 动态创建类
        dynamic_class = create_model(
            "DynamicRemoteToolParams",
            __base__=cls,
            __module__=cls.__module__,
            **field_definitions
        )

        return dynamic_class

    @classmethod
    def _get_python_type(cls, field_info: Dict[str, Any]) -> Type:
        """根据 JSON Schema 类型映射到 Python 类型"""
        schema_type = field_info.get("type", "string")

        if schema_type == "string":
            return str
        elif schema_type == "integer":
            return int
        elif schema_type == "number":
            return float
        elif schema_type == "boolean":
            return bool
        elif schema_type == "array":
            return list
        elif schema_type == "object":
            return dict
        else:
            return Any


class RemoteTool(BaseTool):
    """远程工具包装器类，模仿 MCPTool 实现"""

    def __init__(self, tool_info: "Tool"):
        """初始化远程工具

        Args:
            tool_info: 从 API 获取的工具信息对象
        """
        self.tool_info = tool_info
        self.tool_code = tool_info.code

        # 保存原始 schema
        self._original_schema = tool_info.get_schema() or {}

        # 验证 schema 有效性
        self._is_schema_valid = self._validate_schema(self._original_schema)

        # 动态创建参数类
        self._dynamic_params_class = RemoteToolParams.create_from_schema(self._original_schema)

        # 添加 tool_schema 属性用于兼容性
        self.tool_schema = self._original_schema

        # 调用父类构造函数
        super().__init__(
            name=f"remote_{tool_info.code}",
            description=tool_info.description or f"Remote tool: {tool_info.name}"
        )

        logger.debug(f"创建远程工具包装器: {tool_info.code} (schema_valid: {self._is_schema_valid})")

    def _validate_schema(self, schema: Dict[str, Any]) -> bool:
        """验证远程工具 schema 是否有效"""
        try:
            # 简单验证：检查是否为字典类型
            return isinstance(schema, dict)
        except Exception as e:
            logger.warning(f"验证远程工具 '{self.tool_code}' schema 时出错: {e}")
            return False

    def is_available(self) -> bool:
        """检查工具是否可用（有有效的schema）"""
        return self._is_schema_valid and (
            self.tool_schema is not None
            and isinstance(self.tool_schema, dict)
            and len(self.tool_schema) > 0
        )

    @property
    def name(self) -> str:
        """获取工具名称"""
        return self._custom_name if hasattr(self, '_custom_name') and self._custom_name is not None else f"remote_{self.tool_code}"

    @property
    def description(self) -> str:
        """获取工具描述"""
        return self._custom_description if hasattr(self, '_custom_description') and self._custom_description is not None else (self.tool_info.description or f"Remote tool: {self.tool_info.name}")

    def get_effective_name(self) -> str:
        """获取有效的工具名称"""
        return self.tool_info.name if self.tool_info.name else self.tool_code

    def get_params_class(self) -> Type[BaseToolParams]:
        """获取动态创建的参数类

        Returns:
            Type[BaseToolParams]: 动态创建的参数类
        """
        return self._dynamic_params_class

    async def execute(self, tool_context: ToolContext, params: BaseToolParams) -> ToolResult:
        """执行远程工具

        Args:
            tool_context: 工具执行上下文
            params: 工具参数

        Returns:
            ToolResult: 工具执行结果
        """
        try:
            # 将参数转换为字典，排除 None 值
            all_params = params.model_dump(exclude_none=True)

            # 只传递工具 schema 中定义的参数
            schema_properties = self._original_schema.get("properties", {})
            arguments = {key: value for key, value in all_params.items()
                        if key in schema_properties}

            logger.info(f"执行远程工具 '{self.get_effective_name()}'，参数: {arguments}")

            # 获取 MagicService API
            magic_api = get_magic_service_sdk()

            # 准备执行参数
            parameter = ToolExecuteParameter(
                code=self.tool_code,
                arguments=arguments
            )

            # 调用远程 API
            result = await magic_api.agent.execute_tool_async(parameter)

            # 如果能拿到result，说明API调用成功（错误会在_process_magic_service_response中抛出异常）
            logger.debug(f"远程工具 '{self.get_effective_name()}' 执行成功")

            # 将完整的API结果对象JSON化返回，保留所有结构化信息
            return ToolResult(content=result.to_string())

        except Exception as e:
            error_msg = f"远程工具执行异常: {str(e)}"
            logger.error(f"执行远程工具 '{self.get_effective_name()}' 异常: {e}")
            return ToolResult.error(error_msg)

    def __str__(self) -> str:
        """字符串表示"""
        return f"RemoteTool(code='{self.tool_code}', name='{self.tool_info.name}')"

    def __repr__(self) -> str:
        """详细字符串表示"""
        return self.__str__()
