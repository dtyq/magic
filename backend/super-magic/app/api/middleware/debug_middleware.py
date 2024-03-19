"""
调试中间件

记录每个传入请求和输出响应的详细信息，用于调试
"""


from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from agentlang.logger import get_logger

logger = get_logger(__name__)


class DebugMiddleware(BaseHTTPMiddleware):
    """记录详细调试信息的中间件"""

    async def dispatch(self, request: Request, call_next):
        """
        处理请求并记录调试日志

        Args:
            request: HTTP请求对象
            call_next: 下一个中间件或路由处理函数

        Returns:
            Response: HTTP响应对象
        """
        # 记录请求信息
        logger.info(f"[DEBUG] 传入请求: {request.method} {request.url}")
        logger.info(f"[DEBUG] 请求头: {dict(request.headers)}")
        logger.info(f"[DEBUG] 客户端: {request.client}")

        # 处理请求
        response = await call_next(request)

        # 记录响应信息
        logger.info(f"[DEBUG] 响应状态: {response.status_code}")
        logger.info(f"[DEBUG] 响应头: {dict(response.headers)}")

        return response
