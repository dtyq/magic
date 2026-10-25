"""主 Agent 文件记忆生命周期事件监听器。"""

from __future__ import annotations

from typing import TYPE_CHECKING

from agentlang.event.data import AfterMainAgentRunEventData
from agentlang.event.event import Event, EventType
from agentlang.interface.context import AgentContextInterface
from agentlang.logger import get_logger
from app.service.memory.policies.memory_skill_policy import is_memory_maintenance_enabled

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
    from app.service.memory.runtime.lifecycle.memory_lifecycle_coordinator import (
        MemoryLifecycleCoordinator,
    )

logger = get_logger(__name__)


class MemoryListenerService:
    """监听主 Agent 回合边界，并委托给文件记忆生命周期协调器。"""

    _lifecycle_coordinator: MemoryLifecycleCoordinator | None = None

    @classmethod
    def register_standard_listeners(cls, agent_context: "AgentContext") -> None:
        """注册运行后记忆提取预留事件。"""
        from app.service.agent_event.base_listener_service import BaseListenerService

        BaseListenerService.register_listeners(
            agent_context,
            {
                EventType.AFTER_MAIN_AGENT_RUN: cls._handle_after_main_agent_run,
            },
        )
        logger.info("已注册文件记忆生命周期事件监听器")

    @classmethod
    async def _handle_after_main_agent_run(
        cls,
        event: Event[AfterMainAgentRunEventData],
    ) -> None:
        """在主 Agent 结束后进入记忆提取预留扩展点。"""
        agent_context = cls._resolve_agent_context(event.data.agent_context)
        if agent_context is None or not cls._is_enabled(agent_context):
            return
        await cls._get_lifecycle_coordinator().after_run(agent_context, event)

    @classmethod
    def _get_lifecycle_coordinator(cls) -> "MemoryLifecycleCoordinator":
        """延迟创建生命周期协调器，避免事件模块加载额外运行时。"""
        if cls._lifecycle_coordinator is None:
            from app.service.memory.runtime.lifecycle.memory_lifecycle_coordinator import (
                MemoryLifecycleCoordinator,
            )

            cls._lifecycle_coordinator = MemoryLifecycleCoordinator()
        return cls._lifecycle_coordinator

    @staticmethod
    def _resolve_agent_context(
        agent_context: AgentContextInterface,
    ) -> "AgentContext | None":
        """将事件接口上下文安全收窄为 Super Magic AgentContext。"""
        from app.core.context.agent_context import AgentContext

        if isinstance(agent_context, AgentContext):
            return agent_context
        logger.warning(f"记忆监听器忽略不支持的上下文类型: {type(agent_context).__name__}")
        return None

    @staticmethod
    def _is_enabled(agent_context: "AgentContext") -> bool:
        """
        仅为主 Agent 启用；通用 Agent 尊重开关，Claw 保持原有行为。

        事件监听器只决定是否进入自动流程；不能把此判断传播成用户手动记忆工具的权限。
        开关、Skill 实际可用性与 Claw 例外集中在同一政策函数，防止多个入口各写一套解释。
        """
        return is_memory_maintenance_enabled(agent_context)
