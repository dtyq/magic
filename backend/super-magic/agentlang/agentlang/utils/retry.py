"""
重试工具函数，提供解析错误信息和实现重试机制的功能
"""

import asyncio
import re
import random
from typing import Callable, TypeVar, Any, Optional

from agentlang.logger import get_logger

logger = get_logger(__name__)

T = TypeVar("T")


def extract_retry_delay_from_error(error_message: str) -> Optional[int]:
    """
    从错误消息中提取需要等待的重试时间（秒）

    Args:
        error_message: 错误信息字符串

    Returns:
        int | None: 需要等待的秒数，如果没有找到则返回 None
    """
    # 尝试匹配常见的重试时间模式，例如 "retry after 16 seconds" 或 "Please retry after 16 seconds"
    # Azure OpenAI 错误消息格式: "Please retry after 16 seconds."
    pattern = r"retry after (\d+) seconds"
    match = re.search(pattern, error_message, re.IGNORECASE)

    if match:
        return int(match.group(1))

    return None


async def retry_with_exponential_backoff(
    func: Callable[..., Any],
    *args: Any,
    max_retries: int = 5,
    initial_delay: float = 1.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    **kwargs: Any
) -> Any:
    """
    使用指数退避策略重试函数

    Args:
        func: 要重试的函数
        args: 函数的位置参数
        max_retries: 最大重试次数，默认为5
        initial_delay: 初始延迟时间（秒），默认为1.0
        exponential_base: 指数基数，默认为2.0
        jitter: 是否添加随机抖动，默认为True
        kwargs: 函数的关键字参数

    Returns:
        Any: 函数的返回值

    Raises:
        Exception: 如果所有重试都失败，则抛出最后一个异常
    """
    delay = initial_delay
    last_exception = None

    # 尝试执行函数，最多重试 max_retries 次
    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            last_exception = e

            if attempt == max_retries:
                logger.error(f"达到最大重试次数 {max_retries}，放弃重试")
                raise

            # 从错误消息中提取重试延迟时间
            error_message = str(e)
            retry_delay = extract_retry_delay_from_error(error_message)

            # 如果找到了明确的重试时间，使用它
            if retry_delay is not None:
                delay = retry_delay
                logger.info(f"从错误消息中提取到重试延迟时间: {delay}秒")
            else:
                # 否则使用指数退避策略
                delay = initial_delay * (exponential_base ** attempt)

            # 添加随机抖动以避免多个请求同时重试
            if jitter:
                delay = delay * (0.5 + random.random())

            logger.warning(f"第 {attempt+1} 次尝试失败: {error_message}，将在 {delay:.2f} 秒后重试")

            # 等待延迟时间
            await asyncio.sleep(delay)

    # 这里不应该被执行到，因为最后一次尝试失败会在循环中抛出异常
    if last_exception:
        raise last_exception

    raise RuntimeError("所有重试都失败，但没有异常被捕获，这不应该发生")
