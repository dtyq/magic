import asyncio
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Dict, Optional

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


class SubagentSessionManager:
    """同进程内的 subagent 会话协调器。"""

    def __init__(self) -> None:
        self._sessions: Dict[str, SubagentSessionHandle] = {}
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
        except asyncio.TimeoutError:
            task.cancel()
            try:
                await asyncio.wait_for(asyncio.shield(task), timeout=1.0)
            except Exception:
                pass
            return task.done()


subagent_session_manager = SubagentSessionManager()
