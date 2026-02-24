"""
cron 调度计算

三种调度类型的 next_run_at_ms 计算：at / every / cron（表达式）。
"""
from __future__ import annotations

import math
import time
from datetime import datetime, timezone
from typing import Optional

from agentlang.logger import get_logger
from app.service.cron.models import CronJob, CronJobState, CronSchedule, ScheduleKind

logger = get_logger(__name__)


def now_ms() -> int:
    """当前 UTC 时间戳（毫秒）。"""
    return int(time.time() * 1000)


def compute_next_run_ms(
    job: CronJob,
    state: CronJobState,
    current_ms: Optional[int] = None,
) -> Optional[int]:
    """
    计算任务下次执行时间（毫秒时间戳）。
    返回 None 表示任务不应再执行（at 类型已过期）。
    计算失败时抛出异常，由调用方决定如何处理（通常是连续错误计数 + disable）。
    """
    now = current_ms if current_ms is not None else now_ms()
    s = job.schedule

    if s.kind == ScheduleKind.AT:
        return _next_for_at(s, now)
    elif s.kind == ScheduleKind.EVERY:
        return _next_for_every(s, state, now)
    elif s.kind == ScheduleKind.CRON:
        return _next_for_cron(s, now)
    else:
        raise ValueError(f"unknown schedule kind: {s.kind}")


def _next_for_at(s: CronSchedule, now: int) -> Optional[int]:
    """一次性任务：计算目标时间，已过期返回 None。"""
    if not s.at:
        raise ValueError("schedule.at is required for kind=at")
    dt = datetime.fromisoformat(s.at.replace("Z", "+00:00"))
    target_ms = int(dt.timestamp() * 1000)
    return target_ms if target_ms > now else None


def _next_for_every(s: CronSchedule, state: CronJobState, now: int) -> int:
    """
    固定间隔任务：基于 Unix 纪元对齐计算。
    - 首次发现（从未执行过）：使用当前纪元边界（floor），该边界已过期，
      会立即被判定为 due 并执行，不需要额外等待一个完整周期。
    - 后续执行：使用下一个纪元边界（floor + 1），保证整点对齐。
    例如 every_ms=60000（1分钟），始终在每分钟的 :00 秒执行。
    """
    if not s.every_ms or s.every_ms <= 0:
        raise ValueError("schedule.every_ms must be a positive integer for kind=every")
    if state.last_run_at_ms is None:
        # 首次：当前纪元边界（已过期），立即触发
        return (now // s.every_ms) * s.every_ms
    # 后续：下一个纪元边界
    return (now // s.every_ms + 1) * s.every_ms


def _next_for_cron(s: CronSchedule, now: int) -> int:
    """cron 表达式任务：用 croniter 计算下次执行时间。"""
    try:
        import pytz
        from croniter import croniter
    except ImportError as e:
        raise ImportError(f"croniter / pytz is required for cron schedule: {e}") from e

    if not s.expr:
        raise ValueError("schedule.expr is required for kind=cron")

    tz = pytz.timezone(s.tz or "UTC")
    now_dt = datetime.fromtimestamp(now / 1000, tz=tz)
    it = croniter(s.expr, start_time=now_dt)
    next_dt: datetime = it.get_next(datetime)
    return int(next_dt.timestamp() * 1000)
