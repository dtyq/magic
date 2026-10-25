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
import copy
import time
from typing import Dict, List, Literal, Optional

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
from app.service.cron.store import archive_completed_job, load_cron_state, save_cron_state, scan_jobs
from app.service.cron.utils import (
    CRON_LOG_INTERVAL_S,
    CRON_LOG_MAX_JOBS,
    format_job_label,
    format_job_schedule,
    format_log_duration,
    format_log_time,
)

logger = get_logger(__name__)

# ── 服务级配置常量 ─────────────────────────────────────────────────────────────

MAX_CONCURRENT_RUNS = 5       # 全局并发上限
MAX_SLEEP_S = 60              # 调度器最大睡眠间隔（秒）
MIN_SLEEP_S = 0.1             # 最小睡眠间隔，让出事件循环即可，不需要强制等待

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
        self._jobs: Dict[str, CronJob] = {}                  # job_id → CronJob
        self._known_mtimes: Dict[str, float] = {}            # job_id → mtime（有效文件）
        self._known_invalid_mtimes: Dict[str, float] = {}    # job_id → mtime（无效文件，用于抑制重复告警）
        # 下次最近到期任务的时间戳（毫秒），用于动态 sleep
        self._next_due_ms: Optional[int] = None
        self._last_summary_at: float | None = None

    def start(self) -> None:
        """启动调度器（在 asyncio event loop 中调用）。"""
        self._stopped = False
        self._last_summary_at = None
        self._task = asyncio.create_task(self._run(), name="cron-scheduler")
        logger.debug("定时任务：调度服务已启动，准备检查任务。")

    async def stop(self) -> None:
        """优雅停止调度器。"""
        self._stopped = True
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("定时任务：调度服务已停止，不再检查新的到期任务。")

    # ── 主循环 ────────────────────────────────────────────────────────────────

    def _compute_sleep(self) -> float:
        """
        动态计算下次 sleep 时长。
        提前 100ms 醒来做最后一次检查，保证毫秒级精度；
        否则退回到 MAX_SLEEP_S 兜底，防止时钟漂移。
        """
        if self._next_due_ms is not None:
            remaining_s = (self._next_due_ms - now_ms()) / 1000 - 0.1
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
                logger.exception(f"定时任务：本轮调度检查失败，将继续重试。原因：{type(e).__name__}: {e}")
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
        scanned, new_invalid_mtimes = await scan_jobs(self._known_mtimes, self._known_invalid_mtimes)
        self._known_invalid_mtimes = new_invalid_mtimes
        scanned_ids = {j.id for j in scanned}
        previous_jobs = self._jobs

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
            previous_state = copy.deepcopy(state)

            # 3. 清理卡死任务
            _clear_stuck_jobs(state, self._jobs)

            # 4. 为新增/变更任务计算 next_run_at_ms
            current_ms = now_ms()
            for job_id in changed_ids:
                job = self._jobs.get(job_id)
                if job is None or not job.enabled:
                    continue
                js = state.jobs.setdefault(job_id, CronJobState())
                _recalculate_next_run(job, js, current_ms)

            # 清理已删除任务的状态
            removed_ids = [rid for rid in list(state.jobs.keys()) if rid not in scanned_ids]
            for removed_id in removed_ids:
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
            # 禁用任务可以没有状态记录；比较真实内容变化，避免每轮重复保存。
            # 比较在卡死标记清理之前取得的快照，也能保留这些恢复操作的写入。
            should_save = bool(due_jobs or changed_ids or removed_ids or state != previous_state)
            if should_save:
                try:
                    await save_cron_state(state)
                except Exception as e:
                    # 阶段说明随原异常交给主循环，只打印一份失败堆栈。
                    e.add_note("定时任务：本轮状态保存失败，尚未提交本轮待执行任务。")
                    raise

            self._log_job_changes(previous_jobs, changed_ids, removed_ids, state)

        # 7. 派发独立 task，不阻塞 tick 返回
        for job in due_jobs:
            asyncio.create_task(
                self._execute_and_update(job),
                name=f"cron-job-{job.id}",
            )

        # 8. 更新下次最近到期时间，供 _compute_sleep 使用
        _update_next_due(self, state)
        self._log_summary(self._jobs, state)

        # 定期兜底：若有未发出的通知且主 agent 未运行，则触发（异步，不阻塞 tick）
        from app.service.cron.notification import try_notify_main_agent
        asyncio.create_task(try_notify_main_agent(), name="cron-tick-notify")

    def _log_job_changes(
        self,
        previous_jobs: dict[str, CronJob],
        changed_ids: set[str],
        removed_state_ids: list[str],
        state: CronState,
    ) -> None:
        for job_id in sorted(changed_ids):
            job = self._jobs[job_id]
            action = "已新增" if job_id not in previous_jobs else "配置已更新"
            enabled = "已启用；" if job.enabled else ""
            logger.info(
                f"定时任务{format_job_label(job)}：{action}，"
                f"{enabled}{format_job_schedule(job, state.jobs.get(job_id))}。"
            )
        removed_job_ids = previous_jobs.keys() - self._jobs.keys()
        for job_id in sorted(removed_job_ids):
            label = format_job_label(previous_jobs[job_id])
            if job_id in self._known_invalid_mtimes:
                logger.warning(f"定时任务{label}：配置无法解析，已从调度列表移除，请检查配置告警。")
            else:
                logger.info(f"定时任务{label}：未再扫描到配置文件，已从调度列表移除。")
        stale_ids = set(removed_state_ids) - removed_job_ids
        if stale_ids:
            logger.info(f"定时任务：已清理 {len(stale_ids)} 项不存在任务的残留状态。")

    def _log_summary(
        self, jobs: dict[str, CronJob], state: CronState, *, startup: bool = False,
    ) -> None:
        # 普通扫描只低频汇报；本条证明本轮检查完成，不表示任务和通知全部健康。
        now = time.monotonic()
        if self._last_summary_at is not None and now - self._last_summary_at < CRON_LOG_INTERVAL_S:
            return
        enabled = sum(job.enabled for job in jobs.values())
        running = sum(
            js.running_at_ms is not None
            for job_id, js in state.jobs.items() if job_id in jobs
        )
        title = "启动检查完成" if startup else "本轮检查完成"
        parts = [
            f"定时任务：{title}。共 {len(jobs)} 项，已启用 {enabled} 项、"
            f"已停用 {len(jobs) - enabled} 项；未结束 {running} 项（含等待执行名额）。"
        ]
        issues: list[str] = []
        scheduled: list[CronJob] = []
        for job in jobs.values():
            if not job.enabled:
                continue
            js = state.jobs.get(job.id)
            if js is None:
                issues.append(f"{format_job_label(job)}缺少调度状态")
            elif js.running_at_ms is not None:
                continue
            elif js.next_run_at_ms is None:
                issues.append(f"{format_job_label(job)}缺少执行时间")
            else:
                scheduled.append(job)
        scheduled.sort(key=lambda job: (state.jobs[job.id].next_run_at_ms or 0, job.id))
        if scheduled:
            job = scheduled[0]
            next_ms = state.jobs[job.id].next_run_at_ms
            if next_ms is not None:
                if next_ms < now_ms():
                    issues.append(f"{format_job_label(job)}计划时间 {format_log_time(next_ms, job)} 已过，尚未提交执行")
                else:
                    parts.append(f"下一项{format_job_label(job)}预计在 {format_log_time(next_ms, job)} 执行。")
        elif not jobs:
            parts.append("尚未发现有效的定时任务。")
        elif not enabled:
            parts.append("当前没有待执行安排。")
        elif running:
            parts.append("等待已提交任务结束后更新后续安排。")
        if self._known_invalid_mtimes:
            issues.append(f"{len(self._known_invalid_mtimes)} 项配置无法解析，已跳过，请检查此前配置告警")
        if issues:
            parts.append("请检查：" + "；".join(issues[:CRON_LOG_MAX_JOBS]) + "。")
            if len(issues) > CRON_LOG_MAX_JOBS:
                parts.append(f"另有 {len(issues) - CRON_LOG_MAX_JOBS} 项问题未展开。")
            logger.warning("".join(parts))
        else:
            logger.info("".join(parts))
        self._last_summary_at = now

    async def _execute_and_update(self, job: CronJob) -> None:
        """
        执行单个 job 并回写状态。
        外层 try/except 防止 task 静默死亡。
        """
        label = format_job_label(job)
        phase: Literal["等待执行名额", "执行任务", "归档结果", "更新调度状态"] = "等待执行名额"
        outcome = "尚未获得执行结果"
        waiting_since = time.monotonic()
        waited = self._semaphore.locked()
        if waited:
            logger.info(f"定时任务{label}：执行名额已满，等待其它任务结束。")
        try:
            async with self._semaphore:
                phase = "执行任务"
                waiting = f"，已等待 {format_log_duration(time.monotonic() - waiting_since)}" if waited else ""
                logger.info(f"定时任务{label}：开始执行{waiting}。")
                if job.payload.kind == PayloadKind.AGENT_TURN:
                    result = await execute_agent_turn(job)
                else:
                    logger.warning(f"定时任务{label}：暂不支持任务类型 {job.payload.kind}，本次未执行。")
                    result = CronRunResult(status="error", error=f"payload kind '{job.payload.kind}' not implemented")

            outcome = "业务执行成功" if result.status == "ok" else "业务执行未完成"
            if result.status == "ok":
                # 保活语义绑定到“任务本身已经成功跑完”，而不是后面的归档/落盘是否成功。
                # 使用 notify_activity 而非 keepalive_once，启动 72h 自动续期循环，
                # 确保在下一次定时任务到来之前沙盒不会被 idle monitor 杀掉。
                try:
                    from app.core.keepalive_registry import KeepaliveRegistry
                    KeepaliveRegistry.get_instance().notify_activity(f"cron:{job.id}")
                except Exception as e:
                    logger.warning(f"定时任务{label}：执行成功，但沙盒活跃时间续期失败。原因：{type(e).__name__}: {e}")

            # at 类型一次性任务执行成功后归档并删除原始文件
            if result.status == "ok" and job.schedule.kind == ScheduleKind.AT:
                phase = "归档结果"
                from datetime import datetime, timezone as dt_timezone
                run_at = datetime.now(dt_timezone.utc)
                tz_str = job.timezone or getattr(job.schedule, "tz", None)
                if tz_str:
                    try:
                        import pytz
                        run_at = run_at.astimezone(pytz.timezone(tz_str))
                    except Exception:
                        pass
                await archive_completed_job(job, result, run_at)

            phase = "更新调度状态"
            async with self._state_lock:
                state = await load_cron_state()
                js = state.jobs.setdefault(job.id, CronJobState())
                _update_job_state_after_run(job, js, result, now_ms())
                await save_cron_state(state)
                _log_run_result(job, js, result)

        except asyncio.CancelledError:
            logger.warning(f"定时任务{label}：在{phase}阶段被中断；{outcome}。")
        except Exception as e:
            logger.exception(
                f"定时任务{label}：{phase}失败；{outcome}。"
                f"原因：{type(e).__name__}: {e}",
            )
            # 尽力回写错误状态
            try:
                async with self._state_lock:
                    state = await load_cron_state()
                    js = state.jobs.setdefault(job.id, CronJobState())
                    failed = CronRunResult(status="error", error=str(e))
                    _update_job_state_after_run(job, js, failed, now_ms())
                    await save_cron_state(state)
                    logger.warning(f"定时任务{label}：已回写异常状态；{format_job_schedule(job, js)}。")
            except Exception as state_error:
                logger.exception(
                    f"定时任务{label}：异常状态回写也失败，无法确认后续安排。"
                    f"原因：{type(state_error).__name__}: {state_error}",
                )

    # ── 启动补偿 ──────────────────────────────────────────────────────────────

    async def _startup_compensate(self) -> None:
        """
        启动时处理漏跑任务：
        - every/cron：重算 next_run_at_ms，立即补偿执行最多 MAX_IMMEDIATE_COMPENSATE 个
        - at：已过期直接 disable
        """
        try:
            scanned, new_invalid_mtimes = await scan_jobs({}, {})
            self._known_invalid_mtimes = new_invalid_mtimes
            scanned_ids = {j.id for j in scanned}
            if not scanned:
                self._log_summary({}, CronState(), startup=True)
                return

            self._jobs = {j.id: j for j in scanned}
            self._known_mtimes = {j.id: j.mtime for j in scanned}

            async with self._state_lock:
                state = await load_cron_state()
                stale_ids = [sid for sid in state.jobs if sid not in scanned_ids]
                if stale_ids:
                    for sid in stale_ids:
                        del state.jobs[sid]

                current_ms = now_ms()

                overdue: List[CronJob] = []
                for job in scanned:
                    if not job.enabled:
                        continue
                    js = state.jobs.setdefault(job.id, CronJobState())
                    # 清理因崩溃残留的 running 标记
                    if js.running_at_ms is not None:
                        logger.warning(f"定时任务{format_job_label(job)}：启动时发现未结束标记，将清除标记并重新计算安排。")
                    js.running_at_ms = None
                    _recalculate_next_run(job, js, current_ms)
                    if js.next_run_at_ms is not None and js.next_run_at_ms <= current_ms:
                        overdue.append(job)

                await save_cron_state(state)
                _update_next_due(self, state)
                if stale_ids:
                    logger.info(f"定时任务：启动时已清理 {len(stale_ids)} 项不存在任务的残留状态。")

            self._log_summary(self._jobs, state, startup=True)

            if not overdue:
                return

            immediate = overdue[:_MAX_IMMEDIATE_COMPENSATE]
            deferred = overdue[_MAX_IMMEDIATE_COMPENSATE:]
            logger.info(
                f"定时任务：启动时发现 {len(overdue)} 项到期任务，"
                f"立即提交 {len(immediate)} 项，其余 {len(deferred)} 项按原有间隔错开提交。"
            )

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
            logger.exception(f"定时任务：启动检查或补偿安排失败。原因：{type(e).__name__}: {e}")


