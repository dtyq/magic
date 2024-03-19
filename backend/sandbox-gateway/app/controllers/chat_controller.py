"""
聊天历史API控制器
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx

from app.services.sandbox_service import sandbox_service
from app.utils.exceptions import async_handle_exceptions

logger = logging.getLogger("sandbox_gateway")

# 创建API路由
router = APIRouter(prefix="/sandboxes", tags=["chat"])


@router.get("/{sandbox_id}/chat-history/download")
@async_handle_exceptions
async def proxy_chat_history_download(request: Request, sandbox_id: str) -> StreamingResponse:
    """
    代理下载聊天历史记录
    
    Args:
        request: FastAPI请求对象
        sandbox_id: 沙箱ID
        
    Returns:
        StreamingResponse: 代理的聊天历史下载响应流
    """
    try:
        # 获取沙箱容器
        container = sandbox_service._get_agent_container_by_sandbox_id(sandbox_id)
        if not container:
            logger.error(f"找不到沙箱容器: {sandbox_id}")
            raise HTTPException(status_code=404, detail=f"无法找到沙箱 {sandbox_id}")
            
        # 获取容器信息
        container_info = sandbox_service._get_container_info(container)
        
        # 构建API请求URL
        target_url = f"http://{container_info.ip}:{container_info.ws_port}/api/chat-history/download"
        
        # 使用httpx代理请求
        async with httpx.AsyncClient() as client:
            response = await client.get(
                target_url,
                headers={k: v for k, v in request.headers.items() if k.lower() not in ["host", "content-length"]},
                follow_redirects=True
            )
            
            # 返回流式响应
            return StreamingResponse(
                response.aiter_bytes(),
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.headers.get("content-type")
            )
    except httpx.RequestError as e:
        error_msg = f"代理请求出错: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg) 