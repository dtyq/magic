"""
后台 shell 任务进程管理器（进程内单例）。

职责：
- 启动时扫描 .runtime/bg_shell/ 目录，解析 log header/footer 恢复历史任务元数据
- 注册新后台任务（并发上限检查，超限拒绝）
- 状态变更时通过 BgOutputStore 写 [STATUS] footer 到日志末尾
- Reaper 协程（每 60s 扫描超过 1 小时的任务并强制 kill）
- 提供 write_stdin / get_output_since / wait_for_pattern 接口

线程安全说明：
    所有方法均在主事件循环中运行，无需多线程锁。
    Reaper 协程通过 try/except Exception 自动重启，防止单次异常导致静默退出。
"""

import asyncio
import re
import time
from pathlib import Path
from typing import ClassVar, Optional

from agentlang.logger import get_logger
from app.tools.shell_exec_utils.bg_output_store import BgOutputStore
from app.tools.shell_exec_utils.bg_task_models import (
    BG_MAX_CONCURRENT_TASKS,
    BG_MAX_TASK_LIFETIME_SECS,
    BackgroundTask,
    TaskStatus,
)
from app.utils.async_file_utils import async_exists

logger = get_logger(__name__)

# ── 日志格式解析正则 ───────────────────────────────────────────────────────────

# [TASK] task_id=<uuid> command="<cmd>" cwd="<cwd>" pid=<int> created_at=<float>
_HEADER_RE = re.compile(
    r'\[TASK\]\s+task_id=(\S+)\s+command="((?:[^"\\]|\\.)*)"\s+'
    r'cwd="((?:[^"\\]|\\.)*)"\s+pid=(\d+)\s+created_at=([\d.]+)'
)

# [STATUS] <status> exit_code=<int|null> finished_at=<float>
_STATUS_RE = re.compile(
    r'\[STATUS\]\s+(\w+)\s+exit_code=(null|-?\d+)\s+finished_at=([\d.]+)'
)

_REAPER_INTERVAL_SECS: float = 60.0


class TooManyBackgroundTasksError(Exception):
    """后台任务并发数已达上限时抛出。"""

    def __init__(self, current_count: int, running_tasks: list[BackgroundTask]) -> None:
        self.current_count = current_count
        self.running_tasks = running_tasks
        super().__init__(
            f"Background task limit reached ({current_count}/{BG_MAX_CONCURRENT_TASKS} running)"
        )


