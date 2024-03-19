"""
JSON 工具函数，提供JSON处理相关的辅助函数
"""

import json
from typing import Any


def json_dumps(obj: Any, **kwargs) -> str:
    """
    对 json.dumps 的包装，默认设置 ensure_ascii=False
    
    Args:
        obj: 要转换为JSON的Python对象
        **kwargs: 传递给json.dumps的额外关键字参数
        
    Returns:
        str: 保留非ASCII字符的JSON字符串表示
    """
    kwargs.setdefault('ensure_ascii', False)
    return json.dumps(obj, **kwargs) 