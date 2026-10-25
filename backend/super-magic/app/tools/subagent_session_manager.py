import asyncio
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Dict, Optional, Set

from agentlang.logger import get_logger

logger = get_logger(__name__)

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
    """同进程内的 subagent 会话协调器。

    会话是否存在由两部分共同判断：

        当前进程正在启动/运行 -> SubagentSessionManager
        已经落盘或已经结束   -> SubagentRuntimeStore

    之所以不能只查文件，是因为 AgentRuntime 启动后到第一份 session 文件写出前存在一个
    短暂窗口；这段时间另一次新建请求仍然必须把该 ID 视为已占用。
    """

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

    async def has_session(self, agent_name: str, agent_id: str) -> bool:
        """检查当前进程是否正在运行该会话；已结束会话由持久化文件判断。

        这里补的是“Agent 已启动，但会话文件还没来得及写出”的短暂窗口，
        不负责判断历史文件是否存在。
        """
        key = self._make_key(agent_name, agent_id)
        async with self._registry_lock:
            handle = self._sessions.get(key)
            return handle is not None and (
                handle.task is not None or handle.agent_context is not None
            )

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

    async def list_running_child_runs(self, parent_context_id: str) -> list[SubagentRunRef]:
        """只读查询该父上下文仍在运行的子 Agent，不创建句柄或修改父子登记。"""
        running: list[SubagentRunRef] = []
        async with self._registry_lock:
            for ref in self._children_by_parent_context.get(parent_context_id, set()):
                handle = self._sessions.get(self._make_key(ref.agent_name, ref.agent_id))
                # task 可能已结束，但注销回调尚未执行；不能只凭父子登记判断仍在运行。
                if handle is not None and handle.is_running():
                    running.append(ref)
        return sorted(running, key=lambda ref: (ref.agent_name, ref.agent_id))

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

    async def interrupt_all_runs(self, reason: str, timeout: float = 10.0) -> None:
        """沙盒重启时中断所有登记的子 Agent，包括隔离运行的压缩和记忆 Agent。"""
        async with self._registry_lock:
            runs = [(key, handle) for key, handle in self._sessions.items() if handle.is_running()]

        async def _interrupt(key: str, handle: SubagentSessionHandle) -> None:
            try:
                if not await self._interrupt_handle(handle, reason, timeout):
                    logger.warning("Sub-agent did not stop before sandbox restart: %s", key)
            except Exception as exc:
                logger.warning("Unable to interrupt sub-agent %s: %s", key, exc, exc_info=True)

        await asyncio.gather(*(_interrupt(key, handle) for key, handle in runs))

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
        return await self._interrupt_handle(handle, reason, timeout)

    @staticmethod
    async def _interrupt_handle(
        handle: SubagentSessionHandle,
        reason: str,
        timeout: float,
    ) -> bool:
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
