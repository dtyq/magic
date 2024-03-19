"""
请求日志中间件 - 记录所有API的HTTP请求信息
"""
import json
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("sandbox_gateway")

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件，记录所有HTTP请求的详细信息"""
    
    async def dispatch(self, request: Request, call_next):
        # 移除对 "/sandboxes" 路径的限制，记录所有API请求
        # 构建基础请求信息
        request_info = {
            "method": request.method,  # 记录所有HTTP方法：GET, POST, PUT, DELETE, PATCH, OPTIONS等
            "url": str(request.url),
            "path_params": request.path_params,
            "query_params": dict(request.query_params),
            "headers": {k: v for k, v in request.headers.items() if k.lower() != "authorization"}  # 排除敏感头信息
        }
        
        # 对于POST/PUT/PATCH请求，额外记录请求体
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                # 保存请求体内容
                body = await request.body()
                
                # 尝试解析JSON
                if body:
                    try:
                        body_str = body.decode("utf-8")
                        # 尝试解析为JSON以便更好地格式化
                        json_body = json.loads(body_str)
                        request_info["body"] = json_body
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        # 如果不是JSON或无法解码，则保存原始字节的字符串表示
                        request_info["body"] = f"<binary data: {len(body)} bytes>"
                
                # 重要：设置 _body 以便后续可以再次读取
                request._body = body
            except Exception as e:
                logger.warning(f"读取请求体时出错: {e}")
        
        # 记录请求信息 - 所有HTTP方法的请求都会记录
        logger.info(f"API请求: {json.dumps(request_info, ensure_ascii=False, default=str)}")
        
        # 继续处理请求
        response = await call_next(request)
        return response 