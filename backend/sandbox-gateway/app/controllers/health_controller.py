"""
健康检查控制器
"""
import logging
from typing import Dict

from fastapi import APIRouter

logger = logging.getLogger("sandbox_gateway")

# 创建API路由
router = APIRouter(tags=["health"])


@router.get("/")
async def root() -> Dict[str, str]:
    """
    服务根路径
    
    Returns:
        Dict: 服务信息
    """
    return {
        "service": "沙箱容器网关",
        "status": "running",
        "version": "0.1.0"
    }


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """
    健康检查端点
    
    Returns:
        Dict: 健康状态
    """
    return {
        "status": "healthy",
        "message": "服务正常运行"
    } 