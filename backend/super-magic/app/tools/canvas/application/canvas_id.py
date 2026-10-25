"""Canvas 标识生成函数。"""

import uuid


def new_canvas_id(prefix: str) -> str:
    """生成不依赖模型输入的稳定对象 ID。"""
    return f"{prefix}-{uuid.uuid4().hex[:16]}"
