"""
Todo 实体模型

定义 todo 相关的数据结构
"""
from typing import Optional, List
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class TodoStatus(str, Enum):
    """Todo 状态枚举"""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TodoItem(BaseModel):
    """Todo 项模型

    表示单个待办任务项，包含任务的基本信息和状态
    """
    id: str = Field(..., description="唯一标识符")
    content: str = Field(..., min_length=1, description="任务内容")
    status: TodoStatus = Field(..., description="任务状态")
    created_at: Optional[datetime] = Field(default=None, description="创建时间")
    updated_at: Optional[datetime] = Field(default=None, description="更新时间")


class TodoFile(BaseModel):
    """Todo文件模型

    表示持久化到文件的todo数据结构(全局todo列表)
    """
    created_at: datetime = Field(default_factory=datetime.now, description="文件创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="文件最后更新时间")
    todos: List[TodoItem] = Field(default_factory=list, description="todo项列表")
