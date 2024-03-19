"""
异常处理工具
"""
import functools
import logging
from typing import Any, Callable, TypeVar, cast

from fastapi import HTTPException

logger = logging.getLogger("sandbox_gateway")

T = TypeVar("T")


class SandboxException(Exception):
    """沙箱服务基础异常类"""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class SandboxNotFoundError(SandboxException):
    """沙箱不存在异常"""
    def __init__(self, sandbox_id: str):
        message = f"沙箱 {sandbox_id} 不存在或已过期"
        super().__init__(message, status_code=404)


class ContainerOperationError(SandboxException):
    """容器操作异常"""
    def __init__(self, message: str):
        super().__init__(f"容器操作失败: {message}", status_code=500)


def handle_exceptions(func: Callable[..., T]) -> Callable[..., T]:
    """
    异常处理装饰器，将内部异常转换为HTTP异常
    
    Args:
        func: 需要异常处理的函数
        
    Returns:
        装饰后的函数
    """
    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> T:
        try:
            return func(*args, **kwargs)
        except SandboxException as e:
            logger.error(f"{func.__name__} 失败: {e.message}")
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except Exception as e:
            error_message = f"{func.__name__} 发生未知错误: {str(e)}"
            logger.exception(error_message)
            raise HTTPException(status_code=500, detail="服务内部错误")
    return cast(T, wrapper)


def async_handle_exceptions(func: Callable[..., T]) -> Callable[..., T]:
    """
    异步函数的异常处理装饰器
    
    Args:
        func: 需要异常处理的异步函数
        
    Returns:
        装饰后的异步函数
    """
    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> T:
        try:
            return await func(*args, **kwargs)
        except SandboxException as e:
            logger.error(f"{func.__name__} 失败: {e.message}")
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except Exception as e:
            error_message = f"{func.__name__} 发生未知错误: {str(e)}"
            logger.exception(error_message)
            raise HTTPException(status_code=500, detail="服务内部错误")
    return cast(T, wrapper) 