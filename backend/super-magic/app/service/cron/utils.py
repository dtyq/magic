"""
cron 工具函数
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from app.service.cron.models import CronJob, CronJobState


CRON_LOG_INTERVAL_S = 30 * 60
CRON_LOG_MAX_JOBS = 5


def ms_to_iso(ms: Optional[int]) -> str:
    """毫秒时间戳转 ISO 格式字符串（UTC），None 返回 '-'。"""
    if ms is None:
        return "-"
    try:
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return str(ms)


def name_to_job_id(name: str) -> str:
    """将任务名称转换为合法文件名 ID（小写 + 连字符）。"""
    s = name.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "unnamed-job"


def format_job_label(job: CronJob) -> str:
    """日志优先展示任务名，同时保留不同的文件 ID 便于关联。"""
    name = " ".join((job.name or job.id).split())
    job_id = " ".join(job.id.split())
    suffix = f"（ID：{job_id}）" if name != job_id else ""
    return f"「{name}」{suffix}"


def format_log_time(ms: int, job: CronJob) -> str:
    """只格式化日志时间；无有效任务时区时明确回落 UTC。"""
    try:
        instant = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    except (ValueError, OverflowError, OSError, TypeError):
        return "时间无效，请检查任务状态"
    tz_name = job.timezone or job.schedule.tz
    if tz_name:
        import pytz

        try:
            instant = instant.astimezone(pytz.timezone(tz_name))
        except (pytz.UnknownTimeZoneError, ValueError, OverflowError):
            pass
    offset = instant.strftime("%z")
    tz_label = "UTC" if offset == "+0000" else f"UTC{offset[:3]}:{offset[3:]}"
    return f"{instant:%Y-%m-%d %H:%M:%S} {tz_label}"


def format_log_duration(seconds: float) -> str:
    """使用常见时间单位，避免读日志时换算毫秒。"""
    seconds = max(0.0, seconds)
    if seconds < 60:
        return f"{seconds:.1f} 秒"
    if seconds < 3600:
        return f"{seconds / 60:.1f} 分钟"
    return f"{seconds / 3600:.1f} 小时"


def format_job_schedule(job: CronJob, state: CronJobState | None) -> str:
    """只描述已有安排，不重新计算下一次时间或推断任务已送达。"""
    if not job.enabled:
        return "已停用，没有后续调度安排"
    if state is None:
        return "缺少调度状态，请检查任务状态文件"
    if state.running_at_ms is not None:
        return "本次任务已提交，尚未结束"
    if state.next_run_at_ms is None:
        return "尚未获得下一次执行时间，请检查任务配置和调度状态"
    return f"下次计划为 {format_log_time(state.next_run_at_ms, job)}"
