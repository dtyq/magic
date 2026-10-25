"""
后台 shell 任务输出文件存储管理。

日志文件格式（自描述，单文件为任务元数据的唯一持久化载体）：
    [TASK] task_id=<uuid> command="<cmd>" cwd="<cwd>" pid=<int> created_at=<float>
    [stdout] <line>
    [stderr] <line>
    --- [TRUNCATED: middle <N> bytes removed] ---   ← 超限截断时插入
    [stdout] <last visible line>
    [STATUS] <status> exit_code=<int|null> finished_at=<float>  ← 任务结束时追加

每个任务对应独立文件，以 task_id 命名，天然隔离并发写入。
同一文件的写入与截断通过 per-file asyncio.Lock 序列化，防止截断覆盖丢失。
"""

import asyncio
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import aiofiles

from agentlang.logger import get_logger
from app.tools.shell_exec_utils.bg_task_models import TaskStatus
from app.utils.async_file_utils import (
    async_chmod,
    async_exists,
    async_scandir,
    async_stat,
    async_unlink,
)
from app.utils.runtime_storage import (
    RuntimeEvictionPolicy,
    ensure_runtime_directory,
    get_runtime_config_int,
    get_runtime_config_size_bytes,
)

logger = get_logger(__name__)

_TRUNCATED_MARKER_TPL = "--- [TRUNCATED: middle {removed} bytes removed] ---\n"


@dataclass(frozen=True, slots=True)
class _LogFile:
    task_id: str
    path: Path
    size: int
    modified_at: float


@dataclass(frozen=True, slots=True)
class _BgLogConfig:
    max_file_size_bytes: int
    head_keep_bytes: int
    tail_keep_bytes: int
    eviction_policy: RuntimeEvictionPolicy


def _load_bg_log_config() -> _BgLogConfig:
    return _BgLogConfig(
        max_file_size_bytes=get_runtime_config_size_bytes(
            "runtime_cleanup.bg_shell.max_file_size",
            minimum=1,
        ),
        head_keep_bytes=get_runtime_config_size_bytes(
            "runtime_cleanup.bg_shell.head_keep_size",
            minimum=1,
        ),
        tail_keep_bytes=get_runtime_config_size_bytes(
            "runtime_cleanup.bg_shell.tail_keep_size",
            minimum=1,
        ),
        eviction_policy=RuntimeEvictionPolicy(
            max_entries=get_runtime_config_int(
                "runtime_cleanup.bg_shell.max_file_count",
                minimum=1,
            ),
            target_entries=get_runtime_config_int(
                "runtime_cleanup.bg_shell.target_file_count",
                minimum=0,
            ),
            max_total_bytes=get_runtime_config_size_bytes(
                "runtime_cleanup.bg_shell.max_total_size",
                minimum=1,
            ),
            target_total_bytes=get_runtime_config_size_bytes(
                "runtime_cleanup.bg_shell.target_total_size",
                minimum=0,
            ),
            max_age_seconds=get_runtime_config_int(
                "runtime_cleanup.bg_shell.max_age_days",
                minimum=1,
            )
            * 24
            * 60
            * 60,
        ),
    )


