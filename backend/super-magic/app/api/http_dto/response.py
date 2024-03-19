from enum import Enum
from typing import Any, Optional, Dict
from pydantic import BaseModel, Field

from app.core.exceptions.business import ErrorCode


class ResponseCode(int, Enum):
    """响应状态码枚举"""
    SUCCESS = 1000  # 成功
    ERROR = 2000    # 失败


class BaseResponse(BaseModel):
    """基础HTTP响应模型"""
    code: ResponseCode = Field(..., description="响应状态码")
    message: str = Field(..., description="响应消息")
    data: Optional[Dict[str, Any]] = Field(None, description="响应数据")

    class Config:
        use_enum_values = True


class SuccessResponse(BaseResponse):
    """成功响应模型"""
    code: ResponseCode = ResponseCode.SUCCESS
    message: str = "操作成功"


class ErrorResponse(BaseResponse):
    """错误响应模型"""
    code: ResponseCode = ResponseCode.ERROR
    message: str = "操作失败"


class ChatResponse(BaseResponse):
    """聊天消息响应模型"""
    pass


def create_success_response(
    message: str = "操作成功",
    data: Optional[Dict[str, Any]] = None
) -> SuccessResponse:
    """创建成功响应"""
    return SuccessResponse(message=message, data=data)


def create_error_response(
    message: str = "操作失败",
    data: Optional[Dict[str, Any]] = None,
    code: Optional[int] = None
) -> ErrorResponse:
    """创建错误响应"""
    if code is None:
        code = ErrorCode.GENERAL_ERROR

    error_response = ErrorResponse(message=message, data=data)
    error_response.code = code
    return error_response
