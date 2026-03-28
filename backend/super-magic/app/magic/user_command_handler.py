"""用户命令处理器

提供统一的用户命令注册、检测和处理机制。
支持命令变体（如多语言、简写、斜杠前缀等）。
"""

import asyncio
from dataclasses import dataclass
from typing import Callable, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from app.magic.agent import Agent

from agentlang.logger import get_logger

logger = get_logger(__name__)


@dataclass
class Command:
    """命令定义"""
    name: str  # 命令名称标识
    variants: List[str]  # 命令的各种变体形式
    handler: Callable  # 命令处理函数


class Commands:
    """命令注册中心

    提供命令的注册、查找和处理功能。
    命令在注册时自动构建查找表，支持快速检测。
    """

    _registry: List[Command] = []
    _lookup: dict = {}

    @classmethod
    def register(cls, name: str, variants: List[str], handler: Callable) -> Command:
        """注册命令

        Args:
            name: 命令名称
            variants: 命令变体列表（支持多语言、简写等）
            handler: 命令处理函数，签名为 (agent: Agent) -> str

        Returns:
            Command: 注册的命令对象
        """
        cmd = Command(name, variants, handler)
        cls._registry.append(cmd)

        # 立即构建查找表（不区分大小写）
        for variant in variants:
            cls._lookup[variant.lower()] = cmd

        logger.debug(f"注册命令: {name}, 变体: {variants}")
        return cmd

    @classmethod
    def get(cls, query: str) -> Optional[Command]:
        """获取命令

        Args:
            query: 用户输入

        Returns:
            Command: 如果是命令则返回命令对象，否则返回 None
        """
        return cls._lookup.get(query.lower())

    @classmethod
    async def process(cls, query: str, agent: 'Agent') -> str:
        """处理命令

        检测并转换用户输入。如果是命令，调用处理函数并返回转换后的内容；
        如果不是命令，返回原始输入。

        Args:
            query: 用户输入
            agent: Agent 实例

        Returns:
            str: 处理后的查询内容
        """
        cmd = cls.get(query)
        if not cmd:
            return query

        logger.info(f"检测到用户命令: {cmd.name}")

        # 调用处理函数
        result = cmd.handler(agent)

        # 处理异步结果
        if asyncio.iscoroutine(result):
            result = await result

        return result


# ===== 命令处理函数 =====

def handle_compact(agent: 'Agent') -> str:
    """处理压缩命令：返回压缩请求内容"""
    logger.info("用户手动触发聊天历史压缩")
    return agent._build_compact_request()


def handle_continue(agent: 'Agent') -> str:
    """处理继续命令：返回标准化的继续指令"""
    return "继续"


async def handle_new_session(agent: 'Agent') -> str:
    """处理新会话命令：清空上下文历史，根据 agent 模式发送对应的重置提示词"""
    logger.info("用户触发新会话重置 /new")
    await agent._reset_for_new_session()

    # magiclaw 模式有工作区文件（SOUL.md / USER.md / memory）需要在响应前读取，
    # 其他模式没有这套约定，只需简单问候即可
    chat_message = agent.agent_context.get_chat_client_message()
    is_magiclaw = chat_message and str(chat_message.agent_mode) == "magiclaw"

    if is_magiclaw:
        return (
            "A new session was started via /new. The previous conversation history has been cleared. "
            "Run your Session Startup sequence now before responding: read your workspace files "
            "(SOUL.md, USER.md, today's and yesterday's memory files, and MEMORY.md "
            "for a primary session). "
            "Then greet the user in your configured persona. "
            "Keep it to 1-3 sentences and ask what they want to do. "
            "Do not mention internal steps, files, or tools."
        )
    return (
        "A new session was started via /new. The previous conversation history has been cleared. "
        "Greet the user briefly and ask what they want to do. "
        "Keep it to 1-2 sentences. Do not mention internal steps or tools."
    )


# ===== 注册内置命令 =====

Commands.register(
    name="compact",
    variants=['/compact', '/c', 'compact', '压缩'],
    handler=handle_compact
)

Commands.register(
    name="continue",
    variants=['', ' ', 'continue', '继续'],
    handler=handle_continue
)

Commands.register(
    name="new",
    variants=['/new', '/reset'],
    handler=handle_new_session
)
