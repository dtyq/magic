"""MCP 工具动态参数类

根据 MCP 工具的 inputSchema 动态生成 Pydantic 参数类，
同时注入 output_file_path 公共参数。
"""

from typing import Any, Dict, Optional, Type, Union

from agentlang.logger import get_logger
from pydantic import Field, create_model

from app.tools.core.base_tool_params import BaseToolParams

logger = get_logger(__name__)


class MCPToolParams(BaseToolParams):
    """MCP 工具参数基类

    固定注入 output_file_path 参数，其余参数由 create_from_schema 动态生成。
    """

    output_file_path: str = Field(
        default="",
        description=(
            "工具结果输出到文件的路径，最好具有优雅的目录结构，文件必须是 json 格式。"
            "用于将工具的执行结果保存到指定文件中，避免大结果输出。"
            "建议在需要保留详细执行结果或结果可能很大时使用此参数，"
            "如 mysql 没有使用 WHERE 或 LIMIT 时可能返回上万行数据、查询文章详情等。"
            "如果不指定（为空），但工具结果很大时，系统会自动保存结果到工作区下。"
        )
    )

    class Config:
        extra = "allow"

    @classmethod
    def create_from_schema(cls, schema: Dict[str, Any]) -> Type["MCPToolParams"]:
        """根据 MCP inputSchema 动态生成参数类

        Args:
            schema: MCP 工具的 JSON Schema 定义

        Returns:
            Type[MCPToolParams]: 动态创建的参数类
        """
        if not schema or not isinstance(schema, dict):
            schema = {}

        properties = schema.get("properties", {})
        required = schema.get("required", [])

        fields: Dict[str, Any] = {}
        annotations: Dict[str, Any] = {}

        for field_name, field_info in properties.items():
            description = field_info.get("description", "")
            json_type = field_info.get("type", "string")
            python_type = cls._map_json_type_to_python(json_type)

            if field_name in required:
                annotations[field_name] = python_type
                fields[field_name] = Field(description=description)
            else:
                annotations[field_name] = Optional[python_type]
                fields[field_name] = Field(default=None, description=description)

        return create_model(
            "MCPToolParams",
            __base__=cls,
            __module__=cls.__module__,
            __annotations__=annotations,
            **fields
        )

    @staticmethod
    def _map_json_type_to_python(json_type: str) -> Type:
        """将 JSON Schema 类型映射到 Python 类型

        "number" 映射为 Union[int, float]：Pydantic 按顺序尝试，
        整数值优先匹配 int，有小数部分的值匹配 float。
        """
        mapping: Dict[str, Any] = {
            "string": str,
            "integer": int,
            "number": Union[int, float],
            "boolean": bool,
            "array": list,
            "object": dict,
        }
        return mapping.get(json_type, str)
