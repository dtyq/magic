# -*- coding: utf-8 -*-
"""
Checkpoint相关的HTTP响应DTO

这个模块定义了checkpoint功能的HTTP响应对象，包括：
- RollbackExecuteResponse: 回滚执行响应
"""

from typing import Optional, Dict, Any
from pydantic import Field

from app.api.http_dto.base import MessageResponse

class RollbackExecuteResponse(MessageResponse):
    """回滚执行响应"""
    data: Dict[str, Any] = Field(default_factory=dict, description="回滚执行结果")
