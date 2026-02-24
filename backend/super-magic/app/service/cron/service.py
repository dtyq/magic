"""
cron 调度服务核心

常驻 asyncio task，负责：
- 周期性扫描 cron 目录（60s 间隔）
- 计算到期任务并派发执行
- 状态持久化（.cron-state.json）
- 启动补偿（漏跑处理）
- 错误退避、连续错误自动禁用
"""
from __future__ import annotations

import asyncio
import time
from typing import Dict, List, Optional

from agentlang.logger import get_logger
from app.service.cron.executor import execute_agent_turn
from app.service.cron.models import (
    CronJob,
    CronJobState,
    CronRunResult,
    CronState,
    PayloadKind,
    ScheduleKind,
)
from app.service.cron.schedule import compute_next_run_ms, now_ms
from app.service.cron.store import load_cron_state, save_cron_state, scan_jobs

logger = get_logger(__name__)

# ── 服务级配置常量 ─────────────────────────────────────────────────────────────

MAX_CONCURRENT_RUNS = 1       # 全局并发上限，默认 1（防 API 配额突增）
MAX_SLEEP_S = 60              # 调度器最大睡眠间隔（秒）
MIN_SLEEP_S = 2               # 最小睡眠间隔，防热循环

# 错误退避延迟（连续错误次数 → 下次延迟毫秒数）
_BACKOFF_MS = [
    30_000,      # 1 次：30 秒
    60_000,      # 2 次：1 分钟
    300_000,     # 3 次：5 分钟
    900_000,     # 4 次：15 分钟
    3_600_000,   # 5+ 次：60 分钟
]
_MAX_CONSECUTIVE_ERRORS = 5   # 连续失败超过此数自动禁用任务
_STUCK_TIMEOUT_MS = 2 * 60 * 60 * 1000   # 2 小时，判定任务卡死

# 启动补偿：最多立即执行 N 个漏跑任务，其余延迟执行
_MAX_IMMEDIATE_COMPENSATE = 5


