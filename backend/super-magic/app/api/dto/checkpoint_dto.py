# -*- coding: utf-8 -*-
"""
Checkpoint相关的数据传输对象

这个模块定义了checkpoint功能的DTO，包括：
- RollbackRequestDTO: 回滚请求传输对象
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from app.api.dto.base import BaseDTO

class RollbackRequestDTO(BaseDTO):
    """回滚请求DTO"""
    target_message_id: str = Field(..., description="目标消息ID")


class CheckRollbackRequestDTO(BaseDTO):
    """检查回滚可行性请求DTO"""
    target_message_id: str = Field(..., description="目标消息ID")


class CheckRollbackResponseDTO(BaseDTO):
    """检查回滚可行性响应DTO"""
    can_rollback: bool = Field(..., description="是否可以回滚到目标checkpoint")
