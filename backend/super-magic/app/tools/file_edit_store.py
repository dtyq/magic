"""Short-lived records used by the two-step file editing tools."""

from __future__ import annotations

import asyncio
import hashlib
import re
import secrets
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import AsyncIterator

from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_chmod,
    async_exists,
    async_read_json,
    async_scandir,
    async_unlink,
    async_write_json,
)
from app.utils.runtime_storage import (
    RuntimeEvictionPolicy,
    ensure_runtime_directory,
    evict_runtime_files,
    get_runtime_config_int,
    get_runtime_config_size_bytes,
    trigger_opportunistic_cleanup,
)

logger = get_logger(__name__)

_ID_PATTERN = re.compile(r"^[a-z0-9]{8}$")
_RANGE_PREFIX = "range-"
_REPLACEMENT_PREFIX = "replacement-"
_STORE_DIRECTORY = "file_edits"
_PATH_LOCKS: dict[str, asyncio.Lock] = {}
_ID_LOCK = asyncio.Lock()
_ACTIVE_RECORD_PATHS: set[Path] = set()


@dataclass(frozen=True, slots=True)
class FileEditRangeRecord:
    range_id: str
    context_id: str
    file_path: str
    start_index: int
    end_index: int
    start_line: int
    end_line: int
    source_digest: str
    state: str
    created_at: float


@dataclass(frozen=True, slots=True)
class FileEditReplacement:
    replacement_id: str
    context_id: str
    file_path: str
    value: str
    content_digest: str
    created_at: float