class CronService:
    """
    常驻调度服务，以 asyncio.Task 运行。
    通过 start() / stop() 管理生命周期。
    """

    def __init__(self) -> None:
        self._stopped = False
        self._task: Optional[asyncio.Task] = None
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_RUNS)
        self._state_lock = asyncio.Lock()
        # 内存中缓存的任务列表，避免每次 tick 都重建
        self._jobs: Dict[str, CronJob] = {}          # job_id → CronJob
        self._known_mtimes: Dict[str, float] = {}    # job_id → mtime
        # 下次最近到期任务的时间戳（毫秒），用于动态 sleep
        self._next_due_ms: Optional[int] = None

    def start(self) -> None:
        """启动调度器（在 asyncio event loop 中调用）。"""
        self._stopped = False
        self._task = asyncio.create_task(self._run(), name="cron-scheduler")
        logger.info("cron scheduler started")

    async def stop(self) -> None:
        """优雅停止调度器。"""
        self._stopped = True
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("cron scheduler stopped")

    # ── 主循环 ────────────────────────────────────────────────────────────────

    def _compute_sleep(self) -> float:
        """
        动态计算下次 sleep 时长。
        若有已知的最近到期时间，提前 1s 醒来以保证分钟级精度；
        否则退回到 MAX_SLEEP_S 兜底，防止时钟漂移。
        """
        if self._next_due_ms is not None:
            remaining_s = (self._next_due_ms - now_ms()) / 1000 - 1
            return max(MIN_SLEEP_S, min(remaining_s, MAX_SLEEP_S))
        return MAX_SLEEP_S

    async def _run(self) -> None:
        """调度器主循环，捕获所有异常防止 task 静默死亡。"""
        # 启动时执行一次补偿检查
        await self._startup_compensate()

        while not self._stopped:
            try:
                sleep_s = self._compute_sleep()
                await asyncio.sleep(sleep_s)
                if not self._stopped:
                    await self._tick()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"cron scheduler tick failed: {e}", exc_info=True)
                await asyncio.sleep(MIN_SLEEP_S)

    # ── tick ─────────────────────────────────────────────────────────────────

    async def _tick(self) -> None:
        """
        单次调度循环：
        1. 扫描目录，更新内存任务列表
        2. 加载运行时状态
        3. 清理卡死任务
        4. 收集到期任务，标记 running_at_ms（防重入）
        5. 为每个到期任务创建独立 asyncio.Task
        """
        # 1. 扫描目录
        scanned = await scan_jobs(self._known_mtimes)
        scanned_ids = {j.id for j in scanned}

        new_jobs: Dict[str, CronJob] = {}
        changed_ids = set()
        for job in scanned:
            new_jobs[job.id] = job
            old_mtime = self._known_mtimes.get(job.id, -1)
            if job.mtime != old_mtime:
                changed_ids.add(job.id)
        self._jobs = new_jobs
        self._known_mtimes = {j.id: j.mtime for j in scanned}

        # 2. 加载 + 更新运行时状态
        async with self._state_lock:
            state = await load_cron_state()

            # 3. 清理卡死任务
            _clear_stuck_jobs(state)

            # 4. 为新增/变更任务计算 next_run_at_ms
            current_ms = now_ms()
            for job_id in changed_ids:
                job = self._jobs.get(job_id)
                if job is None or not job.enabled:
                    continue
                js = state.jobs.setdefault(job_id, CronJobState())
                _recalculate_next_run(job, js, current_ms)

            # 清理已删除任务的状态
            for removed_id in list(state.jobs.keys()):
                if removed_id not in scanned_ids:
                    del state.jobs[removed_id]

            # 5. 收集到期任务
            due_jobs = _collect_due_jobs(self._jobs, state, current_ms)

            # 6. 标记 running_at_ms（防重入），立即持久化
            for job in due_jobs:
                js = state.jobs.setdefault(job.id, CronJobState())
                js.running_at_ms = current_ms

            # 有任务变化（新增/修改/删除）或有到期任务时，持久化状态
            # 注意：changed_ids 包含新增任务，若此时不保存，下次 tick 加载磁盘状态
            # 会拿到空 state，导致 next_run_at_ms 丢失，任务永远无法被调度
            if due_jobs or changed_ids or (set(state.jobs.keys()) != scanned_ids):
                await save_cron_state(state)

        # 7. 派发独立 task，不阻塞 tick 返回
        for job in due_jobs:
            logger.info(f"cron: dispatching job [{job.id}]")
            asyncio.create_task(
                self._execute_and_update(job),
                name=f"cron-job-{job.id}",
            )

        # 8. 更新下次最近到期时间，供 _compute_sleep 使用
        _update_next_due(self, state)

    async def _execute_and_update(self, job: CronJob) -> None:
        """
        执行单个 job 并回写状态。
        外层 try/except 防止 task 静默死亡。
        """
        try:
            async with self._semaphore:
                if job.payload.kind == PayloadKind.AGENT_TURN:
                    result = await execute_agent_turn(job)
                else:
                    logger.warning(f"cron job [{job.id}] payload kind '{job.payload.kind}' not implemented, skipping")
                    result = CronRunResult(status="error", error=f"payload kind '{job.payload.kind}' not implemented")

            async with self._state_lock:
                state = await load_cron_state()
                js = state.jobs.setdefault(job.id, CronJobState())
                _update_job_state_after_run(job, js, result, now_ms())
                await save_cron_state(state)

        except asyncio.CancelledError:
            logger.warning(f"cron job task cancelled: {job.id}")
        except Exception as e:
            logger.error(f"cron job task unexpected error [{job.id}]: {e}", exc_info=True)
            # 尽力回写错误状态
            try:
                async with self._state_lock:
                    state = await load_cron_state()
                    js = state.jobs.setdefault(job.id, CronJobState())
                    failed = CronRunResult(status="error", error=str(e))
                    _update_job_state_after_run(job, js, failed, now_ms())
                    await save_cron_state(state)
            except Exception:
                pass

    # ── 启动补偿 ──────────────────────────────────────────────────────────────

    async def _startup_compensate(self) -> None:
        """
        启动时处理漏跑任务：
        - every/cron：重算 next_run_at_ms，立即补偿执行最多 MAX_IMMEDIATE_COMPENSATE 个
        - at：已过期直接 disable
        """
        try:
            scanned = await scan_jobs({})
            if not scanned:
                return

            self._jobs = {j.id: j for j in scanned}
            self._known_mtimes = {j.id: j.mtime for j in scanned}

            async with self._state_lock:
                state = await load_cron_state()
                current_ms = now_ms()

                overdue: List[CronJob] = []
                for job in scanned:
                    if not job.enabled:
                        continue
                    js = state.jobs.setdefault(job.id, CronJobState())
                    # 清理因崩溃残留的 running 标记
                    js.running_at_ms = None
                    _recalculate_next_run(job, js, current_ms)
                    if js.next_run_at_ms is not None and js.next_run_at_ms <= current_ms:
                        overdue.append(job)

                await save_cron_state(state)
                _update_next_due(self, state)

            if not overdue:
                return

            logger.info(f"cron startup: {len(overdue)} overdue job(s) found, compensating")
            immediate = overdue[:_MAX_IMMEDIATE_COMPENSATE]
            deferred = overdue[_MAX_IMMEDIATE_COMPENSATE:]

            for job in immediate:
                asyncio.create_task(
                    self._execute_and_update(job),
                    name=f"cron-compensate-{job.id}",
                )

            # 其余任务错开 5s 执行
            for i, job in enumerate(deferred, start=1):
                asyncio.get_event_loop().call_later(
                    i * 5,
                    lambda j=job: asyncio.create_task(
                        self._execute_and_update(j),
                        name=f"cron-compensate-{j.id}",
                    ),
                )

        except Exception as e:
            logger.error(f"cron startup compensate failed: {e}", exc_info=True)