class BackgroundProcessManager:
    """
    后台 shell 进程管理器，进程内单例。

    通过 get_instance() 获取实例；首次调用会自动完成初始化和历史任务恢复。
    """

    _instance: ClassVar[Optional["BackgroundProcessManager"]] = None
    _initializing: ClassVar[bool] = False

    def __init__(self, store: BgOutputStore) -> None:
        self._tasks: dict[str, BackgroundTask] = {}
        self._store = store
        self._reaper_task: Optional[asyncio.Task] = None

    # ── 单例管理 ──────────────────────────────────────────────────────────────

    @classmethod
    async def get_instance(cls) -> "BackgroundProcessManager":
        """
        获取单例实例，首次调用时自动初始化。

        在主事件循环中调用；asyncio 单线程语义保证不会产生竞态。
        """
        if cls._instance is None:
            if cls._initializing:
                raise RuntimeError("BackgroundProcessManager 初始化重入，请检查调用链路")
            cls._initializing = True
            try:
                from app.path_manager import PathManager
                bg_shell_dir = PathManager.get_bg_shell_dir()
                store = BgOutputStore(bg_shell_dir)
                instance = cls(store)
                await instance._load_history()
                instance._start_reaper()
                cls._instance = instance
            finally:
                cls._initializing = False
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """仅供测试使用：清除单例状态。"""
        if cls._instance is not None and cls._instance._reaper_task is not None:
            cls._instance._reaper_task.cancel()
        cls._instance = None
        cls._initializing = False

    # ── 初始化：历史任务恢复 ──────────────────────────────────────────────────

    async def _load_history(self) -> None:
        """扫描 bg_shell 目录，从 log 文件 header/footer 恢复历史任务只读元数据。"""
        bg_shell_dir = self._store._dir
        if not await async_exists(bg_shell_dir):
            return

        import aiofiles.os
        entries = []
        try:
            with await aiofiles.os.scandir(str(bg_shell_dir)) as scanner:  # type: ignore[attr-defined]
                for entry in scanner:
                    if entry.is_file() and entry.name.endswith(".log"):
                        entries.append(entry)
        except Exception as e:
            logger.warning("扫描 bg_shell 目录失败，跳过历史任务恢复: %s", e)
            return

        for entry in entries:
            task_id = Path(entry.path).stem
            try:
                task = await self._recover_from_log(task_id)
                if task is not None:
                    self._tasks[task_id] = task
                    logger.debug(
                        "恢复历史任务: task_id=%s status=%s pid=%d",
                        task_id, task.status.value, task.pid,
                    )
            except Exception as e:
                logger.warning("从日志恢复任务 %s 失败（跳过）: %s", task_id, e)

        if self._tasks:
            logger.info("历史任务恢复完成，共 %d 条", len(self._tasks))

    async def _recover_from_log(self, task_id: str) -> Optional[BackgroundTask]:
        """从单个 log 文件解析 header + footer，重建只读任务元数据。"""
        content = await self._store.read_full(task_id)
        if not content:
            return None

        lines = content.splitlines()
        if not lines:
            return None

        # 解析 header（第一行）
        header_m = _HEADER_RE.match(lines[0])
        if not header_m:
            logger.debug("日志 %s header 格式无法识别，跳过", task_id)
            return None

        parsed_task_id, command, cwd, pid_str, created_at_str = header_m.groups()
        # 反转义命令和路径
        command = command.replace('\\"', '"')
        cwd = cwd.replace('\\"', '"')

        # 解析 footer（从末尾往前找第一条非空行）
        status = TaskStatus.ERROR  # 无 footer 则推断为进程意外中断
        exit_code: Optional[int] = None
        finished_at: Optional[float] = None

        for line in reversed(lines):
            if not line.strip():
                continue
            footer_m = _STATUS_RE.match(line)
            if footer_m:
                status_str, exit_code_str, finished_at_str = footer_m.groups()
                try:
                    status = TaskStatus(status_str.lower())
                except ValueError:
                    status = TaskStatus.ERROR
                exit_code = None if exit_code_str == "null" else int(exit_code_str)
                finished_at = float(finished_at_str)
            break

        return BackgroundTask(
            task_id=parsed_task_id,
            command=command,
            cwd=cwd,
            pid=int(pid_str),
            status=status,
            exit_code=exit_code,
            created_at=float(created_at_str),
            finished_at=finished_at,
            process=None,  # 重启后进程句柄已失效
        )

    # ── Reaper ────────────────────────────────────────────────────────────────

    def _start_reaper(self) -> None:
        """启动 Reaper 协程（后台定时清理超时任务）。"""
        self._reaper_task = asyncio.ensure_future(self._reaper_loop())

    async def _reaper_loop(self) -> None:
        """
        每 60s 扫描一次，强制 kill 运行超过 BG_MAX_TASK_LIFETIME_SECS 的任务。

        Reaper 健壮性：内层 try/except Exception 捕获所有非 Cancel 异常并记录日志后继续循环，
        防止单次异常导致协程静默退出、后台进程永不被清理。
        """
        while True:
            try:
                await asyncio.sleep(_REAPER_INTERVAL_SECS)
                await self._reap_expired()
            except asyncio.CancelledError:
                logger.info("Reaper 协程已取消")
                raise
            except Exception as e:
                logger.exception("Reaper 协程遇到异常（将在 %ds 后继续）: %s", _REAPER_INTERVAL_SECS, e)

    async def _reap_expired(self) -> None:
        """检查并强制 kill 超过最长存活时间的 RUNNING 任务。"""
        now = time.time()
        for task in list(self._tasks.values()):
            if task.status != TaskStatus.RUNNING:
                continue
            elapsed = now - task.created_at
            if elapsed <= BG_MAX_TASK_LIFETIME_SECS:
                continue
            logger.warning(
                "任务 %s 运行已达 %.0fs，超过上限 %ds，强制 kill",
                task.task_id, elapsed, BG_MAX_TASK_LIFETIME_SECS,
            )
            try:
                await self._do_kill(task)
                # 额外在日志末尾追加 kill 原因备注
                await self._store.append_output(
                    task.task_id, "stdout",
                    f"[KILLED: exceeded max lifetime {BG_MAX_TASK_LIFETIME_SECS}s]",
                )
            except Exception as e:
                logger.exception("Reaper kill 任务 %s 失败: %s", task.task_id, e)

    # ── 任务注册 ──────────────────────────────────────────────────────────────

    async def register(
        self,
        task_id: str,
        command: str,
        cwd: str,
        pid: int,
        process: asyncio.subprocess.Process,
        file_writer_task: Optional["asyncio.Task[None]"] = None,
    ) -> None:
        """
        注册新后台任务，并自动启动进程监控协程。

        日志 header 已由 ProcessExecutor._go_background() 写入，此处只维护内存字典。
        监控协程等待进程退出 + file_writer drain 完毕，再写 [STATUS] footer。
        若当前 RUNNING 任务数已达上限，抛出 TooManyBackgroundTasksError。
        """
        running = [t for t in self._tasks.values() if t.status == TaskStatus.RUNNING]
        if len(running) >= BG_MAX_CONCURRENT_TASKS:
            raise TooManyBackgroundTasksError(len(running), running)

        task = BackgroundTask(
            task_id=task_id,
            command=command,
            cwd=cwd,
            pid=pid,
            status=TaskStatus.RUNNING,
            process=process,
        )
        self._tasks[task_id] = task
        logger.info("注册后台任务: task_id=%s pid=%d command=%s", task_id, pid, command[:80])

        asyncio.ensure_future(self._monitor_process(task_id, process, file_writer_task))

    async def _monitor_process(
        self,
        task_id: str,
        process: asyncio.subprocess.Process,
        file_writer_task: Optional["asyncio.Task[None]"],
    ) -> None:
        """
        等待进程自然退出，再等待 file_writer 将剩余 buf 全部写入日志，
        最后写 [STATUS] footer。保证 footer 始终是日志文件的最后一行。
        """
        try:
            await process.wait()
        except Exception as e:
            logger.warning("进程监控等待进程退出失败 task_id=%s: %s", task_id, e)

        if file_writer_task is not None:
            try:
                await asyncio.wait_for(file_writer_task, timeout=15.0)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                logger.warning("file_writer 超时未完成 task_id=%s，强制结束", task_id)

        exit_code = process.returncode
        try:
            if exit_code is not None and exit_code == 0:
                await self.mark_completed(task_id, exit_code)
            else:
                await self.mark_error(task_id, exit_code)
        except Exception as e:
            logger.warning("写 footer 失败 task_id=%s: %s", task_id, e)

    # ── 状态变更 ──────────────────────────────────────────────────────────────

    async def mark_completed(self, task_id: str, exit_code: int) -> None:
        """将任务标记为 COMPLETED，写 footer，触发文件淘汰检查。"""
        task = self._tasks.get(task_id)
        if task is None:
            return
        task.status = TaskStatus.COMPLETED
        task.exit_code = exit_code
        task.finished_at = time.time()
        await self._store.write_status(task_id, TaskStatus.COMPLETED, exit_code)
        await self._store.evict_if_needed(self._finished_task_ids())

    async def mark_error(self, task_id: str, exit_code: Optional[int] = None) -> None:
        """将任务标记为 ERROR，写 footer，触发文件淘汰检查。"""
        task = self._tasks.get(task_id)
        if task is None:
            return
        task.status = TaskStatus.ERROR
        task.exit_code = exit_code
        task.finished_at = time.time()
        await self._store.write_status(task_id, TaskStatus.ERROR, exit_code)
        await self._store.evict_if_needed(self._finished_task_ids())

    async def kill_task(self, task_id: str) -> None:
        """
        立即强制终止指定任务（先 SIGTERM，超时后 SIGKILL）。

        对已处于终止态的任务无副作用。
        """
        task = self._tasks.get(task_id)
        if task is None:
            raise KeyError(f"task {task_id!r} not found")
        if task.status != TaskStatus.RUNNING:
            return
        await self._do_kill(task)

    async def _do_kill(self, task: BackgroundTask) -> None:
        """执行实际的进程终止并更新内存状态 + 写 footer。"""
        if task.process is not None:
            await _terminate_process_gracefully(task.process)
        task.status = TaskStatus.KILLED
        task.finished_at = time.time()
        await self._store.write_status(task.task_id, TaskStatus.KILLED, None)
        await self._store.evict_if_needed(self._finished_task_ids())
        logger.info("任务已 kill: task_id=%s", task.task_id)

    # ── 查询接口 ──────────────────────────────────────────────────────────────

    def get_task(self, task_id: str) -> Optional[BackgroundTask]:
        """按 task_id 查询任务；不存在时返回 None。"""
        return self._tasks.get(task_id)

    def get_all_running_tasks(self) -> list[BackgroundTask]:
        """返回当前所有 RUNNING 状态的任务列表。"""
        return [t for t in self._tasks.values() if t.status == TaskStatus.RUNNING]

    def _finished_task_ids(self) -> set[str]:
        return {t.task_id for t in self._tasks.values() if t.status != TaskStatus.RUNNING}

    # ── I/O 接口 ──────────────────────────────────────────────────────────────

    async def write_stdin(self, task_id: str, text: str) -> None:
        """
        向后台进程 stdin 写入文本（交互场景）。

        若任务已结束或进程句柄不可用，静默忽略（由调用方在返回内容中说明）。
        """
        task = self._tasks.get(task_id)
        if task is None:
            raise KeyError(f"task {task_id!r} not found")
        if task.status != TaskStatus.RUNNING:
            return
        if task.process is None or task.process.stdin is None:
            logger.warning("任务 %s 进程 stdin 不可用（可能未以 PIPE 模式启动）", task_id)
            return
        # 自动补换行符：bash read 等内置命令需要 \n 才能完成读取
        if not text.endswith("\n"):
            text += "\n"
        task.process.stdin.write(text.encode())
        await task.process.stdin.drain()

    async def get_output_since(self, task_id: str, offset: int) -> tuple[str, int]:
        """
        从字节偏移量 offset 开始增量读取日志内容。

        返回 (新增文本, 新的字节偏移量)。
        """
        return await self._store.read_since(task_id, offset)

    async def wait_for_pattern(
        self,
        task_id: str,
        pattern: Optional[re.Pattern],
        timeout: float,
    ) -> tuple[str, str, Optional[int]]:
        """
        轮询日志文件，等待以下任意条件触发：
            1. pattern 在新增内容中命中
            2. 进程已结束（status 非 RUNNING）
            3. timeout 到期

        返回 (full_output, reason, exit_code)
            reason: "completed" | "killed" | "error" | "pattern_matched" | "timeout" | "running"
        """
        task = self._tasks.get(task_id)
        if task is None:
            return "", "not_found", None

        loop = asyncio.get_event_loop()
        deadline = loop.time() + timeout
        offset = 0

        while True:
            # 任务已结束，直接返回
            if task.status != TaskStatus.RUNNING:
                content = await self._store.read_full(task_id)
                return content, task.status.value, task.exit_code

            # 增量读取并检查 pattern
            new_content, offset = await self._store.read_since(task_id, offset)
            if pattern is not None and new_content and pattern.search(new_content):
                content = await self._store.read_full(task_id)
                return content, "pattern_matched", None

            # 超时检查
            remaining = deadline - loop.time()
            if remaining <= 0:
                content = await self._store.read_full(task_id)
                return content, "timeout", None

            await asyncio.sleep(min(0.5, remaining))


# ── 进程优雅终止工具函数 ──────────────────────────────────────────────────────

async def _terminate_process_gracefully(
    process: asyncio.subprocess.Process,
    sigterm_timeout: float = 5.0,
) -> None:
    """
    优雅终止进程：先 SIGTERM，等待 sigterm_timeout 秒后若仍运行则 SIGKILL。
    """
    try:
        process.terminate()  # SIGTERM
        await asyncio.wait_for(process.wait(), timeout=sigterm_timeout)
    except asyncio.TimeoutError:
        try:
            process.kill()  # SIGKILL
        except ProcessLookupError:
            pass  # 进程已退出
    except ProcessLookupError:
        pass  # 进程已退出
