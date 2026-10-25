"""记录服务退出步骤和未结束的资源，限制条目数量并排除请求数据。"""

from __future__ import annotations

import asyncio
import json
import sys
import threading
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from types import FrameType
from typing import TYPE_CHECKING, Optional, TypeAlias, TypeVar

from agentlang.utils.process_manager import ProcessManager
from app.core.context.agent_context_registry import AgentContextRegistry

if TYPE_CHECKING:
    import uvicorn


_DEFAULT_PENDING_LIMIT = 20
_STACK_FRAME_LIMIT = 5
_DIAGNOSTIC_TEXT_LIMIT = 240
_MAX_EVENT_BYTES = 64 * 1024

DiagnosticScalar: TypeAlias = str | int | float | bool | None
DiagnosticValue: TypeAlias = DiagnosticScalar | tuple[str, ...]
_TaskResult = TypeVar("_TaskResult")


def bound_diagnostic_text(value: str) -> str:
    """限制诊断文本长度，避免外部名称或路径放大单条退出日志。"""
    normalized = value.replace("\r", "\\r").replace("\n", "\\n")
    return normalized[:_DIAGNOSTIC_TEXT_LIMIT]


def encode_shutdown_event(payload: dict[str, object]) -> bytes:
    """生成不超过 64 KiB 的单行 JSON 日志；超长时先省略详细条目。"""
    def encode(value: dict[str, object]) -> bytes:
        serialized = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        return f"service_shutdown {serialized}\n".encode("utf-8", errors="replace")

    encoded = encode(payload)
    if len(encoded) <= _MAX_EVENT_BYTES:
        return encoded

    shortened = dict(payload)
    shortened["payload_truncated"] = True
    shortened.pop("pending", None)
    snapshot = shortened.get("last_snapshot")
    if isinstance(snapshot, dict):
        snapshot = dict(snapshot)
        snapshot.pop("pending", None)
        shortened["last_snapshot"] = snapshot
    encoded = encode(shortened)

    thread_frames = shortened.get("thread_frames")
    if isinstance(thread_frames, list):
        while len(encoded) > _MAX_EVENT_BYTES and thread_frames:
            thread_frames = thread_frames[: len(thread_frames) // 2]
            shortened["thread_frames"] = thread_frames
            encoded = encode(shortened)
    if len(encoded) <= _MAX_EVENT_BYTES:
        return encoded

    # 不截断已经编码的字节，否则可能输出不完整的 UTF-8 或 JSON。
    minimal: dict[str, object] = {"payload_truncated": True}
    for key in (
        "timestamp_utc", "event", "shutdown_id", "trigger", "signal", "phase",
        "cleanup_step", "pid", "sandbox_id", "commit", "reason", "action",
        "elapsed_ms", "deadline_remaining_ms", "errno",
    ):
        value = payload.get(key)
        if isinstance(value, str):
            minimal[key] = bound_diagnostic_text(value)
        elif value is None or isinstance(value, (int, float, bool)):
            minimal[key] = value
    return encode(minimal)


@dataclass(frozen=True, slots=True)
class PendingResourceSummary:
    """一条未结束资源的摘要，不包含业务请求和返回内容。"""

    kind: str
    fields: tuple[tuple[str, DiagnosticValue], ...]

    def to_dict(self) -> dict[str, object]:
        return {"kind": self.kind, **dict(self.fields)}


@dataclass(frozen=True, slots=True)
class PendingTaskSummary:
    """asyncio 或 Uvicorn Task 的脱敏摘要。"""

    kind: str
    task_name: str
    coroutine: str
    done: bool
    cancelled: bool
    frames: tuple[str, ...]

    def to_resource_summary(self) -> PendingResourceSummary:
        fields: list[tuple[str, DiagnosticValue]] = [
            ("task_name", self.task_name),
            ("coroutine", self.coroutine),
            ("done", self.done),
            ("cancelled", self.cancelled),
        ]
        if self.frames:
            fields.append(("frames", self.frames))
        return PendingResourceSummary(kind=self.kind, fields=tuple(fields))


@dataclass(frozen=True, slots=True)
class ShutdownResourceCounts:
    """退出阶段关键资源计数。"""

    uvicorn_connection_count: int
    uvicorn_task_count: int
    registered_context_count: int
    running_cached_agent_count: int
    interruption_requested_context_count: int
    cancel_blocker_count: int
    stream_count: int
    managed_worker_count: int
    asyncio_pending_task_count: int
    thread_count: int

    def to_dict(self) -> dict[str, int]:
        return {
            "uvicorn_connection_count": self.uvicorn_connection_count,
            "uvicorn_task_count": self.uvicorn_task_count,
            "registered_context_count": self.registered_context_count,
            "running_cached_agent_count": self.running_cached_agent_count,
            "interruption_requested_context_count": self.interruption_requested_context_count,
            "cancel_blocker_count": self.cancel_blocker_count,
            "stream_count": self.stream_count,
            "managed_worker_count": self.managed_worker_count,
            "asyncio_pending_task_count": self.asyncio_pending_task_count,
            "thread_count": self.thread_count,
        }


@dataclass(frozen=True, slots=True)
class ShutdownSnapshot:
    """某次采集的退出步骤和资源信息，创建后不再修改，供后续日志使用。"""

    captured_at_utc: str
    phase: str
    cleanup_step: str
    counts: ShutdownResourceCounts
    pending: tuple[PendingResourceSummary, ...]
    truncated_kinds: tuple[str, ...]

    def to_dict(self, *, include_pending: bool) -> dict[str, object]:
        payload: dict[str, object] = {
            "captured_at_utc": self.captured_at_utc,
            "phase": self.phase,
            "cleanup_step": self.cleanup_step,
            "counts": self.counts.to_dict(),
            "truncated": bool(self.truncated_kinds),
        }
        if include_pending and self.pending:
            payload["pending"] = [summary.to_dict() for summary in self.pending]
        if self.truncated_kinds:
            payload["truncated_kinds"] = list(self.truncated_kinds)
        return payload


class ShutdownDiagnosticsCollector:
    """在主事件循环收集连接、任务、线程和受管进程信息。"""

    def __init__(
        self,
        *,
        process_manager: ProcessManager,
        pending_limit: int = _DEFAULT_PENDING_LIMIT,
    ) -> None:
        if pending_limit <= 0:
            raise ValueError("pending_limit must be positive")
        self._process_manager = process_manager
        self._pending_limit = pending_limit
        self._server: Optional[uvicorn.Server] = None

    def bind_server(self, server: uvicorn.Server) -> None:
        """在 Uvicorn Server 构造完成后绑定其只读状态。"""
        self._server = server

    def collect(
        self,
        *,
        phase: str,
        cleanup_step: str,
        include_pending: bool,
    ) -> ShutdownSnapshot:
        """收集当前资源数量，并按条目上限提供名称和代码位置。"""
        from app.service.agent_runtime import AgentRuntime

        contexts = AgentContextRegistry.get_instance().list_contexts()
        runtime = AgentRuntime.get_instance()
        worker_snapshot = self._process_manager.snapshot_workers(self._pending_limit)

        pending_asyncio_tasks = tuple(
            task for task in asyncio.all_tasks() if not task.done()
        )
        threads = tuple(threading.enumerate())
        uvicorn_connections = self._uvicorn_connections()
        uvicorn_tasks = self._uvicorn_tasks()

        counts = ShutdownResourceCounts(
            uvicorn_connection_count=len(uvicorn_connections),
            uvicorn_task_count=len(uvicorn_tasks),
            registered_context_count=len(contexts),
            running_cached_agent_count=sum(
                runtime.is_context_running(context.context_id) for context in contexts
            ),
            interruption_requested_context_count=sum(
                context.is_interruption_requested() for context in contexts
            ),
            cancel_blocker_count=sum(
                context.get_cancel_blocker_count() for context in contexts
            ),
            stream_count=sum(len(context.streams) for context in contexts),
            managed_worker_count=worker_snapshot.total,
            asyncio_pending_task_count=len(pending_asyncio_tasks),
            thread_count=len(threads),
        )

        pending: list[PendingResourceSummary] = []
        truncated_kinds: set[str] = set()
        if include_pending:
            pending.extend(
                self._connection_summaries(
                    uvicorn_connections,
                    truncated_kinds=truncated_kinds,
                )
            )
            pending.extend(
                self._task_summaries(
                    uvicorn_tasks,
                    kind="uvicorn_task",
                    truncated_kinds=truncated_kinds,
                )
            )
            pending.extend(
                self._task_summaries(
                    pending_asyncio_tasks,
                    kind="asyncio_task",
                    truncated_kinds=truncated_kinds,
                )
            )
            pending.extend(
                PendingResourceSummary(
                    kind="managed_worker",
                    fields=(
                        ("name", bound_diagnostic_text(worker.name)),
                        ("pid", worker.pid),
                        ("alive", worker.alive),
                        ("exit_code", worker.exit_code),
                    ),
                )
                for worker in worker_snapshot.workers
            )
            if worker_snapshot.truncated:
                truncated_kinds.add("managed_worker")

            pending.extend(
                self._thread_summaries(
                    threads,
                    truncated_kinds=truncated_kinds,
                )
            )

        return ShutdownSnapshot(
            captured_at_utc=datetime.now(timezone.utc).isoformat(),
            phase=phase,
            cleanup_step=cleanup_step,
            counts=counts,
            pending=tuple(pending),
            truncated_kinds=tuple(sorted(truncated_kinds)),
        )

    def _uvicorn_connections(self) -> tuple[object, ...]:
        if self._server is None:
            return ()
        return tuple(self._server.server_state.connections)

    def _uvicorn_tasks(self) -> tuple[asyncio.Task[None], ...]:
        if self._server is None:
            return ()
        return tuple(self._server.server_state.tasks)

    def _connection_summaries(
        self,
        connections: tuple[object, ...],
        *,
        truncated_kinds: set[str],
    ) -> tuple[PendingResourceSummary, ...]:
        if len(connections) > self._pending_limit:
            truncated_kinds.add("uvicorn_connection")

        summaries: list[PendingResourceSummary] = []
        for connection in connections[: self._pending_limit]:
            scope = getattr(connection, "scope", None)
            fields: list[tuple[str, DiagnosticValue]] = [
                (
                    "protocol",
                    bound_diagnostic_text(type(connection).__qualname__),
                ),
            ]
            if isinstance(scope, Mapping):
                scope_type = scope.get("type")
                path = scope.get("path")
                if isinstance(scope_type, str):
                    fields.append(
                        ("scope_type", bound_diagnostic_text(scope_type))
                    )
                if isinstance(path, str):
                    fields.append(("path", bound_diagnostic_text(path)))
            summaries.append(
                PendingResourceSummary(
                    kind="uvicorn_connection",
                    fields=tuple(fields),
                )
            )
        return tuple(summaries)

    def _task_summaries(
        self,
        tasks: tuple[asyncio.Task[_TaskResult], ...],
        *,
        kind: str,
        truncated_kinds: set[str],
    ) -> tuple[PendingResourceSummary, ...]:
        sorted_tasks = tuple(sorted(tasks, key=lambda task: task.get_name()))
        if len(sorted_tasks) > self._pending_limit:
            truncated_kinds.add(kind)
        return tuple(
            self._summarize_task(task, kind=kind).to_resource_summary()
            for task in sorted_tasks[: self._pending_limit]
        )

    @staticmethod
    def _summarize_task(
        task: asyncio.Task[_TaskResult],
        *,
        kind: str,
    ) -> PendingTaskSummary:
        coroutine = task.get_coro()
        coroutine_name = getattr(
            coroutine,
            "__qualname__",
            type(coroutine).__qualname__,
        )
        frames = tuple(
            ShutdownDiagnosticsCollector._format_frame(frame)
            for frame in task.get_stack(limit=_STACK_FRAME_LIMIT)
        )
        return PendingTaskSummary(
            kind=kind,
            task_name=bound_diagnostic_text(task.get_name()),
            coroutine=bound_diagnostic_text(str(coroutine_name)),
            done=task.done(),
            cancelled=task.cancelled(),
            frames=frames,
        )

    def _thread_summaries(
        self,
        threads: tuple[threading.Thread, ...],
        *,
        truncated_kinds: set[str],
    ) -> tuple[PendingResourceSummary, ...]:
        if len(threads) > self._pending_limit:
            truncated_kinds.add("thread")
        current_frames = sys._current_frames()
        summaries: list[PendingResourceSummary] = []
        for thread in threads[: self._pending_limit]:
            frame = current_frames.get(thread.ident) if thread.ident is not None else None
            summaries.append(
                PendingResourceSummary(
                    kind="thread",
                    fields=(
                        ("thread_name", bound_diagnostic_text(thread.name)),
                        ("daemon", thread.daemon),
                        ("alive", thread.is_alive()),
                        ("frames", self._format_frame_chain(frame)),
                    ),
                )
            )
        return tuple(summaries)

    @staticmethod
    def _format_frame_chain(frame: Optional[FrameType]) -> tuple[str, ...]:
        frames: list[str] = []
        current = frame
        while current is not None and len(frames) < _STACK_FRAME_LIMIT:
            frames.append(ShutdownDiagnosticsCollector._format_frame(current))
            current = current.f_back
        return tuple(frames)

    @staticmethod
    def _format_frame(frame: FrameType) -> str:
        code = frame.f_code
        return bound_diagnostic_text(
            f"{code.co_filename}:{frame.f_lineno}:{code.co_name}"
        )


def collect_watchdog_thread_summaries(
    limit: int = _DEFAULT_PENDING_LIMIT,
) -> tuple[PendingResourceSummary, ...]:
    """供 watchdog 使用；只读取线程名称和代码位置，不访问业务运行态。"""
    if limit <= 0:
        raise ValueError("limit must be positive")

    threads = tuple(threading.enumerate())[:limit]
    current_frames = sys._current_frames()
    summaries: list[PendingResourceSummary] = []
    for thread in threads:
        frame = current_frames.get(thread.ident) if thread.ident is not None else None
        summaries.append(
            PendingResourceSummary(
                kind="thread",
                fields=(
                    ("thread_name", bound_diagnostic_text(thread.name)),
                    ("daemon", thread.daemon),
                    ("alive", thread.is_alive()),
                    (
                        "frames",
                        ShutdownDiagnosticsCollector._format_frame_chain(frame),
                    ),
                ),
            )
        )
    return tuple(summaries)
