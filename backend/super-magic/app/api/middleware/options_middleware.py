"""
OPTIONS 请求处理中间件

专门处理跨域预检请求 (OPTIONS)
"""


from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from agentlang.logger import get_logger

logger = get_logger(__name__)


class OptionsMiddleware(BaseHTTPMiddleware):
    """处理OPTIONS预检请求的中间件"""

    async def dispatch(self, request: Request, call_next):
        """
        处理OPTIONS请求

        Args:
            request: HTTP请求对象
            call_next: 下一个中间件或路由处理函数

        Returns:
            Response: HTTP响应对象
        """
        if request.method == "OPTIONS":
            logger.info("收到预检请求: OPTIONS")
            # 创建一个空响应，状态码为200
            response = Response(status_code=200)
            # 添加允许的头
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Max-Age"] = "3600"
            return response

        # 非OPTIONS请求，继续处理
        return await call_next(request)
