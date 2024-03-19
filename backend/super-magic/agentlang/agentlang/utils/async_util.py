"""
异步工具函数，提供异步操作的辅助函数
"""

import asyncio
import inspect
from functools import wraps
from typing import Any, Callable, Coroutine, TypeVar

T = TypeVar("T")


def run_async(func: Callable[..., Coroutine[Any, Any, T]]) -> Callable[..., T]:
    """
    装饰器，将异步函数包装为同步函数

    Args:
        func: 要包装的异步函数

    Returns:
        同步函数包装器
    """

    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> T:
        """同步函数包装器"""
        # 获取当前事件循环或创建新的
        loop = asyncio.get_event_loop()

        # 如果事件循环已关闭，创建新的
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # 在事件循环中运行异步函数
        return loop.run_until_complete(func(*args, **kwargs))

    return wrapper


async def run_in_executor(func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """
    在线程池中运行阻塞函数

    Args:
        func: 要运行的阻塞函数
        args: 位置参数
        kwargs: 关键字参数

    Returns:
        函数结果
    """
    loop = asyncio.get_event_loop()

    # 将函数包装到同一个调用中
    def wrapped_func():
        return func(*args, **kwargs)

    # 在线程池中运行阻塞函数
    return await loop.run_in_executor(None, wrapped_func)


def is_async_function(func: Callable) -> bool:
    """
    检查函数是否为异步函数

    Args:
        func: 要检查的函数

    Returns:
        是否为异步函数
    """
    return inspect.iscoroutinefunction(func)


async def gather_with_concurrency(n: int, *tasks):
    """
    限制并发任务数量的gather函数

    Args:
        n: 最大并发数
        tasks: 任务列表

    Returns:
        任务结果列表
    """
    semaphore = asyncio.Semaphore(n)

    async def sem_task(task):
        async with semaphore:
            return await task

    return await asyncio.gather(*(sem_task(task) for task in tasks)) 