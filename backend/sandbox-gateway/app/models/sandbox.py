"""
沙箱相关数据模型
"""
from typing import Optional, TypeVar, Generic, Any, List
from pydantic import BaseModel


class BaseResponse(BaseModel):
    """基础响应模型"""
    code: int = 1000
    message: str = "success"
    data: Optional[Any] = None


T = TypeVar('T')


class Response(BaseResponse, Generic[T]):
    """通用响应模型"""
    data: Optional[T] = None


class SandboxCreateRequest(BaseModel):
    """沙箱创建请求模型"""
    sandbox_id: Optional[str] = None


class SandboxData(BaseModel):
    """沙箱创建数据模型"""
    sandbox_id: str
    status: str
    message: str


class SandboxCreateResponse(Response[SandboxData]):
    """创建沙箱的响应模型"""
    pass


class SandboxInfo(BaseModel):
    """沙箱信息模型"""
    sandbox_id: str
    status: str
    created_at: float
    started_at: Optional[float] = None
    ip_address: Optional[str] = None


class SandboxListResponse(Response[List[SandboxInfo]]):
    """沙箱列表响应模型"""
    pass


class SandboxDetailResponse(Response[SandboxInfo]):
    """沙箱详情响应模型"""
    pass


class DeleteResponse(BaseModel):
    """删除操作响应数据模型"""
    message: str


class SandboxDeleteResponse(Response[DeleteResponse]):
    """沙箱删除响应模型"""
    pass


class ContainerInfo(BaseModel):
    """容器信息模型，用于内部处理"""
    id: str
    ip: Optional[str] = None
    ws_port: int = 8002
    created_at: float
    started_at: Optional[float] = None
    status: str
    exited_at: Optional[float] = None