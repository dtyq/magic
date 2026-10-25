"""通用沙箱任务运行时。"""

import asyncio
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Awaitable, Callable

from loguru import logger

from app.path_manager import PathManager
from app.service.sandbox_task.models import SandboxTask, SandboxTaskStatus
from app.utils.async_file_utils import (
    async_chmod,
    async_exists,
    async_iterdir,
    async_read_text,
    async_rmdir,
    async_scandir,
    async_unlink,
    async_write_text,
)
from app.utils.runtime_storage import ensure_runtime_directory, trigger_opportunistic_cleanup

TaskWorker = Callable[[SandboxTask, Callable[[SandboxTaskStatus], Awaitable[None]]], Awaitable[dict[str, Any]]]

# 终态任务的状态文件保留 7 天：publishAsyncStatusManager 只在发布窗口内查询结果，
# 7 天远大于该窗口；超期后由机会式清理淘汰，避免长期运行的 sandbox 无限积累
_TERMINAL_STATUSES = frozenset(
    {
        SandboxTaskStatus.COMPLETED,
        SandboxTaskStatus.FAILED,
        SandboxTaskStatus.CANCELLED,
    }
)
_TERMINAL_STATE_RETENTION = timedelta(days=7)
# 旧版状态目录名（.workspace/.magic/sandbox-tasks），仅用于启动时一次性迁移
_LEGACY_STATE_DIR_NAME = "sandbox-tasks"


