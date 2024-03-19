"""
事件系统公共类定义

提供基础的事件数据模型和类型定义，用于打破循环依赖
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict

class BaseEventData(BaseModel):
    """事件数据基类，所有事件数据模型都应继承此类"""

    # 通用关联字段 - 用于关联配对事件的通用机制
    correlation_id: Optional[str] = None  # 事件关联ID，配对的before和after事件使用相同的ID
    parent_correlation_id: Optional[str] = None  # 父级关联ID，用于 Agent 循环周期分组（指向 THINK 容器的 correlation_id）

    model_config = ConfigDict(arbitrary_types_allowed=True)
