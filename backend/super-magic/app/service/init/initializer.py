"""工作区初始化启动器协议与执行模式。"""

from enum import StrEnum
from typing import Protocol

from app.core.context.agent_context import AgentContext


class InitExecutionMode(StrEnum):
    """初始化启动器执行模式。"""

    PARALLEL = "parallel"
    SERIAL = "serial"


class InitInitializer(Protocol):
    """可注册的工作区初始化启动器。"""

    name: str
    order: int
    mode: InitExecutionMode

    async def run(self, context: AgentContext) -> None:
        """执行初始化任务。"""