class SandboxTaskManager:
    """提供任务创建、状态持久化和后台执行能力。"""

    _instance: "SandboxTaskManager | None" = None

    def __init__(self) -> None:
        """初始化任务管理器。"""
        self._tasks: dict[str, SandboxTask] = {}
        self._workers: dict[str, asyncio.Task[Any]] = {}
        self._lock = asyncio.Lock()

    @classmethod
    def instance(cls) -> "SandboxTaskManager":
        """获取进程级任务管理器。"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def state_dir(self) -> Path:
        """获取任务状态文件目录（project_root/.runtime/sandbox_tasks）。

        状态文件是可重建的运行数据，必须放在 magicfs 未接管的本地目录：
        写入 .workspace 时每次 tmp+replace 落盘都会在云端产生一条
        magic_super_agent_task_files 记录（0 字节垃圾文件）。
        """
        return PathManager.get_sandbox_tasks_dir()

    @property
    def legacy_state_dir(self) -> Path:
        """获取旧版状态目录（.workspace/.magic/sandbox-tasks），仅用于启动迁移。"""
        return PathManager.get_workspace_dir() / ".magic" / _LEGACY_STATE_DIR_NAME

    def state_path(self, task_id: str) -> Path:
        """获取指定任务状态文件路径。"""
        return self.state_dir / f"{task_id}.json"

    async def create_or_get(
        self,
        task_id: str,
        capability: str,
        project_path: str,
        payload: dict[str, Any],
        worker: TaskWorker,
    ) -> SandboxTask:
        """幂等创建任务并安排后台执行。"""
        async with self._lock:
            task = self._tasks.get(task_id) or await self._load(task_id)
            if task is None:
                task = SandboxTask(
                    task_id=task_id,
                    capability=capability,
                    project_path=project_path,
                    payload=payload,
                )
                self._tasks[task_id] = task
                await self._persist(task)
            elif task.capability != capability or task.project_path != project_path:
                raise ValueError(f"Task ID already belongs to another task: {task_id}")
            elif task.payload != payload and task.status not in {
                SandboxTaskStatus.FAILED,
                SandboxTaskStatus.CANCELLED,
            }:
                raise ValueError(f"Task ID already belongs to another task: {task_id}")

            if task.status in {SandboxTaskStatus.FAILED, SandboxTaskStatus.CANCELLED}:
                task.payload = payload
                task.status = SandboxTaskStatus.QUEUED
                task.output = None
                task.error_message = None
                task.updated_at = datetime.now()
                self._tasks[task_id] = task
                await self._persist(task)

            if task.status != SandboxTaskStatus.COMPLETED and task_id not in self._workers:
                self._workers[task_id] = asyncio.create_task(self._run(task, worker))
            return task

    async def get(self, task_id: str) -> SandboxTask | None:
        """读取任务当前状态。"""
        async with self._lock:
            task = self._tasks.get(task_id)
            if task is not None:
                return task.model_copy(deep=True)
            task = await self._load(task_id)
            if task is not None:
                self._tasks[task_id] = task
                return task.model_copy(deep=True)
            return None

    async def cancel(self, task_id: str) -> SandboxTask | None:
        """取消尚未完成的任务。"""
        async with self._lock:
            task = self._tasks.get(task_id) or await self._load(task_id)
            if task is None:
                return None
            if task.status in {SandboxTaskStatus.COMPLETED, SandboxTaskStatus.FAILED}:
                return task
            task.status = SandboxTaskStatus.CANCELLED
            task.updated_at = datetime.now()
            await self._persist(task)
            worker = self._workers.get(task_id)
            if worker is not None:
                worker.cancel()
            return task.model_copy(deep=True)

    async def update_output(self, task_id: str, values: dict[str, Any]) -> None:
        """保存任务中间产物，支持服务重启后继续同一 Canvas Content。"""
        async with self._lock:
            task = self._tasks.get(task_id) or await self._load(task_id)
            if task is None:
                return
            task.output = {**(task.output or {}), **values}
            task.updated_at = datetime.now()
            self._tasks[task_id] = task
            await self._persist(task)

    async def recover(self, worker: TaskWorker) -> int:
        """服务启动时迁移旧状态目录并恢复未完成任务。"""
        await self._migrate_legacy_state_dir()
        recovered = 0
        if not await async_exists(self.state_dir):
            return recovered
        for path in await async_iterdir(self.state_dir):
            if path.suffix != ".json":
                continue
            task = await self._load(path.stem)
            if task is None or task.status in _TERMINAL_STATUSES:
                continue
            self._tasks[task.task_id] = task
            if task.task_id not in self._workers:
                self._workers[task.task_id] = asyncio.create_task(self._run(task, worker))
                recovered += 1
        return recovered

    async def _run(self, task: SandboxTask, worker: TaskWorker) -> None:
        """执行任务并将异常转换为失败状态。"""
        try:
            output = await worker(task, lambda status: self._update_status(task.task_id, status))
            await self._update(task.task_id, status=SandboxTaskStatus.COMPLETED, output=output)
        except asyncio.CancelledError:
            await self._update(task.task_id, status=SandboxTaskStatus.CANCELLED)
        except Exception as error:
            logger.exception("Sandbox task failed: {}", task.task_id)
            await self._update(
                task.task_id,
                status=SandboxTaskStatus.FAILED,
                error_message=str(error)[:2000],
            )
        finally:
            self._workers.pop(task.task_id, None)

    async def _update_status(self, task_id: str, status: SandboxTaskStatus) -> None:
        """更新任务状态。"""
        await self._update(task_id, status=status)

    async def _update(
        self,
        task_id: str,
        *,
        status: SandboxTaskStatus | None = None,
        output: dict[str, Any] | None = None,
        error_message: str | None = None,
    ) -> None:
        """原子更新任务快照并落盘。"""
        async with self._lock:
            task = self._tasks.get(task_id) or await self._load(task_id)
            if task is None:
                return
            if status is not None:
                task.status = status
            if output is not None:
                task.output = output
            if error_message is not None:
                task.error_message = error_message
            task.updated_at = datetime.now()
            self._tasks[task_id] = task
            await self._persist(task)

    async def _load(self, task_id: str) -> SandboxTask | None:
        """从状态文件读取任务。"""
        path = self.state_path(task_id)
        if not await async_exists(path):
            return None
        try:
            return SandboxTask.model_validate_json(await async_read_text(path))
        except (OSError, ValueError):
            logger.warning("Unable to read sandbox task state: {}", path)
            return None

    async def _persist(self, task: SandboxTask) -> None:
        """持久化任务快照；终态落盘时顺手触发一次过期状态清理。"""
        await ensure_runtime_directory(self.state_dir)
        await asyncio.to_thread(self._persist_sync, task)
        if task.status in _TERMINAL_STATUSES:
            trigger_opportunistic_cleanup("sandbox_task_state", self._evict_stale_states)

    def _persist_sync(self, task: SandboxTask) -> None:
        """同步执行原子状态写入，要求父目录已由 _persist 创建。

        tmp+replace 在本地磁盘上具备 POSIX 原子语义；该写法禁止用于
        magicfs 挂载目录（.workspace/.topic），那里一次 replace 会被
        记录为「新 file_id + 软删旧记录」。
        """
        path = self.state_path(task.task_id)
        temporary = path.with_name(f".{task.task_id}.tmp")
        temporary.write_text(task.model_dump_json(indent=2), encoding="utf-8")
        os.chmod(temporary, 0o600)
        temporary.replace(path)

    async def _migrate_legacy_state_dir(self) -> None:
        """把旧版 .workspace 内的状态文件迁到 .runtime，并清掉 AGFS 上的残留。

        逐文件执行「读旧 → 校验 → 写新 → 删旧」：
        - 单文件失败时保留旧文件，下次启动重试，迁移整体幂等；
        - json 之外的文件只有 tmp+replace 的瞬时残留，直接删除；
        - 删除旧文件会让 magicfs 软删对应云端记录，正是期望的清理效果。
        """
        legacy_dir = self.legacy_state_dir
        if not await async_exists(legacy_dir):
            return
        logger.info("Migrating legacy sandbox task states: {}", legacy_dir)
        await ensure_runtime_directory(self.state_dir)
        for entry in await async_scandir(legacy_dir):
            path = Path(entry.path)
            if entry.is_symlink() or not entry.is_file(follow_symlinks=False):
                continue
            try:
                if path.suffix == ".json":
                    content = await async_read_text(path)
                    SandboxTask.model_validate_json(content)
                    target = self.state_path(path.stem)
                    # 新目录已有同名状态（此前迁移或新写入）时以新目录为准，只删旧文件
                    if not await async_exists(target):
                        await async_write_text(target, content)
                        await async_chmod(target, 0o600)
                await async_unlink(path)
            except (OSError, ValueError) as error:
                logger.warning("Skip legacy sandbox task state {}: {}", path, error)
        try:
            await async_rmdir(legacy_dir)
        except OSError:
            # 目录非空（存在无法迁移的残留）时保留，下次启动继续尝试
            pass

    async def _evict_stale_states(self) -> None:
        """机会式淘汰终态且超过保留期的状态文件。

        以任务状态而不是文件 mtime 判断：未终结任务的状态必须保留，
        供 export/check 查询与进程重启后的 recover 使用。
        """
        if not await async_exists(self.state_dir):
            return
        cutoff = datetime.now() - _TERMINAL_STATE_RETENTION
        for path in await async_iterdir(self.state_dir):
            if path.suffix != ".json":
                continue
            try:
                task = SandboxTask.model_validate_json(await async_read_text(path))
            except (OSError, ValueError):
                continue
            if task.status in _TERMINAL_STATUSES and task.updated_at < cutoff:
                await async_unlink(path)
