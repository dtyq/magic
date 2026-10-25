"""工具正文运行文件：私有目录、容量准入、完整发布和机会式清理。"""

import asyncio
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path

from pydantic import BaseModel, Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive
from app.utils.async_file_utils import (
    async_close_fd,
    async_mkstemp,
    async_rename,
    async_scandir,
    async_stat,
    async_unlink,
    async_write_bytes_iter,
)
from app.utils.runtime_storage import (
    RuntimeEvictionPolicy,
    ensure_runtime_directory,
    evict_runtime_files,
    get_runtime_config_int,
    get_runtime_config_size_bytes,
)

logger = get_logger(__name__)
_CHUNK_CHARS = 64 * 1024
_storage_lock = asyncio.Lock()


class ToolResultStorageConfig(BaseModel):
    max_file_size: int = Field(gt=0, strict=True)
    max_file_count: int = Field(ge=2, strict=True)
    target_file_count: int = Field(ge=0, strict=True)
    max_total_size: int = Field(gt=0, strict=True)
    target_total_size: int = Field(ge=0, strict=True)
    max_age_days: int = Field(gt=0, strict=True)

    @model_validator(mode="after")
    def validate_watermarks(self) -> "ToolResultStorageConfig":
        if not 0 < self.max_file_size < self.max_total_size:
            raise ValueError("File size must be positive and below the total capacity.")
        if not 0 <= self.target_total_size < self.max_total_size:
            raise ValueError("Total size target must be below the maximum.")
        if self.target_file_count >= self.max_file_count:
            raise ValueError("File count target must be below the maximum.")
        return self

    @classmethod
    def load(cls) -> "ToolResultStorageConfig":
        # 沿用 runtime 统一换算口径，MB 与 MiB 都按 1024 进制，默认值只放配置文件。
        prefix = "runtime_cleanup.tool_results"
        return cls(
            max_file_size=get_runtime_config_size_bytes(f"{prefix}.max_file_size", minimum=1),
            max_file_count=get_runtime_config_int(f"{prefix}.max_file_count", minimum=2),
            target_file_count=get_runtime_config_int(f"{prefix}.target_file_count"),
            max_total_size=get_runtime_config_size_bytes(f"{prefix}.max_total_size", minimum=1),
            target_total_size=get_runtime_config_size_bytes(f"{prefix}.target_total_size"),
            max_age_days=get_runtime_config_int(f"{prefix}.max_age_days", minimum=1),
        )


@dataclass(frozen=True, slots=True)
class ToolResultFile:
    path: Path
    size_bytes: int


async def measure_text_bytes(content: str, max_bytes: int) -> int:
    """严格 UTF-8 计数；超过准入上限即可停止，不复制整篇 bytes。"""
    size = 0
    for start in range(0, len(content), _CHUNK_CHARS):
        size += len(content[start:start + _CHUNK_CHARS].encode("utf-8"))
        if size > max_bytes:
            return size
        await asyncio.sleep(0)
    return size


async def discard_result_file(path: Path) -> None:
    try:
        await async_unlink(path)
    except Exception as error:
        # 清理失败由下次机会式淘汰处理，不掩盖原始取消或保存失败。
        logger.warning(f"Tool output cleanup failed: path={path}, error_type={type(error).__name__}")


async def _acquire_storage_lock(cancelled: asyncio.Event) -> None:
    acquire = asyncio.create_task(_storage_lock.acquire())
    interrupt = asyncio.create_task(cancelled.wait())
    acquired = False
    try:
        await asyncio.wait((acquire, interrupt), return_when=asyncio.FIRST_COMPLETED)
        if cancelled.is_set():
            raise asyncio.CancelledError
        await acquire
        acquired = True
    finally:
        interrupt.cancel()
        if not acquired:
            acquire.cancel()
        await asyncio.gather(acquire, interrupt, return_exceptions=True)
        # 信号与 acquire 同时完成时，必须归还已经取得但尚未交接的锁。
        if not acquired and not acquire.cancelled() and acquire.exception() is None:
            _storage_lock.release()