# ── 内部工具函数 ──────────────────────────────────────────────────────────────

def _log_run_result(job: CronJob, state: CronJobState, result: CronRunResult) -> None:
    """在状态保存成功后说明执行结果与后续安排，不代表结果归档或通知送达。"""
    label = format_job_label(job)
    duration = format_log_duration(result.duration_ms / 1000)
    if result.status == "ok":
        schedule = (
            "本次为一次性任务，没有下一次计划"
            if job.schedule.kind == ScheduleKind.AT
            else format_job_schedule(job, state)
        )
        logger.info(f"定时任务{label}：执行成功，用时 {duration}；{schedule}。")
    elif not job.enabled and state.consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
        logger.error(
            f"定时任务{label}：连续失败已达到 {state.consecutive_errors} 次，"
            "已停止后续调度；请检查此前失败原因及任务配置。"
        )
    else:
        logger.warning(
            f"定时任务{label}：本次未完成，用时 {duration}，连续失败 {state.consecutive_errors} 次；"
            f"{format_job_schedule(job, state)}。"
        )


def _clear_stuck_jobs(state: CronState, jobs: dict[str, CronJob]) -> None:
    """清理 running_at_ms 超过 2 小时的卡死任务标记。"""
    current_ms = now_ms()
    for job_id, js in state.jobs.items():
        if js.running_at_ms is not None:
            if current_ms - js.running_at_ms > _STUCK_TIMEOUT_MS:
                js.running_at_ms = None
                job = jobs.get(job_id)
                label = format_job_label(job) if job is not None else f"（ID：{job_id}）"
                logger.warning(
                    f"定时任务{label}：未结束标记已超过 {format_log_duration(_STUCK_TIMEOUT_MS / 1000)}，"
                    "已清除该标记并重新检查调度条件。"
                )