class BgOutputStore:
    """
    单个 bg_shell 目录的输出文件存储管理器。

    不做外部持久化，日志文件本身即为唯一持久化载体。
    对象生命周期与 BackgroundProcessManager 一致（进程内单例）。
    """

    def __init__(self, bg_shell_dir: Path) -> None:
        self._dir = bg_shell_dir
        self._config = _load_bg_log_config()
        # task_id -> asyncio.Lock，序列化同一文件的写入与截断
        self._locks: dict[str, asyncio.Lock] = {}

    # ── 内部工具 ──────────────────────────────────────────────────────────────

    def _lock_for(self, task_id: str) -> asyncio.Lock:
        if task_id not in self._locks:
            self._locks[task_id] = asyncio.Lock()
        return self._locks[task_id]

    def log_path(self, task_id: str) -> Path:
        """返回指定任务的日志文件路径。"""
        return self._dir / f"{task_id}.log"

    # ── 写入操作 ──────────────────────────────────────────────────────────────

    async def write_header(self, task_id: str, command: str, cwd: str, pid: int) -> None:
        """
        写入日志文件的 [TASK] header 行（任务启动时调用一次）。

        会自动创建 bg_shell 目录（按需创建语义）。
        """
        await ensure_runtime_directory(self._dir)
        # 命令和路径中的双引号转义，防止 header 解析错乱
        safe_command = command.replace('"', '\\"')
        safe_cwd = cwd.replace('"', '\\"')
        header = (
            f'[TASK] task_id={task_id} command="{safe_command}" '
            f'cwd="{safe_cwd}" pid={pid} created_at={time.time():.3f}\n'
        )
        async with self._lock_for(task_id):
            async with aiofiles.open(self.log_path(task_id), "w", encoding="utf-8") as f:
                await f.write(header)
            await async_chmod(self.log_path(task_id), 0o600)

    async def append_output(self, task_id: str, stream: str, data: str) -> None:
        """
        追加一条进程输出行到日志文件。

        stream: "stdout" 或 "stderr"
        data: 通常来自 stream.readline()，末尾可能已含 \\n；
              未以 \\n 结尾时自动补全，保证日志每行以换行符结束。
        追加完成后若文件超过大小限制，触发截断。
        """
        if not data:
            return
        if not data.endswith("\n"):
            data = data + "\n"
        line = f"[{stream}] {data}"

        async with self._lock_for(task_id):
            async with aiofiles.open(self.log_path(task_id), "a", encoding="utf-8") as f:
                await f.write(line)

        # 截断检查在锁外判断文件大小，超限后再进锁执行截断
        await self._maybe_truncate(task_id)

    async def write_status(
        self,
        task_id: str,
        status: TaskStatus,
        exit_code: Optional[int],
    ) -> None:
        """追加 [STATUS] footer 行（任务终止时调用）。"""
        exit_str = str(exit_code) if exit_code is not None else "null"
        footer = (
            f"[STATUS] {status.value} exit_code={exit_str} "
            f"finished_at={time.time():.3f}\n"
        )
        async with self._lock_for(task_id):
            log = self.log_path(task_id)
            if await async_exists(log):
                async with aiofiles.open(log, "a", encoding="utf-8") as f:
                    await f.write(footer)

    # ── 读取操作 ──────────────────────────────────────────────────────────────

    async def read_full(self, task_id: str) -> str:
        """读取日志文件全量内容；文件不存在时返回空字符串。"""
        log = self.log_path(task_id)
        if not await async_exists(log):
            return ""
        async with aiofiles.open(log, "r", encoding="utf-8", errors="replace") as f:
            return await f.read()

    async def read_since(self, task_id: str, offset: int) -> tuple[str, int]:
        """
        从字节偏移量 offset 开始增量读取日志内容。

        若 offset 超过当前文件大小（例如截断后文件缩小），自动重置为 0 全量读取。
        返回 (新增文本内容, 新的字节偏移量)。
        """
        log = self.log_path(task_id)
        if not await async_exists(log):
            return "", offset

        stat = await async_stat(log)
        if offset > stat.st_size:
            # 文件被截断重写，偏移量失效，回退到 0 重新全量读取
            offset = 0

        async with aiofiles.open(log, "rb") as f:
            await f.seek(offset)
            raw = await f.read()

        text = raw.decode("utf-8", errors="replace")
        return text, offset + len(raw)

    # ── 截断操作 ──────────────────────────────────────────────────────────────

    async def _maybe_truncate(self, task_id: str) -> None:
        """若日志文件超过大小限制，保留头部 + 截断标记 + 尾部，原子重写文件。"""
        log = self.log_path(task_id)
        if not await async_exists(log):
            return

        stat = await async_stat(log)
        if stat.st_size <= self._config.max_file_size_bytes:
            return

        async with self._lock_for(task_id):
            # 进锁后再次确认，防止并发截断
            stat = await async_stat(log)
            if stat.st_size <= self._config.max_file_size_bytes:
                return

            async with aiofiles.open(log, "rb") as f:
                head = await f.read(self._config.head_keep_bytes)
                file_size = stat.st_size
                tail_start = max(
                    self._config.head_keep_bytes,
                    file_size - self._config.tail_keep_bytes,
                )
                await f.seek(tail_start)
                tail = await f.read()

            removed = tail_start - self._config.head_keep_bytes
            marker = _TRUNCATED_MARKER_TPL.format(removed=removed).encode("utf-8")

            async with aiofiles.open(log, "wb") as f:
                await f.write(head + marker + tail)

            logger.debug("日志文件已截断: %s, 移除中间 %d 字节", log, removed)

    # ── 日志淘汰 ──────────────────────────────────────────────────────────────

    async def evict_if_needed(self, finished_task_ids: set[str]) -> None:
        """
        删除超过宽松最长存活时间的已结束日志；突破数量或容量高水位后，
        按修改时间升序删除已结束日志，直到同时回到低水位。

        finished_task_ids: 当前所有处于非 RUNNING 状态的 task_id 集合。
        只删除已结束的任务文件，RUNNING 任务的文件不触碰。
        """
        if not await async_exists(self._dir):
            return

        logs: list[_LogFile] = []
        for entry in await async_scandir(self._dir):
            if entry.is_symlink() or not entry.is_file(follow_symlinks=False):
                continue
            path = Path(entry.path)
            if path.suffix != ".log":
                continue
            try:
                stat = await async_stat(path)
            except FileNotFoundError:
                continue
            logs.append(
                _LogFile(
                    task_id=path.stem,
                    path=path,
                    size=stat.st_size,
                    modified_at=stat.st_mtime,
                )
            )

        logs.sort(key=lambda item: item.modified_at)
        retention_cutoff = time.time() - (self._config.eviction_policy.max_age_seconds or 0)
        expired = [
            item
            for item in logs
            if item.task_id in finished_task_ids and item.modified_at < retention_cutoff
        ]
        for item in expired:
            await self._delete_log(item)

        expired_paths = {item.path for item in expired}
        remaining = [item for item in logs if item.path not in expired_paths]
        total_bytes = sum(item.size for item in remaining)
        if (
            len(remaining) <= (self._config.eviction_policy.max_entries or 0)
            and total_bytes <= (self._config.eviction_policy.max_total_bytes or 0)
        ):
            return

        remaining_entries = len(remaining)
        finished_logs = [item for item in remaining if item.task_id in finished_task_ids]
        for item in finished_logs:
            if (
                remaining_entries <= (self._config.eviction_policy.target_entries or 0)
                and total_bytes <= (self._config.eviction_policy.target_total_bytes or 0)
            ):
                break
            await self._delete_log(item)
            remaining_entries -= 1
            total_bytes -= item.size

    async def _delete_log(self, log: _LogFile) -> None:
        await async_unlink(log.path)
        self._locks.pop(log.task_id, None)
        logger.info("已淘汰后台 Shell 日志: %s", log.path)
