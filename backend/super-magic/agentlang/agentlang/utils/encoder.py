"""
JSON 编码器

提供自定义的 JSON 编码器，用于处理特殊对象类型的序列化
"""

import json
from typing import Any

from openai.types.chat import ChatCompletionMessageToolCall


class CustomJSONEncoder(json.JSONEncoder):
    """自定义 JSON 编码器，处理特殊类型的序列化"""

    def default(self, obj: Any) -> Any:
        """
        处理特殊类型的序列化

        Args:
            obj: 要序列化的对象

        Returns:
            可以被标准 JSON 编码器处理的对象
        """
        # 处理 ChatCompletionMessageToolCall 对象
        if isinstance(obj, ChatCompletionMessageToolCall):
            return {
                "id": obj.id,
                "type": obj.type,
                "function": {
                    "name": obj.function.name,
                    "arguments": obj.function.arguments
                }
            }

        # 尝试使用 model_dump 方法（Pydantic 模型）
        if hasattr(obj, "model_dump"):
            return obj.model_dump()

        # 尝试使用 __dict__ 属性
        if hasattr(obj, "__dict__"):
            return obj.__dict__

        # 默认处理方式
        return super().default(obj)


def json_dumps(obj: Any, **kwargs) -> str:
    """
    使用自定义编码器的 JSON 序列化函数

    Args:
        obj: 要序列化的对象
        **kwargs: 传递给 json.dumps 的其他参数

    Returns:
        序列化后的 JSON 字符串
    """
    # 设置默认值
    kwargs.setdefault("ensure_ascii", False)
    kwargs.setdefault("cls", CustomJSONEncoder)

    return json.dumps(obj, **kwargs) 