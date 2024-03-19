"""
Token验证中间件 - 检查API请求的token是否有效
"""
import logging
import os
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger("sandbox_gateway")

class TokenValidationMiddleware(BaseHTTPMiddleware):
    """Token验证中间件，检查请求头中的token是否有效"""
    
    def __init__(self, app):
        super().__init__(app)
        self.token = os.environ.get("API_TOKEN")  # 从环境变量获取token
        if not self.token:
            logger.warning("API_TOKEN环境变量未设置，API安全验证已禁用")
    
    async def dispatch(self, request: Request, call_next):
        # 如果token未设置，跳过验证
        if not self.token:
            return await call_next(request)

        # 从请求头中获取token
        token = request.headers.get("token")

        # 验证token
        if token != self.token:
            logger.warning(f"无效的token: {token}")
            # 直接返回401响应而不是抛出异常
            return JSONResponse(
                status_code=401,
                content={"detail": "Unauthorized"}
            )
        
        # token有效，继续处理请求
        return await call_next(request) 