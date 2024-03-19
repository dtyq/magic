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
