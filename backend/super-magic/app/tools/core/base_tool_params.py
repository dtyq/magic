"""工具参数基类模块

定义所有工具参数模型的基类，提供通用参数字段
"""

import inspect
from typing import Any, Dict, Optional

from pydantic import BaseModel


class BaseToolParams(BaseModel):
    """工具参数基类

    所有工具参数模型的基类，定义共同参数
    """

    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        """获取自定义参数错误信息

        此方法允许工具参数类为特定字段和错误类型提供自定义错误消息。
        子类可以覆盖此方法，为常见错误场景提供更友好、更具有指导性的错误信息。

        Args:
            field_name: 参数字段名称
            error_type: 错误类型，来自Pydantic验证错误

        Returns:
            Optional[str]: 自定义错误信息，None表示使用默认错误信息
        """
        return None

    @classmethod
    def model_json_schema_clean(cls, **kwargs) -> Dict:
        """生成清理过的JSON Schema

        基于Pydantic的model_json_schema，但会移除一些不必要的字段，
        并将所有 $ref 引用展开为内联定义以兼容 OpenAI API

        Returns:
            Dict: 清理后的JSON Schema
        """
        schema = cls.model_json_schema(**kwargs)
        # 清理schema
        if 'properties' in schema:
            cls._clean_schema_properties(schema['properties'])
            cls._remove_title_recursive(schema)
            cls._clean_description_fields(schema['properties'])
            cls._remove_excluded_fields(schema)

            # 展开 $ref 引用为内联定义
            cls._expand_refs(schema)
        return schema

    @classmethod
    def _expand_refs(cls, schema: Dict):
        """展开 $ref 引用为内联定义

        Args:
            schema: JSON Schema字典
        """
        if '$defs' not in schema:
            return

        defs = schema['$defs']

        # 递归展开所有 $ref 引用
        cls._expand_refs_recursive(schema, defs)

        # 移除 $defs，因为已经全部内联了
        schema.pop('$defs', None)

    @classmethod
    def _expand_refs_recursive(cls, obj: Any, defs: Dict):
        """递归展开对象中的所有 $ref 引用

        Args:
            obj: 要处理的对象
            defs: 定义字典
        """
        if isinstance(obj, dict):
            # 检查是否有 $ref 引用
            if '$ref' in obj:
                ref_path = obj['$ref']
                if ref_path.startswith('#/$defs/'):
                    def_name = ref_path.replace('#/$defs/', '')
                    if def_name in defs:
                        # 获取定义内容
                        definition = defs[def_name].copy()

                        # 递归处理定义内容中的引用
                        cls._expand_refs_recursive(definition, defs)

                        # 替换当前对象
                        obj.clear()
                        obj.update(definition)
                        return

            # 递归处理所有值
            for key, value in list(obj.items()):
                cls._expand_refs_recursive(value, defs)

        elif isinstance(obj, list):
            # 递归处理列表中的每个元素
            for item in obj:
                cls._expand_refs_recursive(item, defs)

    @classmethod
    def _clean_schema_properties(cls, properties: Dict[str, Any]):
        """递归清理Pydantic生成的schema properties

        移除default、additionalProperties等不必要的字段

        Args:
            properties: 属性字典
        """
        if not isinstance(properties, dict):
            return

        for prop_name, prop_schema in list(properties.items()):
            if not isinstance(prop_schema, dict):
                continue

            # No global params to handle anymore
            # 移除不必要的字段
            prop_schema.pop('additionalProperties', None)

            # 递归处理嵌套的properties
            if 'properties' in prop_schema:
                cls._clean_schema_properties(prop_schema['properties'])

            # 递归处理嵌套的items (用于数组)
            if 'items' in prop_schema and isinstance(prop_schema['items'], dict):
                prop_schema['items'].pop('additionalProperties', None)

                if 'properties' in prop_schema['items']:
                    cls._clean_schema_properties(prop_schema['items']['properties'])

                if 'items' in prop_schema['items']:
                    cls._clean_schema_properties(prop_schema['items'])

    @classmethod
    def _remove_title_recursive(cls, schema_obj: Any):
        """递归移除schema对象中的title字段

        Args:
            schema_obj: Schema对象，可能是字典或列表
        """
        if isinstance(schema_obj, dict):
            schema_obj.pop('title', None)  # 移除当前字典的title
            for key, value in schema_obj.items():
                cls._remove_title_recursive(value)  # 递归处理值
        elif isinstance(schema_obj, list):
            for item in schema_obj:
                cls._remove_title_recursive(item)  # 递归处理列表项

    @classmethod
    def _clean_description_fields(cls, properties: Dict[str, Any]):
        """递归清理所有 description 字段（只做格式清理）

        注：双语注释过滤统一在 BaseTool.to_param() 中处理

        Args:
            properties: 属性字典
        """
        if not isinstance(properties, dict):
            return

        for prop_name, prop_schema in properties.items():
            if not isinstance(prop_schema, dict):
                continue

            # 清理当前属性的 description（只做格式清理）
            if 'description' in prop_schema and isinstance(prop_schema['description'], str):
                prop_schema['description'] = inspect.cleandoc(prop_schema['description']).strip()

            # 递归处理嵌套的 properties
            if 'properties' in prop_schema and isinstance(prop_schema['properties'], dict):
                cls._clean_description_fields(prop_schema['properties'])

            # 递归处理数组项
            if 'items' in prop_schema and isinstance(prop_schema['items'], dict):
                if 'description' in prop_schema['items'] and isinstance(prop_schema['items']['description'], str):
                    prop_schema['items']['description'] = inspect.cleandoc(prop_schema['items']['description']).strip()

                if 'properties' in prop_schema['items'] and isinstance(prop_schema['items']['properties'], dict):
                    cls._clean_description_fields(prop_schema['items']['properties'])

    @classmethod
    def _remove_excluded_fields(cls, schema: Dict):
        """移除设置了 exclude=True 的字段

        Args:
            schema: JSON Schema字典
        """
        if 'properties' not in schema:
            return

        # 获取需要排除的字段名列表
        excluded_fields = []
        for field_name, field_info in cls.model_fields.items():
            if hasattr(field_info, 'exclude') and field_info.exclude:
                excluded_fields.append(field_name)

        # 从 properties 中移除排除的字段
        for field_name in excluded_fields:
            schema['properties'].pop(field_name, None)

        # 从 required 列表中移除排除的字段
        if 'required' in schema:
            schema['required'] = [field for field in schema['required'] if field not in excluded_fields]