async def _save_transaction(
    content: str,
    size_bytes: int,
    tool_name: str,
    settings: ToolResultStorageConfig,
    cancelled: asyncio.Event,
) -> ToolResultFile:
    def check_cancelled() -> None:
        if cancelled.is_set():
            raise asyncio.CancelledError

    async def chunks() -> AsyncIterator[bytes]:
        for start in range(0, len(content), _CHUNK_CHARS):
            check_cancelled()
            yield content[start:start + _CHUNK_CHARS].encode("utf-8")
            await asyncio.sleep(0)

    await _acquire_storage_lock(cancelled)
    partial: Path | None = None
    published: Path | None = None
    fd: int | None = None
    complete = False
    try:
        check_cancelled()
        directory = await ensure_runtime_directory(PathManager.get_runtime_dir() / "tool_results")
        check_cancelled()
        # 先预留新文件的一个名额和实际字节数；通用淘汰器只统计已存在文件。
        await evict_runtime_files(
            directory,
            policy=RuntimeEvictionPolicy(
                max_entries=settings.max_file_count - 1,
                target_entries=max(0, settings.target_file_count - 1),
                max_total_bytes=settings.max_total_size - size_bytes,
                target_total_bytes=max(0, settings.target_total_size - size_bytes),
                max_age_seconds=settings.max_age_days * 24 * 60 * 60,
            ),
            suffixes=(".txt", ".partial"),
        )
        check_cancelled()
        existing_count = 0
        existing_size = 0
        for entry in await async_scandir(directory):
            if entry.is_symlink() or not entry.is_file(follow_symlinks=False):
                continue
            if Path(entry.path).suffix not in (".txt", ".partial"):
                continue
            try:
                stat = await async_stat(entry.path)
            except FileNotFoundError:
                continue
            existing_count += 1
            existing_size += stat.st_size
            check_cancelled()
        if (existing_count + 1 > settings.max_file_count
                or existing_size + size_bytes > settings.max_total_size):
            raise OSError("Tool output storage capacity is unavailable.")
        check_cancelled()
        prefix = re.sub(r"[^a-zA-Z0-9_-]", "", tool_name)[:48] or "tool"
        fd, raw_path = await async_mkstemp(prefix=f"{prefix}-", suffix=".partial", dir=directory)
        partial = Path(raw_path)
        await async_close_fd(fd)
        fd = None
        check_cancelled()
        written = await async_write_bytes_iter(partial, chunks())
        check_cancelled()
        if written != size_bytes or (await async_stat(partial)).st_size != size_bytes:
            raise OSError("Tool output file size does not match its source.")
        check_cancelled()
        published = partial.with_suffix(".txt")
        await async_rename(partial, published)
        check_cancelled()
        complete = True
        return ToolResultFile(path=published, size_bytes=size_bytes)
    finally:
        try:
            if fd is not None:
                await async_close_fd(fd)
            if not complete:
                for path in (partial, published):
                    if path is not None:
                        await discard_result_file(path)
        finally:
            _storage_lock.release()


async def save_tool_result(
    content: str,
    *,
    size_bytes: int,
    tool_name: str,
    settings: ToolResultStorageConfig,
    tool_context: ToolContext | None,
) -> ToolResultFile:
    from app.core.context.agent_context import AgentContext

    agent_context = (
        tool_context.get_extension_typed("agent_context", AgentContext) if tool_context else None
    )
    event = agent_context.get_interruption_event() if agent_context else None
    if event is not None and event.is_set():
        raise asyncio.CancelledError
    cancelled = asyncio.Event()
    worker = asyncio.create_task(_save_transaction(content, size_bytes, tool_name, settings, cancelled))
    interrupt = asyncio.create_task(event.wait()) if event is not None else None
    keep_alive = start_tool_keep_alive(tool_context) if tool_context is not None else None
    try:
        if interrupt is not None:
            await asyncio.wait((worker, interrupt), return_when=asyncio.FIRST_COMPLETED)
            if event.is_set():
                raise asyncio.CancelledError
        return await asyncio.shield(worker)
    except asyncio.CancelledError:
        # 不取消 aiofiles/to_thread 的在途 I/O；等它结束后清理，防止删除后线程又写回文件。
        cancelled.set()
        while not worker.done():
            try:
                await asyncio.shield(worker)
            except asyncio.CancelledError:
                continue
            except Exception:
                break
        if not worker.cancelled() and worker.exception() is None:
            await discard_result_file(worker.result().path)
        raise
    finally:
        stop_tool_keep_alive(keep_alive)
        if interrupt is not None:
            interrupt.cancel()
            await asyncio.gather(interrupt, return_exceptions=True)
