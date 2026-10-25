"""统一处理 Python 服务退出请求、清理步骤和强制终止时限。"""

from __future__ import annotations

import asyncio
import os
import signal
import threading
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import StrEnum
from typing import Literal

from agentlang.logger import get_logger
from agentlang.utils.process_manager import ProcessManager
from app.core.context.agent_context_registry import AgentContextRegistry
from app.service.cron.service import CronService
from app.service.idle_monitor_service import IdleMonitorService
from app.service.service_shutdown_diagnostics import (
    ShutdownDiagnosticsCollector,
    ShutdownSnapshot,
    bound_diagnostic_text,
    collect_watchdog_thread_summaries,
    encode_shutdown_event,
)

logger = get_logger(__name__)
LogLevel = Literal["info", "warning", "error"]


class ShutdownPhase(StrEnum):
    RUNNING = "running"
    SHUTDOWN_REQUESTED = "shutdown_requested"
    DRAINING_UVICORN = "draining_uvicorn"
    CLOSING_APP = "closing_app"
    CLOSING_EVENT_LOOP = "closing_event_loop"
    WAITING_FOR_THREADS = "waiting_for_threads"
    READY_TO_EXIT = "ready_to_exit"
    FORCE_KILL = "force_kill"


class ShutdownCleanupStep(StrEnum):
    NOT_STARTED = "not_started"
    STOPPING_PRODUCERS = "stopping_producers"
    INTERRUPTING_RUNS = "interrupting_runs"
    STOPPING_WORKERS = "stopping_workers"
    COMPLETED = "completed"


class ShutdownTrigger(StrEnum):
    IDLE_TIMEOUT = "idle_timeout"
    SIGNAL = "signal"
    SERVER_TASK_EXIT = "server_task_exit"
    SERVER_EXCEPTION = "server_exception"
    UVICORN_EXIT = "uvicorn_exit"


@dataclass(frozen=True, slots=True)
class ShutdownRequest:
    """首次退出请求的标识、原因和截止时间；后续请求不修改这些值。"""

    shutdown_id: str
    trigger: ShutdownTrigger
    signal_name: str | None
    requested_at_utc: str
    started_monotonic: float
    deadline_monotonic: float


