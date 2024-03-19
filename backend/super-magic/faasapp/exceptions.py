import json
import traceback
from typing import Any, Callable, Dict, Optional

from fastapi import Request, Response
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from agentlang.logger import get_logger

# 创建日志记录器
logger = get_logger(__name__)


class AppException(Exception):
    """自定义基础异常类"""

    def __init__(self, message: str, code: int = 2000, data: Optional[Dict[str, Any]] = None):
        self.message = message
        self.code = code
        self.data = data or {}
        super().__init__(message)


class ExceptionMiddleware(BaseHTTPMiddleware):
    """异常处理中间件"""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        try:
            return await call_next(request)

        except Exception as e:
            # 处理其他未预期的异常
            logger.error(f"未处理的异常: {e!s}")
            logger.error(f"异常堆栈: {''.join(traceback.format_tb(e.__traceback__))}")

            return JSONResponse(status_code=200, content={"code": 2000, "message": "服务器内部错误", "data": {}})


# 创建中间件实例
exception_handler = ExceptionMiddleware