def _update_next_due(self_obj: "CronService", state: "CronState") -> None:
    """从当前 state 中找出最近一个 next_run_at_ms，缓存到 _next_due_ms。"""
    candidates = [
        js.next_run_at_ms
        for js in state.jobs.values()
        if js.next_run_at_ms is not None and js.running_at_ms is None
    ]
    self_obj._next_due_ms = min(candidates) if candidates else None


def _get_end_at_ms(job: CronJob) -> Optional[int]:
    """将 schedule.end_at（ISO 8601）转换为毫秒时间戳，解析失败返回 None。"""
    end_at = job.schedule.end_at
    if not end_at:
        return None
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(end_at.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except Exception as e:
        logger.warning(f"定时任务{format_job_label(job)}：结束时间配置无效，本次未应用结束时间限制。原因：{type(e).__name__}: {e}")
        return None


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
        else:
            next_ms = compute_next_run_ms(job, js, current_ms)
            end_at_ms = _get_end_at_ms(job)
            if end_at_ms is not None and (current_ms >= end_at_ms or (next_ms is not None and next_ms >= end_at_ms)):
                logger.info(f"定时任务{format_job_label(job)}：已达到结束时间限制，停止后续调度。")
                job.enabled = False
                js.next_run_at_ms = None
            else:
                js.next_run_at_ms = next_ms
    except Exception as e:
        logger.warning(f"定时任务{format_job_label(job)}：无法计算下一次执行时间。原因：{type(e).__name__}: {e}")
        js.consecutive_errors = (js.consecutive_errors or 0) + 1
        if js.consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
            logger.error(f"定时任务{format_job_label(job)}：连续 {js.consecutive_errors} 次计算执行时间失败，停止后续调度，请检查配置。")
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
            end_at_ms = _get_end_at_ms(job)
            if end_at_ms is not None and next_ms >= end_at_ms:
                logger.info(f"定时任务{format_job_label(job)}：下一次执行将达到结束时间限制，停止后续调度。")
                job.enabled = False
                js.next_run_at_ms = None
            elif js.consecutive_errors and js.consecutive_errors > 0 and backoff_idx >= 0:
                delay = _BACKOFF_MS[backoff_idx]
                js.next_run_at_ms = max(next_ms, current_ms + delay)
            else:
                js.next_run_at_ms = next_ms
    except Exception as e:
        logger.warning(f"定时任务{format_job_label(job)}：执行后的下一次时间计算失败。原因：{type(e).__name__}: {e}")
