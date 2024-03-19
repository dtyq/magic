# API 路由模块
"""API路由模块，导出主路由器"""
# 仅导入api_router
from app.api.routes.api import api_router

__all__ = ["api_router"]
