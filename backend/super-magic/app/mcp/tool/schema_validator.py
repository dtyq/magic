"""MCP Schema 验证器

验证 MCP 工具的 inputSchema 是否符合 OpenAI 函数调用规范：
- 嵌套 object 类型必须有 properties 字段
- array 类型必须有 items 字段
- 递归校验 allOf/anyOf/oneOf 组合结构
"""

from typing import Any, Dict

from agentlang.logger import get_logger

logger = get_logger(__name__)


def validate_mcp_schema(schema: Dict[str, Any], tool_name: str) -> bool:
    """验证 MCP 工具 schema 是否符合 OpenAI 函数调用规范

    Args:
        schema: MCP 工具的 inputSchema 字典
        tool_name: 工具名称，仅用于日志定位

    Returns:
        bool: schema 是否有效
    """
    try:
        return _validate_node(schema, "root", tool_name)
    except Exception as e:
        logger.warning(f"验证 MCP 工具 '{tool_name}' schema 时出错: {e}")
        return False


def _validate_node(schema: Any, path: str, tool_name: str) -> bool:
    """递归验证 schema 节点

    Args:
        schema: 当前节点
        path: 当前路径（用于错误日志定位）
        tool_name: 工具名称

    Returns:
        bool: 当前节点是否有效
    """
    if not isinstance(schema, dict):
        return True

    schema_type = schema.get("type")

    if schema_type == "object":
        # 根节点（工具入参整体）允许没有 properties（无参数工具）
        if path == "root":
            if "properties" in schema:
                for prop_name, prop_schema in schema.get("properties", {}).items():
                    if not _validate_node(prop_schema, f"{path}.properties.{prop_name}", tool_name):
                        return False
        else:
            # 嵌套 object 必须有 properties
            if "properties" not in schema:
                logger.warning(
                    f"MCP 工具 '{tool_name}' 在路径 '{path}' 处发现无效的嵌套 object 类型: 缺少 properties 字段"
                )
                return False
            for prop_name, prop_schema in schema.get("properties", {}).items():
                if not _validate_node(prop_schema, f"{path}.properties.{prop_name}", tool_name):
                    return False

    elif schema_type == "array":
        if "items" not in schema:
            logger.warning(
                f"MCP 工具 '{tool_name}' 在路径 '{path}' 处发现无效的 array 类型: 缺少 items 字段"
            )
            return False
        if not _validate_node(schema.get("items"), f"{path}.items", tool_name):
            return False

    # 验证组合结构
    for keyword in ("allOf", "anyOf", "oneOf"):
        if keyword in schema:
            schema_list = schema[keyword]
            if isinstance(schema_list, list):
                for i, sub_schema in enumerate(schema_list):
                    if not _validate_node(sub_schema, f"{path}.{keyword}[{i}]", tool_name):
                        return False

    return True
