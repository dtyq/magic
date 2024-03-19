"""
沙箱API控制器
"""
import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.models.sandbox import (
    SandboxCreateResponse, SandboxInfo, SandboxData,
    SandboxListResponse, SandboxDetailResponse,
    SandboxDeleteResponse, DeleteResponse, SandboxCreateRequest
)
from app.services.sandbox_service import sandbox_service
from app.utils.exceptions import async_handle_exceptions

logger = logging.getLogger("sandbox_gateway")

# 创建API路由
router = APIRouter(prefix="/sandboxes", tags=["sandboxes"])


@router.post("", response_model=SandboxCreateResponse)
@async_handle_exceptions
async def create_sandbox(request: SandboxCreateRequest) -> SandboxCreateResponse:
    """
    创建新的沙箱容器
    
    Args:
        request: 包含可选沙箱ID的请求体
    
    Returns:
        SandboxCreateResponse: 包含沙箱ID和创建状态的响应
    """
    sandbox_id = await sandbox_service.create_sandbox(request.sandbox_id)
    return SandboxCreateResponse(
        data=SandboxData(
            sandbox_id=sandbox_id,
            status="created",
            message="沙箱容器已创建成功"
        )
    )


@router.get("", response_model=SandboxListResponse)
async def list_sandboxes() -> SandboxListResponse:
    """
    列出所有沙箱容器
    
    Returns:
        SandboxListResponse: 沙箱容器列表响应
    """
    sandboxes = sandbox_service.list_sandboxes()
    return SandboxListResponse(data=sandboxes)


@router.get("/{sandbox_id}", response_model=SandboxDetailResponse)
async def get_agent_container(sandbox_id: str) -> SandboxDetailResponse:
    """
    获取沙箱容器信息
    
    Args:
        sandbox_id: 沙箱ID
        
    Returns:
        SandboxDetailResponse: 沙箱容器信息响应
    """
    sandbox = sandbox_service.get_agent_container(sandbox_id)
    if not sandbox:
        return SandboxDetailResponse(
            code=4004,
            message="沙箱不存在"
        )
    return SandboxDetailResponse(data=sandbox)


@router.delete("/{sandbox_id}", response_model=SandboxDeleteResponse)
async def delete_sandbox(sandbox_id: str) -> SandboxDeleteResponse:
    """
    删除沙箱容器
    
    Args:
        sandbox_id: 沙箱ID
        
    Returns:
        SandboxDeleteResponse: 删除操作响应
    """
    sandbox_service.delete_sandbox(sandbox_id)
    return SandboxDeleteResponse(
        data=DeleteResponse(
            message=f"沙箱 {sandbox_id} 已成功删除"
        )
    )


@router.websocket("/ws/{sandbox_id}")
async def sandbox_websocket(websocket: WebSocket, sandbox_id: str) -> None:
    """
    连接到指定沙箱容器的WebSocket
    
    此端点会:
    1. 连接到指定的沙箱容器
    2. 在客户端和容器之间双向转发消息
    
    Args:
        websocket: WebSocket连接
        sandbox_id: 要连接的沙箱ID
    """
    try:
        # 让沙箱服务处理WebSocket连接
        await sandbox_service.handle_websocket(websocket, sandbox_id)
    except WebSocketDisconnect:
        logger.info(f"WebSocket连接已断开: {sandbox_id}")
    except Exception as e:
        logger.error(f"处理沙箱WebSocket时出错: {e}") 