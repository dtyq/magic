import asyncio
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Dict, Optional, Set

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext


@dataclass
class SubagentSessionHandle:
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    state_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    task: Optional[asyncio.Task] = None
    agent_context: Optional["AgentContext"] = None

    def is_running(self) -> bool:
        return self.task is not None and not self.task.done()


@dataclass(frozen=True)
class SubagentRunRef:
    """父 Agent run 派生出的一个子 Agent 运行引用。"""
    agent_name: str
    agent_id: str


class SubagentSessionManager:
    """同进程内的 subagent 会话协调器。"""

    def __init__(self) -> None:
        self._sessions: Dict[str, SubagentSessionHandle] = {}
        self._children_by_parent_context: Dict[str, Set[SubagentRunRef]] = {}
        self._registry_lock = asyncio.Lock()

    @staticmethod
    def _make_key(agent_name: str, agent_id: str) -> str:
        return f"{agent_name}<{agent_id}>"

    async def get_handle(self, agent_name: str, agent_id: str) -> SubagentSessionHandle:
        key = self._make_key(agent_name, agent_id)
        async with self._registry_lock:
            handle = self._sessions.get(key)
            if handle is None:
                handle = SubagentSessionHandle()
                self._sessions[key] = handle
            return handle

    async def bind_run(
        self,
        agent_name: str,
        agent_id: str,
        task: asyncio.Task,
        agent_context: "AgentContext",
    ) -> SubagentSessionHandle:
        handle = await self.get_handle(agent_name, agent_id)
        handle.task = task
        handle.agent_context = agent_context
        return handle

    async def register_child_run(self, parent_context_id: str, agent_name: str, agent_id: str) -> SubagentRunRef:
        """记录某个父 AgentContext 本轮 run 派生出的子 Agent。"""
        ref = SubagentRunRef(agent_name=agent_name, agent_id=agent_id)
        async with self._registry_lock:
            self._children_by_parent_context.setdefault(parent_context_id, set()).add(ref)
        return ref

    async def unregister_child_run(self, parent_context_id: str, ref: SubagentRunRef) -> None:
        """子 Agent 结束后解除父子运行关系。"""
        async with self._registry_lock:
            children = self._children_by_parent_context.get(parent_context_id)
            if not children:
                return
            children.discard(ref)
            if not children:
                self._children_by_parent_context.pop(parent_context_id, None)

    async def interrupt_child_runs(
        self,
        parent_context_id: str,
        reason: str,
        timeout: float = 10.0,
    ) -> dict[str, bool]:
        """中断指定父 AgentContext 当前登记的所有子 Agent 运行。"""
        async with self._registry_lock:
            refs = list(self._children_by_parent_context.get(parent_context_id, set()))

        results: dict[str, bool] = {}
        if not refs:
            return results

        async def _interrupt(ref: SubagentRunRef) -> None:
            key = self._make_key(ref.agent_name, ref.agent_id)
            results[key] = await self.interrupt_run(
                ref.agent_name,
                ref.agent_id,
                reason=reason,
                timeout=timeout,
            )

        await asyncio.gather(*(_interrupt(ref) for ref in refs))
        return results

    async def clear_run(self, agent_name: str, agent_id: str, task: asyncio.Task) -> None:
        handle = await self.get_handle(agent_name, agent_id)
        if handle.task is task:
            handle.task = None
            handle.agent_context = None

    async def interrupt_run(
        self,
        agent_name: str,
        agent_id: str,
        reason: str,
        timeout: float = 10.0,
    ) -> bool:
        handle = await self.get_handle(agent_name, agent_id)
        if not handle.is_running():
            return True

        if handle.agent_context is not None:
            handle.agent_context.set_interruption_request(True, reason)

        task = handle.task
        if task is None:
            return True

        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=timeout)
            return True
        except asyncio.CancelledError:
            return task.done()
        except asyncio.TimeoutError:
            task.cancel()
            try:
                await asyncio.wait_for(asyncio.shield(task), timeout=1.0)
            except asyncio.CancelledError:
                pass
            except Exception:
                pass
            return task.done()


subagent_session_manager = SubagentSessionManager()
