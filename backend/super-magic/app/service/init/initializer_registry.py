"""工作区初始化启动器注册与编排。"""

import asyncio
from collections.abc import Iterable

from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.service.init.initializer import InitExecutionMode, InitInitializer

logger = get_logger(__name__)


class InitInitializerRegistry:
    """按阶段和执行模式运行工作区初始化启动器。"""

    def __init__(self) -> None:
        """创建空的启动器注册表。"""
        self._initializers: list[InitInitializer] = []

    def register(self, initializer: InitInitializer) -> None:
        """注册一个启动器，注册顺序用于同阶段串行执行。"""
        self._initializers.append(initializer)

    async def run(self, context: AgentContext) -> None:
        """按阶段执行启动器并隔离单项异常。"""
        grouped: dict[int, list[InitInitializer]] = {}
        for initializer in self._initializers:
            grouped.setdefault(initializer.order, []).append(initializer)

        for order in sorted(grouped):
            initializers = grouped[order]
            parallel = [item for item in initializers if item.mode == InitExecutionMode.PARALLEL]
            serial = [item for item in initializers if item.mode == InitExecutionMode.SERIAL]
            await self._run_parallel(parallel, context)
            for initializer in serial:
                await self._run_one(initializer, context)

    async def _run_parallel(self, initializers: Iterable[InitInitializer], context: AgentContext) -> None:
        """并发执行同一阶段的启动器。"""
        await asyncio.gather(*(self._run_one(initializer, context) for initializer in initializers))

    async def _run_one(self, initializer: InitInitializer, context: AgentContext) -> None:
        """执行单个启动器并隔离异常。"""
        try:
            await initializer.run(context)
            logger.info(f"工作区初始化启动器完成: {initializer.name}")
        except Exception as error:
            logger.error(f"工作区初始化启动器失败: {initializer.name}, error={error}")