class FileEditStore:
    """Persist only the minimum data needed to retry one edit in this sandbox."""

    @classmethod
    def content_digest(cls, content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @classmethod
    async def create_range(
        cls,
        context: AgentContext,
        *,
        file_path: Path,
        start_index: int,
        end_index: int,
        start_line: int,
        end_line: int,
        source_content: str,
    ) -> FileEditRangeRecord:
        range_id = await cls._new_id(_RANGE_PREFIX)
        record = FileEditRangeRecord(
            range_id=range_id,
            context_id=context.context_id,
            file_path=str(file_path.resolve()),
            start_index=start_index,
            end_index=end_index,
            start_line=start_line,
            end_line=end_line,
            source_digest=cls.content_digest(source_content),
            state="ready",
            created_at=time.time(),
        )
        await cls._write_record(_RANGE_PREFIX, range_id, {
            "version": 1,
            "range_id": record.range_id,
            "context_id": record.context_id,
            "file_path": record.file_path,
            "start_index": record.start_index,
            "end_index": record.end_index,
            "start_line": record.start_line,
            "end_line": record.end_line,
            "source_digest": record.source_digest,
            "state": record.state,
            "created_at": record.created_at,
        })
        cls._schedule_cleanup()
        return record

    @classmethod
    async def get_range(
        cls,
        context: AgentContext,
        range_id: str,
    ) -> FileEditRangeRecord | None:
        data = await cls._read_record(_RANGE_PREFIX, range_id)
        if data is None or data.get("context_id") != context.context_id:
            return None
        try:
            return FileEditRangeRecord(
                range_id=str(data["range_id"]),
                context_id=str(data["context_id"]),
                file_path=str(data["file_path"]),
                start_index=int(data["start_index"]),
                end_index=int(data["end_index"]),
                start_line=int(data["start_line"]),
                end_line=int(data["end_line"]),
                source_digest=str(data["source_digest"]),
                state=str(data["state"]),
                created_at=float(data["created_at"]),
            )
        except (KeyError, TypeError, ValueError):
            logger.warning("Invalid file edit range record: %s", range_id)
            return None

    @classmethod
    async def discard_range(cls, context: AgentContext, record: FileEditRangeRecord) -> None:
        """查找批次保存失败时，只清理本次已创建且属于当前上下文的记录。"""
        if record.context_id != context.context_id:
            raise ValueError("File edit range belongs to another agent context.")
        path = await cls._record_path(_RANGE_PREFIX, record.range_id)
        await async_unlink(path)

    @classmethod
    async def set_range_state(
        cls,
        context: AgentContext,
        record: FileEditRangeRecord,
        state: str,
    ) -> FileEditRangeRecord:
        updated = FileEditRangeRecord(
            range_id=record.range_id,
            context_id=record.context_id,
            file_path=record.file_path,
            start_index=record.start_index,
            end_index=record.end_index,
            start_line=record.start_line,
            end_line=record.end_line,
            source_digest=record.source_digest,
            state=state,
            created_at=record.created_at,
        )
        if updated.context_id != context.context_id:
            raise ValueError("File edit range belongs to another agent context.")
        await cls._write_record(_RANGE_PREFIX, updated.range_id, {
            "version": 1,
            "range_id": updated.range_id,
            "context_id": updated.context_id,
            "file_path": updated.file_path,
            "start_index": updated.start_index,
            "end_index": updated.end_index,
            "start_line": updated.start_line,
            "end_line": updated.end_line,
            "source_digest": updated.source_digest,
            "state": updated.state,
            "created_at": updated.created_at,
        })
        record_path = await cls._record_path(_RANGE_PREFIX, updated.range_id)
        if state == "applying":
            _ACTIVE_RECORD_PATHS.add(record_path)
        else:
            _ACTIVE_RECORD_PATHS.discard(record_path)
        return updated

    @classmethod
    async def save_replacement(
        cls,
        context: AgentContext,
        *,
        file_path: Path,
        value: str,
        replacement_id: str | None = None,
    ) -> str:
        identifier = replacement_id or await cls._new_id(_REPLACEMENT_PREFIX)
        if not _ID_PATTERN.fullmatch(identifier):
            raise ValueError("Invalid replacement id.")
        await cls._write_record(_REPLACEMENT_PREFIX, identifier, {
            "version": 1,
            "replacement_id": identifier,
            "context_id": context.context_id,
            "file_path": str(file_path.resolve()),
            "value": value,
            "content_digest": cls.content_digest(value),
            "created_at": time.time(),
        })
        cls._schedule_cleanup()
        return identifier

    @classmethod
    async def get_replacement(
        cls,
        context: AgentContext,
        replacement_id: str,
    ) -> FileEditReplacement | None:
        data = await cls._read_record(_REPLACEMENT_PREFIX, replacement_id)
        if data is None or data.get("context_id") != context.context_id:
            return None
        try:
            return FileEditReplacement(
                replacement_id=str(data["replacement_id"]),
                context_id=str(data["context_id"]),
                file_path=str(data["file_path"]),
                value=str(data["value"]),
                content_digest=str(data["content_digest"]),
                created_at=float(data["created_at"]),
            )
        except (KeyError, TypeError, ValueError):
            logger.warning("Invalid file edit replacement record: %s", replacement_id)
            return None

    @classmethod
    async def consume_replacement(cls, replacement_id: str) -> None:
        path = await cls._record_path(_REPLACEMENT_PREFIX, replacement_id)
        await async_unlink(path)

    @classmethod
    async def clear_context(cls, context: AgentContext) -> None:
        directory = await cls._directory()
        try:
            entries = await async_scandir(directory)
        except FileNotFoundError:
            return

        for entry in entries:
            if entry.is_symlink() or not entry.is_file(follow_symlinks=False):
                continue
            if not (entry.name.startswith(_RANGE_PREFIX) or entry.name.startswith(_REPLACEMENT_PREFIX)):
                continue
            try:
                data = await async_read_json(Path(entry.path))
            except (FileNotFoundError, ValueError, TypeError):
                continue
            if isinstance(data, dict) and data.get("context_id") == context.context_id:
                await async_unlink(Path(entry.path))

    @classmethod
    @asynccontextmanager
    async def path_lock(
        cls,
        file_path: Path,
        interruption_event: asyncio.Event,
    ) -> AsyncIterator[None]:
        key = str(file_path.resolve())
        lock = _PATH_LOCKS.setdefault(key, asyncio.Lock())
        acquire_task = asyncio.create_task(lock.acquire())
        interruption_task = asyncio.create_task(interruption_event.wait())
        done, pending = await asyncio.wait(
            (acquire_task, interruption_task),
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        if interruption_task in done and interruption_task.result():
            if acquire_task in done and acquire_task.result():
                lock.release()
            else:
                acquire_task.cancel()
                await asyncio.gather(acquire_task, return_exceptions=True)
            raise asyncio.CancelledError
        try:
            await acquire_task
            yield
        finally:
            lock.release()

    @classmethod
    async def _directory(cls) -> Path:
        return await ensure_runtime_directory(PathManager.get_runtime_dir() / _STORE_DIRECTORY)

    @classmethod
    async def _record_path(cls, prefix: str, identifier: str) -> Path:
        if not _ID_PATTERN.fullmatch(identifier):
            raise ValueError("Invalid file edit id.")
        directory = await cls._directory()
        return directory / f"{prefix}{identifier}.json"

    @classmethod
    async def _new_id(cls, prefix: str) -> str:
        async with _ID_LOCK:
            for _ in range(10):
                identifier = secrets.token_hex(4)
                path = await cls._record_path(prefix, identifier)
                if not await async_exists(path):
                    return identifier
        raise RuntimeError("Could not allocate a file edit id.")

    @classmethod
    async def _write_record(cls, prefix: str, identifier: str, data: dict[str, object]) -> None:
        path = await cls._record_path(prefix, identifier)
        await async_write_json(path, data, ensure_ascii=False, indent=2)
        await async_chmod(path, 0o600)

    @classmethod
    async def _read_record(cls, prefix: str, identifier: str) -> dict[str, object] | None:
        try:
            path = await cls._record_path(prefix, identifier)
            data = await async_read_json(path)
            return data if isinstance(data, dict) else None
        except (FileNotFoundError, ValueError, TypeError):
            return None

    @classmethod
    def _schedule_cleanup(cls) -> None:
        directory = PathManager.get_runtime_dir() / _STORE_DIRECTORY
        trigger_opportunistic_cleanup(
            "file_edits",
            lambda: cls._cleanup(directory),
        )

    @classmethod
    async def _cleanup(cls, directory: Path) -> None:
        await evict_runtime_files(
            directory,
            policy=RuntimeEvictionPolicy(
                max_entries=get_runtime_config_int("runtime_cleanup.file_edits.max_file_count"),
                target_entries=get_runtime_config_int("runtime_cleanup.file_edits.target_file_count"),
                max_total_bytes=get_runtime_config_size_bytes("runtime_cleanup.file_edits.max_total_size"),
                target_total_bytes=get_runtime_config_size_bytes("runtime_cleanup.file_edits.target_total_size"),
                max_age_seconds=get_runtime_config_int("runtime_cleanup.file_edits.max_age_days") * 24 * 60 * 60,
            ),
            suffixes=(".json",),
            protected_paths=frozenset(_ACTIVE_RECORD_PATHS),
        )