# ── 内部工具函数 ──────────────────────────────────────────────────────────────

def _clear_stuck_jobs(state: CronState) -> None:
    """清理 running_at_ms 超过 2 小时的卡死任务标记。"""
    current_ms = now_ms()
    for js in state.jobs.values():
        if js.running_at_ms is not None:
            if current_ms - js.running_at_ms > _STUCK_TIMEOUT_MS:
                js.running_at_ms = None


def _update_next_due(self_obj: "CronService", state: "CronState") -> None:
    """从当前 state 中找出最近一个 next_run_at_ms，缓存到 _next_due_ms。"""
    candidates = [
        js.next_run_at_ms
        for js in state.jobs.values()
        if js.next_run_at_ms is not None and js.running_at_ms is None
    ]
    self_obj._next_due_ms = min(candidates) if candidates else None


def _recalculate_next_run(job: CronJob, js: CronJobState, current_ms: int) -> None:
    """重算 next_run_at_ms。at 类型过期则禁用，every 类型确保锚点存在。"""
    try:
        if job.schedule.kind == ScheduleKind.AT:
            next_ms = compute_next_run_ms(job, js, current_ms)
            if next_ms is None:
                job.enabled = False
                js.next_run_at_ms = None
            else:
                js.next_run_at_ms = next_ms
        elif job.schedule.kind == ScheduleKind.EVERY:
            js.next_run_at_ms = compute_next_run_ms(job, js, current_ms)
        else:
            js.next_run_at_ms = compute_next_run_ms(job, js, current_ms)
    except Exception as e:
        logger.warning(f"cron: failed to compute next run for [{job.id}]: {e}")
        js.consecutive_errors = (js.consecutive_errors or 0) + 1
        if js.consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
            logger.error(f"cron: disabling [{job.id}] due to {js.consecutive_errors} consecutive schedule errors")
            job.enabled = False


def _collect_due_jobs(
    jobs: Dict[str, CronJob],
    state: CronState,
    current_ms: int,
) -> List[CronJob]:
    """收集所有到期且未在运行的任务。"""
    due = []
    for job_id, job in jobs.items():
        if not job.enabled:
            continue
        js = state.jobs.get(job_id)
        if js is None:
            continue
        if js.running_at_ms is not None:
            continue  # 已在运行，跳过（防重入）
        if js.next_run_at_ms is not None and js.next_run_at_ms <= current_ms:
            due.append(job)
    return due


def _update_job_state_after_run(
    job: CronJob,
    js: CronJobState,
    result: CronRunResult,
    current_ms: int,
) -> None:
    """任务执行完成后更新状态，含退避逻辑和自动禁用。"""
    js.running_at_ms = None
    js.last_run_at_ms = current_ms
    js.last_status = result.status
    js.last_error = result.error or None

    if result.status == "ok":
        js.consecutive_errors = 0
        # at 类型：执行完即禁用
        if job.schedule.kind == ScheduleKind.AT:
            job.enabled = False
            js.next_run_at_ms = None
            return
    else:
        js.consecutive_errors = (js.consecutive_errors or 0) + 1
        if js.consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
            logger.error(f"cron: disabling [{job.id}] after {js.consecutive_errors} consecutive errors")
            job.enabled = False
            js.next_run_at_ms = None
            return

    # 计算下次执行时间
    backoff_idx = min((js.consecutive_errors or 0) - 1, len(_BACKOFF_MS) - 1)
    try:
        next_ms = compute_next_run_ms(job, js, current_ms)
        if next_ms is None:
            job.enabled = False
            js.next_run_at_ms = None
        else:
            if js.consecutive_errors and js.consecutive_errors > 0 and backoff_idx >= 0:
                delay = _BACKOFF_MS[backoff_idx]
                js.next_run_at_ms = max(next_ms, current_ms + delay)
            else:
                js.next_run_at_ms = next_ms
    except Exception as e:
        logger.warning(f"cron: failed to compute next run after execution [{job.id}]: {e}")
