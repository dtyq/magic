"""
LLM 请求的 Token 调整工具

该模块提供根据当前 token 使用情况动态调整 max_tokens 以适应上下文窗口的工具函数
"""

from typing import Optional

from agentlang.interface.context import AgentContextInterface
from agentlang.logger import get_logger

logger = get_logger(__name__)

# 动态调整的 token 限制
MIN_MAX_TOKENS = 2048  # 最小 max_tokens 值
MAX_MAX_TOKENS = 64000  # 最大允许的 max_tokens 值 (64000)
DEFAULT_SAFETY_BUFFER = 100  # token 估算的安全缓冲区


async def get_current_tokens(
    agent_context: Optional[AgentContextInterface],
    request_id: str
) -> int:
    """从聊天历史获取当前 token 数量

    Args:
        agent_context: Agent 上下文接口
        request_id: 用于日志记录的请求 ID

    Returns:
        当前 token 数量，如果不可用则返回 0
    """
    if not agent_context:
        return 0

    try:
        chat_history = getattr(agent_context, 'chat_history', None)
        if chat_history:
            current_tokens = await chat_history.tokens_count()
            return current_tokens
        else:
            return 0
    except Exception:
        return 0


def adjust_max_tokens(
    requested_max_tokens: int,
    current_input_tokens: int,
    max_context_tokens: int,
    request_id: str
) -> int:
    """动态调整 max_tokens 以适应上下文窗口

    Args:
        requested_max_tokens: 原始请求的 max tokens
        current_input_tokens: 当前聊天历史的输入 token 数量
        max_context_tokens: 模型的最大上下文 token 数
        request_id: 用于日志记录的请求 ID

    Returns:
        调整后的 max tokens 值（不会超过 MAX_MAX_TOKENS）
    """
    # 计算可用于输出的 token 数
    available_tokens = max_context_tokens - current_input_tokens - DEFAULT_SAFETY_BUFFER

    # 确保最小 token 数
    if available_tokens < MIN_MAX_TOKENS:
        logger.warning(
            f"[{request_id}] 上下文窗口空间不足。"
            f"输入 tokens: {current_input_tokens}, "
            f"最大上下文: {max_context_tokens}, "
            f"可用: {available_tokens}, "
            f"设置为最小值: {MIN_MAX_TOKENS}"
        )
        return MIN_MAX_TOKENS

    # 如果请求的 token 数超过可用 token 数，则进行调整
    if requested_max_tokens > available_tokens:
        adjusted_tokens = available_tokens
        logger.info(
            f"[{request_id}] 调整 max_tokens 从 {requested_max_tokens} 到 {adjusted_tokens} "
            f"(输入: {current_input_tokens}, 最大上下文: {max_context_tokens})"
        )
        # 应用最大限制
        if adjusted_tokens > MAX_MAX_TOKENS:
            logger.info(
                f"[{request_id}] 调整后的 max_tokens {adjusted_tokens} 超过限制，"
                f"限制为 {MAX_MAX_TOKENS}"
            )
            return MAX_MAX_TOKENS
        return adjusted_tokens

    # 不需要调整，但仍需应用最大限制
    if requested_max_tokens > MAX_MAX_TOKENS:
        logger.info(
            f"[{request_id}] 请求的 max_tokens {requested_max_tokens} 超过限制，"
            f"限制为 {MAX_MAX_TOKENS}"
        )
        return MAX_MAX_TOKENS
    return requested_max_tokens
