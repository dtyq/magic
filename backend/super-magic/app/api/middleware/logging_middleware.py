"""
请求日志中间件

记录HTTP请求和响应的详细信息
"""

import time

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from agentlang.logger import get_logger

logger = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """记录请求和响应信息的中间件"""

    async def dispatch(self, request: Request, call_next):
        """
        处理请求并记录日志

        Args:
            request: HTTP请求对象
            call_next: 下一个中间件或路由处理函数

        Returns:
            Response: HTTP响应对象
        """
        start_time = time.time()

        # 记录请求信息
        logger.info(f"请求开始: {request.method} {request.url.path}")

        # 记录更详细的头信息，特别是连接相关的
        headers = dict(request.headers)
        connection_type = headers.get("connection", "未指定")
        user_agent = headers.get("user-agent", "未指定")

        logger.info(f"连接类型: {connection_type}, User-Agent: {user_agent}")
        logger.info(f"请求头详情: {headers}")

        try:
            # 调用下一个中间件或路由处理函数
            response = await call_next(request)

            # 计算处理时间
            process_time = time.time() - start_time
            logger.info(
                f"请求完成: {request.method} {request.url.path} - 状态码: {response.status_code}, 耗时: {process_time:.4f}秒"
            )

            # 记录响应头
            logger.info(f"响应头: {dict(response.headers)}")

            return response
        except Exception as e:
            # 记录异常信息
            process_time = time.time() - start_time
            logger.error(f"请求异常: {request.method} {request.url.path} - 异常: {e!s}, 耗时: {process_time:.4f}秒")
            logger.exception("请求处理异常详情:")
            raise
