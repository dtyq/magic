"""基于完整 fork 执行会话后记忆提取。"""

from __future__ import annotations

import asyncio
import os
import threading
import uuid
from typing import TYPE_CHECKING, ClassVar

from agentlang.logger import get_logger
from app.service.memory.runtime.extraction.memory_extraction_prompt_provider import (
    MemoryExtractionPromptProvider,
)

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
    from app.core.models.agent_session import AgentSessionRef
    from app.service.agent_context_snapshot_service import AgentContextSnapshot

logger = get_logger(__name__)


class MemoryExtractionService:
    """为符合条件的回合创建后台 fork 记忆提取任务，并保证全局单任务运行。"""

    _run_lock_guard = threading.Lock()
    _run_lock = threading.Lock()
    # 与进程级整理锁保持同一范围，重启时能取消外层任务，避免子 Agent
    # 被中断后，外层仍继续发布档案和上传。
    _tasks: ClassVar[set[asyncio.Task[None]]] = set()

    def __init__(
        self,
        prompt_provider: MemoryExtractionPromptProvider | None = None,
    ) -> None:
        """初始化记忆整理提示词提供者。"""
        self._prompt_provider = prompt_provider or MemoryExtractionPromptProvider()

    def submit(
        self,
        agent_context: "AgentContext",
        snapshot: "AgentContextSnapshot",
    ) -> bool:
        """提交当前回合；已有记忆整理任务运行时直接跳过并返回 False。"""
        from app.service.sandbox_restart_coordinator import sandbox_restart_coordinator

        if sandbox_restart_coordinator.is_restarting:
            return False
        if not self._try_acquire_run_lock():
            source = snapshot.source
            logger.info(
                "已有会话后记忆整理任务运行，跳过本次提取: "
                f"source={source.target.agent_name}<{source.agent_id}>"
            )
            return False

        generation = uuid.uuid4().hex
        try:
            task = asyncio.create_task(
                self._run_extraction(agent_context, snapshot, generation),
                name=f"memory-after-run-{generation}",
            )
        except BaseException:
            self._release_run_lock()
            raise
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        task.add_done_callback(self._release_run_lock_callback)
        source = snapshot.source
        logger.info(
            "会话后记忆提取任务已发起: "
            f"source={source.target.agent_name}<{source.agent_id}>, generation={generation}"
        )
        return True

    @classmethod
    async def interrupt_all(cls, timeout: float = 10.0) -> None:
        """取消所有记忆提取外层任务，限时等待清理，不延迟强制重启。"""
        tasks = [task for task in cls._tasks if not task.done()]
        if not tasks:
            return
        for task in tasks:
            task.cancel()
        _, pending = await asyncio.wait(tasks, timeout=timeout)
        if pending:
            logger.warning("记忆提取任务未在重启收尾时限内结束: count=%s", len(pending))

    async def _run_extraction(
        self,
        agent_context: "AgentContext",
        snapshot: "AgentContextSnapshot",
        generation: str,
    ) -> None:
        """指定记忆模型，在完整 fork 末尾追加 user 消息并继续运行。"""
        try:
            from app.core.ai_abilities import get_memory_model_id
            from app.path_manager import PathManager
            from app.service.agent_runner import (
                IsolatedAgentModelRequest,
                IsolatedAgentRunRequest,
                run_isolated_agent,
            )
            from app.utils.runtime_storage import (
                RuntimeEvictionPolicy,
                ensure_runtime_directory,
                evict_runtime_directories,
                get_runtime_config_int,
                trigger_opportunistic_cleanup,
            )

            source = snapshot.source
            agent_id = f"memory-after-run-{generation}"
            """
            target 延续原 Agent 的能力配置，agent_id 标识这次独立后台运行；两者不是话题 ID。
            同一份快照同时生成来源说明并交给 runner，避免说明来自话题 A、实际处理话题 B。
            """
            prompt = await self._prompt_provider.load(
                snapshot,
                agent_context=agent_context,
            )
            runtime_dir = await ensure_runtime_directory(
                PathManager.get_memory_after_run_dir()
                / f"{source.target.agent_name}<{agent_id}>"
            )
            trigger_opportunistic_cleanup(
                "memory_after_run",
                lambda: evict_runtime_directories(
                    PathManager.get_memory_after_run_dir(),
                    policy=RuntimeEvictionPolicy(
                        max_age_seconds=get_runtime_config_int(
                            "runtime_cleanup.memory_after_run.max_age_days",
                            minimum=1,
                        )
                        * 24
                        * 60
                        * 60,
                    ),
                    protected_paths=frozenset({runtime_dir}),
                ),
            )
            """
            runner 在完整 fork 后追加 prompt 作为 User 消息，后台只负责记忆任务。
            临时会话历史留在 runtime_dir；真正要保留的用户记忆由工具写入允许的记忆根。
            """
            await run_isolated_agent(
                IsolatedAgentRunRequest(
                    target=source.target,
                    agent_id=agent_id,
                    prompt=prompt,
                    parent_context=agent_context,
                    models=IsolatedAgentModelRequest(text_model_id=get_memory_model_id()),
                    snapshot=snapshot,
                    chat_history_dir=runtime_dir,
                )
            )
            current_task = asyncio.current_task()
            if current_task is not None and current_task.cancelling():
                raise asyncio.CancelledError
            from app.core.models.agent_session import AgentSessionRef
            await self._archive_extraction(
                agent_context,
                AgentSessionRef(source.target, agent_id, runtime_dir),
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.warning("会话后记忆提取失败，本轮主任务不受影响", exc_info=True)

    @staticmethod
    async def _archive_extraction(agent_context: "AgentContext", session: "AgentSessionRef") -> None:
        """先保留本地完整副本，再尝试上传；凭证或网络故障不丢掉本地记录。"""
        from app.service.chat_history_archive_service import ChatHistoryArchiveService
        from app.path_manager import PathManager
        from app.tools.core.tool_keepalive import DEFAULT_KEEP_ALIVE_INTERVAL

        archive_context = (
            f"source={agent_context.get_agent_name()}<{agent_context.get_agent_id()}> "
            f"target={session.target.agent_name}<{session.agent_id}> "
            f"runtime_dir={session.chat_history_dir} "
            f"archive_dir={PathManager.get_subagent_chat_history_dir(session.target.agent_name, session.agent_id)}"
        )

        async def keep_alive() -> None:
            while True:
                agent_context.update_activity_time()
                await asyncio.sleep(DEFAULT_KEEP_ALIVE_INTERVAL)

        keep_alive_task = asyncio.create_task(keep_alive())
        try:
            archive = ChatHistoryArchiveService()
            if not await archive.publish_completed_session(session):
                logger.warning(f"记忆整理档案本地发布未完成: {archive_context}")
                return
            if os.getenv("ENABLE_PROJECT_ARCHIVE", "true").lower() != "true":
                logger.info(f"记忆整理档案仅保存在本地，上传已关闭: {archive_context}")
                return
            metadata = agent_context.get_metadata()
            topic_id = metadata.get("topic_id") or metadata.get("chat_topic_id")
            if not topic_id:
                logger.warning(f"记忆整理档案未上传，来源缺少 topic_id: {archive_context}")
                return
            from app.infrastructure.storage.factory import StorageFactory
            storage = await StorageFactory.get_storage(
                sts_token_refresh=agent_context.get_init_client_message_sts_token_refresh(),
                metadata=metadata,
                platform=agent_context.get_init_client_message_platform_type(),
            )
            uploaded = await archive.upload(topic_id=str(topic_id), storage_service=storage)
            logger.info(f"记忆整理档案上传结果: {archive_context} uploaded={uploaded}")
        except Exception as error:
            logger.warning(f"记忆整理档案未完成上传，保留本地记录: {archive_context} error={error!r}")
        finally:
            keep_alive_task.cancel()
            await asyncio.gather(keep_alive_task, return_exceptions=True)

    @classmethod
    def _try_acquire_run_lock(cls) -> bool:
        """以非阻塞方式获取进程内跨实例的记忆整理锁。"""
        with cls._run_lock_guard:
            return cls._run_lock.acquire(blocking=False)

    @classmethod
    def _release_run_lock_callback(cls, _task: "asyncio.Task[None]") -> None:
        """在记忆整理子 Agent 完成后释放运行时锁。"""
        cls._release_run_lock()

    @classmethod
    def _release_run_lock(cls) -> None:
        """释放当前进程持有的内存记忆整理锁。"""
        with cls._run_lock_guard:
            if cls._run_lock.locked():
                cls._run_lock.release()


__all__ = ["MemoryExtractionService"]
