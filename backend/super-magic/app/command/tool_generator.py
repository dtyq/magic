"""工具定义生成命令模块"""

import importlib
from typing import Dict, Any, Optional

from agentlang.logger import get_logger
from app.tools.core.tool_definition import tool_definition_manager

logger = get_logger(__name__)


def extract_parameters_schema(tool_class, tool_name: str = None) -> Optional[Dict[str, Any]]:
    """提取工具的参数schema"""
    try:
        # 获取参数类
        params_class = getattr(tool_class, 'params_class', None) or getattr(tool_class, '_params_class', None)

        if params_class is None:
            return None

                # 如果是 Pydantic 模型，获取其 schema
        if hasattr(params_class, '__pydantic_model__'):
            logger.info(f"工具 {tool_name} 使用 Pydantic v2 路径")
            # Pydantic v2 - 使用统一的清理方法确保格式一致
            if hasattr(params_class, 'model_json_schema_clean'):
                schema = params_class.model_json_schema_clean()
                logger.info(f"工具 {tool_name} 使用 model_json_schema_clean")
            else:
                schema = params_class.model_json_schema()
                logger.info(f"工具 {tool_name} 使用 model_json_schema")

            logger.info(f"工具 {tool_name} schema 有 properties: {'properties' in schema if schema else False}")
            # 应用与 BaseTool.to_param() 相同的全局参数处理逻辑
            if schema and 'properties' in schema:
                logger.info(f"应用全局参数逻辑到工具: {tool_name or tool_class.__name__ if hasattr(tool_class, '__name__') else 'unknown'}")
                _apply_global_parameter_logic(schema, params_class)
            return schema
        elif hasattr(params_class, 'schema'):
            # Pydantic v1
            logger.info(f"工具 {tool_name} 使用 Pydantic v1 路径")
            schema = params_class.schema()
            logger.info(f"工具 {tool_name} schema 有 properties: {'properties' in schema if schema else False}")

            # 应用与 BaseTool.to_param() 相同的全局参数处理逻辑
            if schema and 'properties' in schema:
                logger.info(f"应用全局参数逻辑到工具 (Pydantic v1): {tool_name}")
                _apply_global_parameter_logic(schema, params_class)
            return schema
        elif hasattr(params_class, '__annotations__'):
            # 简单的类型注解
            schema = {
                "type": "object",
                "properties": {},
                "required": []
            }

            for field_name, field_type in params_class.__annotations__.items():
                # 简单的类型映射
                type_mapping = {
                    str: {"type": "string"},
                    int: {"type": "integer"},
                    float: {"type": "number"},
                    bool: {"type": "boolean"},
                    list: {"type": "array"},
                    dict: {"type": "object"}
                }

                field_schema = type_mapping.get(field_type, {"type": "string"})
                schema["properties"][field_name] = field_schema

                # 检查是否为必需字段（简单检查）
                if not str(field_type).startswith("typing.Optional"):
                    schema["required"].append(field_name)

            return schema

        return None

    except Exception as e:
        logger.error(f"提取工具参数schema失败 {tool_class.__name__}: {e}")
        return None


def _apply_global_parameter_logic(schema: Dict[str, Any], params_class) -> None:
    """应用与 BaseTool.to_param() 相同的全局参数处理逻辑"""
    from typing import get_args, get_origin, Union, Optional

    # 确保有 required 字段
    if 'required' not in schema:
        schema['required'] = []

async def generate_tool_definitions() -> bool:
    """生成工具定义文件到固定位置 config/tool_definitions.json

    Returns:
        bool: 是否生成成功
    """
    logger.info("🔧 开始生成工具定义文件...")

    try:
        # 使用工具工厂的统一实现，强制生成
        from app.tools.core.tool_factory import tool_factory
        return await tool_factory.generate_tool_definitions(force=True)

    except Exception as e:
        logger.error(f"生成工具定义时发生错误: {e}", exc_info=True)
        return False


async def validate_tool_definitions() -> bool:
    """验证工具定义文件 config/tool_definitions.json

    Returns:
        bool: 验证是否通过
    """
    logger.info("🔍 开始验证工具定义文件...")

    try:
        # 使用全局定义管理器
        manager = tool_definition_manager

        # 加载定义
        await manager.load_definitions()
        definitions = await manager.get_all_definitions()

        if not definitions:
            logger.error("没有找到任何工具定义")
            return False

        valid_count = 0
        invalid_count = 0

        for tool_name, definition in definitions.items():
            if definition.is_valid():
                # 尝试验证模块是否可以导入
                try:
                    module = importlib.import_module(definition.module_path)
                    tool_class = getattr(module, definition.class_name)
                    logger.debug(f"✅ 工具定义有效: {tool_name}")
                    valid_count += 1
                except ImportError as e:
                    logger.error(f"❌ 工具定义模块无法导入 {tool_name}: {e}")
                    invalid_count += 1
                except AttributeError as e:
                    logger.error(f"❌ 工具定义类不存在 {tool_name}: {e}")
                    invalid_count += 1
            else:
                logger.error(f"❌ 工具定义无效: {tool_name}")
                invalid_count += 1

        if invalid_count > 0:
            logger.info(f"🔍 工具定义验证完成！有效 {valid_count} 个，无效 {invalid_count} 个")
        else:
            logger.info(f"🔍 工具定义验证完成！所有 {valid_count} 个工具定义都有效")

        return invalid_count == 0

    except Exception as e:
        logger.error(f"验证工具定义时发生错误: {e}", exc_info=True)
        return False


async def show_tool_definitions_stats() -> None:
    """显示工具定义统计信息 config/tool_definitions.json"""
    try:
        # 使用全局定义管理器
        manager = tool_definition_manager

        stats = await manager.get_stats()

        logger.info("📊 工具定义统计信息:")
        logger.info(f"  定义文件: {stats['definition_file']}")
        logger.info(f"  文件存在: {stats['file_exists']}")
        logger.info(f"  工具总数: {stats['total_tools']}")

        if stats['total_tools'] > 0:
            logger.info("  工具列表:")
            for tool_name in sorted(stats['tool_names']):
                logger.info(f"    - {tool_name}")

    except Exception as e:
        logger.error(f"显示统计信息时发生错误: {e}", exc_info=True)
