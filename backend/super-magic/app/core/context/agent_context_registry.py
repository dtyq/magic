"""
全局 AgentContext 注册表

context_id（UUID hex）→ AgentContext 映射，供 Skill Code Mode HTTP 端点
精确路由工具调用到发起调用的 Agent 上下文。

并发约束：
- 本设施默认运行在主线程的主事件循环中
- 不为多线程直接访问提供线程锁
- 若未来要支持跨线程直接访问，必须先明确架构变更，再补线程安全边界
"""

from typing import TYPE_CHECKING, Dict, List, Optional

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext


class AgentContextRegistry:
    """主线程事件循环内使用的 AgentContext 注册表。"""

    _instance: Optional["AgentContextRegistry"] = None

    @classmethod
    def get_instance(cls) -> "AgentContextRegistry":
        """获取全局单例实例。"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self) -> None:
        self._registry: Dict[str, "AgentContext"] = {}

    def register(self, ctx: "AgentContext") -> None:
        """注册 AgentContext。同一 context_id 重复注册时覆盖（幂等）。"""
        self._registry[ctx.context_id] = ctx

    def unregister(self, ctx: "AgentContext") -> None:
        """注销 AgentContext。context_id 不存在时静默忽略。"""
        self._registry.pop(ctx.context_id, None)

    def get(self, context_id: str) -> Optional["AgentContext"]:
        """按 context_id 查找 AgentContext，找不到返回 None。"""
        return self._registry.get(context_id)

    def list_contexts(self) -> List["AgentContext"]:
        """返回当前仍注册的 AgentContext 快照。"""
        return list(self._registry.values())
