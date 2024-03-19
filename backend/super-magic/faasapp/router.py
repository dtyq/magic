import asyncio
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import HTMLResponse

from app.tools.use_browser import UseBrowser, ToolResult

# 定义API路由
router = APIRouter(prefix="/api/v1", tags=["browser"])

# 浏览器实例 - 全局单例
browser_tool = UseBrowser()


@router.post("/browser/use", status_code=status.HTTP_200_OK)
async def execute_browser_action(request: Dict[str, Any]) -> Any:
    """
    执行浏览器操作

    此接口允许执行各种浏览器操作，如导航、截图、点击元素等

    Args:
        request: 包含浏览器操作详情的请求对象，必须包含action字段

    Returns:
        Dict: 包含状态码、消息和数据的标准响应结构
    """
    # 移除None值
    params = {k: v for k, v in request.items() if v is not None}

    # 调用浏览器工具执行操作
    result = await browser_tool.execute(**params)

    # 使用标准响应结构
    return {"code": 1000, "message": "success", "data": result}


@router.get("/browser/state", status_code=status.HTTP_200_OK)
async def get_browser_state() -> Any:
    """
    获取浏览器当前状态

    Returns:
        Dict: 包含状态码、消息和数据的标准响应结构
    """
    result = await browser_tool.get_current_state()
    return {"code": 1000, "message": "success", "data": result}


@router.post("/browser/cleanup", status_code=status.HTTP_200_OK)
async def cleanup_browser() -> Any:
    """
    清理浏览器资源

    Returns:
        Dict: 包含状态码、消息和数据的标准响应结构
    """
    await browser_tool.cleanup()
    return {"code": 1000, "message": "success", "data": "浏览器资源已清理"}