class ServiceShutdownCoordinator:
    """主循环执行清理；独立线程分别负责超时强杀和退出诊断。"""

    def __init__(
        self,
        *,
        loop: asyncio.AbstractEventLoop,
        force_shutdown_timeout_seconds: int,
        graceful_shutdown_timeout_seconds: int,
        idle_monitor: IdleMonitorService,
        cron_service: CronService,
        process_manager: ProcessManager,
        diagnostics: ShutdownDiagnosticsCollector,
    ) -> None:
        if not 0 < graceful_shutdown_timeout_seconds < force_shutdown_timeout_seconds:
            raise ValueError(
                "shutdown timeouts must satisfy "
                "0 < graceful_shutdown_timeout_seconds < force_shutdown_timeout_seconds"
            )

        self._loop = loop
        self._force_shutdown_timeout_seconds = force_shutdown_timeout_seconds
        self._graceful_shutdown_timeout_seconds = graceful_shutdown_timeout_seconds
        self._idle_monitor = idle_monitor
        self._cron_service = cron_service
        self._process_manager = process_manager
        self._diagnostics = diagnostics
        self._sandbox_id = bound_diagnostic_text(os.getenv("SANDBOX_ID", "").strip())
        commit = bound_diagnostic_text(os.getenv("CI_COMMIT_SHA", "").strip())
        self._commit = commit if commit != "未知" else ""

        self._shutdown_event = asyncio.Event()
        self._completion_event = threading.Event()
        self._state_lock = threading.RLock()
        self._request: ShutdownRequest | None = None
        self._request_count = 0
        self._phase = ShutdownPhase.RUNNING
        self._cleanup_step = ShutdownCleanupStep.NOT_STARTED
        self._prepare_task: asyncio.Task[None] | None = None
        self._last_snapshot: ShutdownSnapshot | None = None
        self._last_snapshot_monotonic: float | None = None
        self._watchdog_started = False
        self._diagnostic_start_error: str | None = None

    @property
    def request(self) -> ShutdownRequest | None:
        with self._state_lock:
            return self._request

    async def wait_requested(self) -> None:
        """等待主循环收到退出请求。"""
        await self._shutdown_event.wait()

    def request_shutdown(
        self,
        trigger: ShutdownTrigger,
        *,
        signal_number: int | None = None,
    ) -> ShutdownRequest:
        """登记一次退出请求并立即开始总计时；允许由信号或辅助线程调用。"""
        signal_name = self._signal_name(signal_number)
        with self._state_lock:
            self._request_count += 1
            first_request = self._request is None
            if first_request:
                started = time.monotonic()
                self._request = ShutdownRequest(
                    shutdown_id=uuid.uuid4().hex[:12],
                    trigger=trigger,
                    signal_name=signal_name,
                    requested_at_utc=datetime.now(timezone.utc).isoformat(),
                    started_monotonic=started,
                    deadline_monotonic=started + self._force_shutdown_timeout_seconds,
                )
                self._phase = ShutdownPhase.SHUTDOWN_REQUESTED
            request = self._request
            assert request is not None
            self._start_watchdog_locked(request)
            try:
                self._loop.call_soon_threadsafe(
                    self._activate_request_on_loop, first_request, trigger, signal_name
                )
            except RuntimeError:
                # 即使事件循环已经关闭，独立的强杀计时仍然有效。
                pass
        return request

    def start_prepare_shutdown(self) -> asyncio.Task[None]:
        """只创建一个清理任务，Uvicorn 和 lifespan 等待同一份结果。"""
        if self._prepare_task is None:
            self._prepare_task = asyncio.create_task(
                self._prepare_shutdown_impl(), name="service-shutdown-cleanup"
            )
        return self._prepare_task

    async def prepare_shutdown(self) -> None:
        """等待清理结果，调用方取消不会取消共享的清理任务。"""
        await self.wait_requested()
        await asyncio.shield(self.start_prepare_shutdown())

    async def mark_draining_uvicorn(self) -> None:
        """记录 Uvicorn 开始关闭连接和请求。"""
        await self.wait_requested()
        self._set_phase(ShutdownPhase.DRAINING_UVICORN)
        self._record_event("phase")

    async def mark_closing_app(self) -> None:
        """记录 lifespan 开始关闭 AgentRuntime 和 telemetry。"""
        await self.wait_requested()
        self._set_phase(ShutdownPhase.CLOSING_APP)
        self._record_event("phase")

    async def mark_closing_event_loop(self) -> None:
        """记录显式清理已返回；事件循环仍可能等待剩余任务，不能宣称进程已退出。"""
        await self.wait_requested()
        with self._state_lock:
            if self._phase == ShutdownPhase.CLOSING_EVENT_LOOP:
                return
            self._phase = ShutdownPhase.CLOSING_EVENT_LOOP
        self._record_event("phase")

    def finish_event_loop_shutdown(self) -> None:
        """事件循环关闭后记录线程情况，符合条件时才解除强杀计时。"""
        request = self.request
        if request is None or not self._loop.is_closed():
            return
        current_thread = threading.current_thread()
        blocking_thread_count = sum(
            thread is not current_thread and thread.is_alive() and not thread.daemon
            for thread in threading.enumerate()
        )
        phase = (
            ShutdownPhase.WAITING_FOR_THREADS
            if blocking_thread_count
            else ShutdownPhase.READY_TO_EXIT
        )
        self._set_phase(phase)
        payload = self._cached_payload(
            "event_loop_closed", request, include_pending=bool(blocking_thread_count)
        )
        payload["blocking_thread_count"] = blocking_thread_count
        # 日志若阻塞，watchdog 仍在运行；写入尝试结束后才能解除计时。
        self._log_payload(payload)
        if not blocking_thread_count and time.monotonic() < request.deadline_monotonic:
            self._completion_event.set()

    def record_cleanup_error(self, step: str, error: BaseException) -> None:
        """只记录步骤和异常类型，不输出可能包含请求数据的异常正文。"""
        self._record_event(
            "cleanup_error",
            include_pending=True,
            extra={
                "step": bound_diagnostic_text(step),
                "error_type": bound_diagnostic_text(type(error).__qualname__),
            },
            level="error",
        )

    def _activate_request_on_loop(
        self,
        first_request: bool,
        trigger: ShutdownTrigger,
        signal_name: str | None,
    ) -> None:
        self._shutdown_event.set()
        if first_request:
            self._record_event("requested")
        else:
            self._record_event(
                "duplicate_request",
                extra={
                    "duplicate_trigger": trigger.value,
                    "duplicate_signal": signal_name,
                    "deadline_extended": False,
                },
            )

    async def _prepare_shutdown_impl(self) -> None:
        await self._run_cleanup_step(
            ShutdownCleanupStep.STOPPING_PRODUCERS, self._stop_producers
        )
        await self._run_cleanup_step(
            ShutdownCleanupStep.INTERRUPTING_RUNS, self._interrupt_runs
        )
        await self._run_cleanup_step(
            ShutdownCleanupStep.STOPPING_WORKERS, self._stop_workers
        )
        with self._state_lock:
            self._cleanup_step = ShutdownCleanupStep.COMPLETED
        self._record_event("phase")

    async def _run_cleanup_step(
        self,
        step: ShutdownCleanupStep,
        operation: Callable[[], Awaitable[None]],
    ) -> None:
        with self._state_lock:
            self._cleanup_step = step
        self._record_event("phase")
        try:
            await operation()
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self.record_cleanup_error(step.value, error)

    async def _stop_producers(self) -> None:
        self._idle_monitor.stop()
        await self._cron_service.stop()

    async def _interrupt_runs(self) -> None:
        contexts = AgentContextRegistry.get_instance().list_contexts()
        request = self.request
        reason = "idle_timeout" if request is not None and request.trigger == ShutdownTrigger.IDLE_TIMEOUT else "service_shutdown"
        results = await asyncio.gather(
            *(context.stop_run(reason=reason) for context in contexts),
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, BaseException):
                self.record_cleanup_error("interrupting_runs", result)

    async def _stop_workers(self) -> None:
        await self._process_manager.stop_all()
        try:
            from agentlang.streaming.drivers.socketio.driver import shutdown_shared_socketio_driver

            await shutdown_shared_socketio_driver()
        except Exception as error:
            self.record_cleanup_error("socketio_driver", error)

    def _record_event(
        self,
        event: str,
        *,
        include_pending: bool = False,
        extra: dict[str, object] | None = None,
        level: LogLevel = "info",
    ) -> None:
        request = self.request
        if request is None:
            return
        try:
            with self._state_lock:
                phase, cleanup_step = self._phase.value, self._cleanup_step.value
            # 日常日志只打印计数，但缓存保留任务摘要，供主循环卡住后的诊断使用。
            snapshot = self._diagnostics.collect(
                phase=phase, cleanup_step=cleanup_step, include_pending=True
            )
            with self._state_lock:
                self._last_snapshot = snapshot
                self._last_snapshot_monotonic = time.monotonic()
            payload = self._base_payload(event, request)
            payload.update(snapshot.to_dict(include_pending=include_pending))
        except Exception as error:
            payload = self._base_payload(event, request)
            payload["diagnostics_error_type"] = bound_diagnostic_text(type(error).__qualname__)
        if extra:
            payload.update(extra)
        self._log_payload(payload, level=level)

    def _base_payload(self, event: str, request: ShutdownRequest) -> dict[str, object]:
        now = time.monotonic()
        with self._state_lock:
            payload: dict[str, object] = {
                "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                "event": event,
                "shutdown_id": request.shutdown_id,
                "trigger": request.trigger.value,
                "signal": request.signal_name,
                "requested_at_utc": request.requested_at_utc,
                "phase": self._phase.value,
                "cleanup_step": self._cleanup_step.value,
                "elapsed_ms": max(0, int((now - request.started_monotonic) * 1000)),
                "deadline_remaining_ms": max(0, int((request.deadline_monotonic - now) * 1000)),
                "request_count": self._request_count,
                "pid": os.getpid(),
            }
        if self._sandbox_id:
            payload["sandbox_id"] = self._sandbox_id
        if self._commit:
            payload["commit"] = self._commit
        if self._diagnostic_start_error:
            payload["diagnostic_start_error_type"] = self._diagnostic_start_error
        return payload

    def _cached_payload(
        self,
        event: str,
        request: ShutdownRequest,
        *,
        include_pending: bool = True,
    ) -> dict[str, object]:
        payload = self._base_payload(event, request)
        with self._state_lock:
            snapshot = self._last_snapshot
            captured_at = self._last_snapshot_monotonic
        if snapshot is not None:
            payload["last_snapshot"] = snapshot.to_dict(include_pending=include_pending)
        if captured_at is not None:
            payload["last_snapshot_age_ms"] = max(0, int((time.monotonic() - captured_at) * 1000))
        return payload

    def _start_watchdog_locked(self, request: ShutdownRequest) -> None:
        if self._watchdog_started:
            return
        self._watchdog_started = True
        threading.Thread(
            target=self._watchdog_main,
            args=(request,),
            name="service-shutdown-watchdog",
            daemon=True,
        ).start()
        try:
            threading.Thread(
                target=self._diagnostic_main,
                args=(request,),
                name="service-shutdown-diagnostics",
                daemon=True,
            ).start()
        except Exception as error:
            # 诊断线程启动失败也不能影响已经开始的强杀计时。
            self._diagnostic_start_error = bound_diagnostic_text(type(error).__qualname__)

    def _watchdog_main(self, request: ShutdownRequest) -> None:
        if self._completion_event.wait(
            timeout=max(0.0, request.deadline_monotonic - time.monotonic())
        ):
            return
        # 此处不读取业务状态、不获取协调器锁、不采集诊断、不等待日志线程。
        try:
            os.kill(os.getpid(), signal.SIGKILL)
        except OSError as error:
            self._write_stderr_payload(
                {
                    "event": "force_kill_failed",
                    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                    "shutdown_id": request.shutdown_id,
                    "pid": os.getpid(),
                    "errno": error.errno,
                }
            )

    def _diagnostic_main(self, request: ShutdownRequest) -> None:
        warning_at = request.started_monotonic + self._graceful_shutdown_timeout_seconds
        if self._completion_event.wait(timeout=max(0.0, warning_at - time.monotonic())):
            return
        if time.monotonic() < request.deadline_monotonic:
            self._write_thread_diagnostics("deadline_warning", request)
        if self._completion_event.wait(
            timeout=max(0.0, request.deadline_monotonic - time.monotonic())
        ):
            return
        # 强杀线程不会等待这里；最终事件可能来不及写出，之前的阶段日志仍可排查。
        self._write_thread_diagnostics("force_kill", request)

    def _write_thread_diagnostics(self, event: str, request: ShutdownRequest) -> None:
        try:
            payload = self._cached_payload(event, request)
            payload["thread_frames"] = [
                summary.to_dict() for summary in collect_watchdog_thread_summaries()
            ]
            if event == "force_kill":
                payload["phase"] = ShutdownPhase.FORCE_KILL.value
                payload["action"] = "SIGKILL"
                payload["reason"] = "force_shutdown_timeout_exceeded"
            self._write_stderr_payload(payload)
        except Exception:
            # 名称、栈信息或序列化异常只能丢失诊断，不能影响另一个线程杀进程。
            return

    def _set_phase(self, phase: ShutdownPhase) -> None:
        with self._state_lock:
            self._phase = phase

    @staticmethod
    def _signal_name(signal_number: int | None) -> str | None:
        if signal_number is None:
            return None
        try:
            return signal.Signals(signal_number).name
        except ValueError:
            return str(signal_number)

    @staticmethod
    def _log_payload(payload: dict[str, object], *, level: LogLevel = "info") -> None:
        try:
            message = encode_shutdown_event(payload).decode("utf-8").rstrip("\n")
            if level == "error":
                logger.error(message)
            elif level == "warning":
                logger.warning(message)
            else:
                logger.info(message)
        except Exception:
            return

    @staticmethod
    def _write_stderr_payload(payload: dict[str, object]) -> None:
        try:
            os.write(2, encode_shutdown_event(payload))
        except Exception:
            return
