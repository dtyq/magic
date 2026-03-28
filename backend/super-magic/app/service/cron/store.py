"""
cron 持久化层

负责：
- 扫描 cron 目录，解析 MD 文件 → CronJob
- 读写 .cron-state.json → CronState / CronJobState
- 写 cron-result/*.md
- 构建 / 更新 cron job MD 文件内容
- 归档已完成的一次性任务（at 类型成功后追加到 .archived-jobs.jsonl 并删除原文件）
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.service.cron.models import (
    CronJob,
    CronJobState,
    CronPayload,
    CronRunResult,
    CronSchedule,
    CronState,
    PayloadKind,
    ScheduleKind,
)
from app.utils.async_file_utils import (
    async_exists,
    async_mkdir,
    async_read_json,
    async_read_text,
    async_scandir,
    async_try_read_markdown,
    async_try_read_text,
    async_unlink,
    async_write_json,
    async_write_text,
)

logger = get_logger(__name__)

# 结果文件截断限制
_MAX_RESULT_BYTES = 500_000
_MAX_RESULT_LINES = 2_000

# 归档文件并发写入锁
_archive_lock: asyncio.Lock = asyncio.Lock()


# ── 任务文件扫描 ──────────────────────────────────────────────────────────────

async def scan_jobs(known_mtimes: Dict[str, float]) -> List[CronJob]:
    """
    扫描 cron 目录，返回所有有效任务列表。
    known_mtimes: {job_id: mtime}，用于增量检测变更文件。
    不存在目录时返回空列表。
    """
    cron_dir = PathManager.get_cron_dir()
    if not await async_exists(cron_dir):
        return []

    jobs: List[CronJob] = []
    entries = await async_scandir(cron_dir)
    for entry in entries:
        if not entry.name.endswith(".md") or entry.name.startswith("."):
            continue
        job_id = entry.name[:-3]  # 去掉 .md
        try:
            stat = entry.stat()
            mtime = stat.st_mtime
        except OSError:
            continue

        job = await _parse_job_file(Path(entry.path), job_id, mtime)
        if job is not None:
            jobs.append(job)

    return jobs


async def _parse_job_file(path: Path, job_id: str, mtime: float) -> Optional[CronJob]:
    """解析单个 cron MD 文件，返回 CronJob 或 None（解析失败时）。"""
    md = await async_try_read_markdown(path)
    if md is None:
        logger.warning(f"cron: failed to read {path}")
        return None

    try:
        meta = md.meta or {}
        body = (md.body or "").strip()

        schedule_cfg = meta.get("schedule", {}) or {}
        payload_cfg = meta.get("payload", {}) or {}

        kind_str = schedule_cfg.get("kind", "")
        try:
            kind = ScheduleKind(kind_str)
        except ValueError:
            logger.warning(f"cron: unknown schedule kind '{kind_str}' in {path}")
            return None

        schedule = CronSchedule(
            kind=kind,
            expr=schedule_cfg.get("expr"),
            tz=schedule_cfg.get("tz", "UTC"),
            at=schedule_cfg.get("at"),
            every_ms=schedule_cfg.get("every_ms"),
        )

        payload_kind_str = payload_cfg.get("kind", PayloadKind.AGENT_TURN)
        try:
            payload_kind = PayloadKind(payload_kind_str)
        except ValueError:
            logger.warning(f"cron: unknown payload kind '{payload_kind_str}' in {path}, defaulting to agent_turn")
            payload_kind = PayloadKind.AGENT_TURN

        payload = CronPayload(
            kind=payload_kind,
            agent_name=payload_cfg.get("agent_name", "magic"),
            model_id=payload_cfg.get("model_id"),
            timeout_seconds=payload_cfg.get("timeout_seconds"),
            notify_main_agent=bool(payload_cfg.get("notify_main_agent", True)),
        )

        enabled = meta.get("enabled", True)
        name = meta.get("name")
        timezone = meta.get("timezone")

        return CronJob(
            id=job_id,
            schedule=schedule,
            payload=payload,
            body=body,
            enabled=bool(enabled),
            name=name,
            mtime=mtime,
            timezone=timezone or None,
        )
    except Exception as e:
        logger.warning(f"cron: parse error in {path}: {e}")
        return None


# ── 状态文件读写 ──────────────────────────────────────────────────────────────

async def load_cron_state() -> CronState:
    """读取 .cron-state.json，文件不存在或损坏时返回空状态。"""
    state_file = PathManager.get_cron_state_file()
    if not await async_exists(state_file):
        return CronState()
    try:
        data = await async_read_json(state_file)
        jobs: Dict[str, CronJobState] = {}
        for job_id, job_data in (data.get("jobs") or {}).items():
            jobs[job_id] = CronJobState(
                next_run_at_ms=job_data.get("next_run_at_ms"),
                running_at_ms=job_data.get("running_at_ms"),
                last_run_at_ms=job_data.get("last_run_at_ms"),
                last_status=job_data.get("last_status"),
                last_error=job_data.get("last_error"),
                consecutive_errors=job_data.get("consecutive_errors", 0),
                anchor_ms=job_data.get("anchor_ms"),
            )
        return CronState(version=data.get("version", 1), jobs=jobs)
    except Exception as e:
        logger.error(f"cron: failed to load state file, starting fresh: {e}")
        return CronState()


async def save_cron_state(state: CronState) -> None:
    """原子写入 .cron-state.json。"""
    cron_dir = PathManager.get_cron_dir()
    await async_mkdir(cron_dir, parents=True, exist_ok=True)
    state_file = PathManager.get_cron_state_file()
    data = {
        "version": state.version,
        "jobs": {
            job_id: {
                "next_run_at_ms": js.next_run_at_ms,
                "running_at_ms": js.running_at_ms,
                "last_run_at_ms": js.last_run_at_ms,
                "last_status": js.last_status,
                "last_error": js.last_error,
                "consecutive_errors": js.consecutive_errors,
                "anchor_ms": js.anchor_ms,
            }
            for job_id, js in state.jobs.items()
        },
    }
    await async_write_json(state_file, data, indent=2, ensure_ascii=False)


# ── 结果文件写入 ──────────────────────────────────────────────────────────────

def _truncate_result(text: str) -> str:
    """按行数和字节数双重截断，超出时追加截断提示。"""
    if not text:
        return text
    lines = text.splitlines()
    if len(lines) > _MAX_RESULT_LINES:
        lines = lines[:_MAX_RESULT_LINES]
        lines.append(f"\n[truncated: exceeded {_MAX_RESULT_LINES} lines]")
        text = "\n".join(lines)
    encoded = text.encode()
    if len(encoded) > _MAX_RESULT_BYTES:
        text = encoded[:_MAX_RESULT_BYTES].decode(errors="ignore")
        text += f"\n[truncated: exceeded {_MAX_RESULT_BYTES} bytes]"
    return text


async def write_result_file(job: CronJob, result: CronRunResult) -> Path:
    """写入 cron-result/*.md 结果文件，返回文件路径。"""
    finished_at = datetime.now(timezone.utc)
    started_at = (
        datetime.fromtimestamp(result.started_at_ms / 1000, tz=timezone.utc)
        if result.started_at_ms is not None
        else finished_at
    )

    # 时区转换优先于路径构建，目录日期以 job 配置的时区为准，避免跨时区用户看到日期错位
    # 优先级：job.timezone（创建时写入）> schedule.tz（cron 表达式时区）> 系统时区
    from agentlang.utils.timezone_utils import get_system_timezone
    tz_str = job.timezone or getattr(job.schedule, "tz", None) or get_system_timezone()
    try:
        import pytz
        tz = pytz.timezone(tz_str)
        started_at_local = started_at.astimezone(tz)
        finished_at_local = finished_at.astimezone(tz)
    except Exception:
        started_at_local = started_at
        finished_at_local = finished_at

    path = PathManager.get_cron_result_file(job.id, started_at_local)
    await async_mkdir(path.parent, parents=True, exist_ok=True)

    body = _truncate_result(result.result or result.error)
    content = (
        f"---\n"
        f"job: {job.id}\n"
        f"started_at: \"{started_at_local.isoformat()}\"\n"
        f"finished_at: \"{finished_at_local.isoformat()}\"\n"
        f"status: {result.status}\n"
        f"duration_ms: {result.duration_ms}\n"
        f"agent_id: cron-{job.id}\n"
        f"---\n\n"
        f"{body}\n"
    )
    await async_write_text(path, content)
    return path


# ── job MD 文件构建 / 更新 ────────────────────────────────────────────────────

def build_job_md(
    schedule: Dict[str, Any],
    payload_kind: str,
    agent_name: str,
    model_id: Optional[str],
    timeout_seconds: Optional[int],
    enabled: bool,
    name: Optional[str],
    body: str,
    timezone: Optional[str] = None,
    notify_main_agent: bool = False,
) -> str:
    """构建新 cron job MD 文件内容。"""
    import yaml
    from datetime import datetime, timezone as dt_timezone
    from agentlang.utils.timezone_utils import get_system_timezone
    _tz_str = timezone or get_system_timezone()
    try:
        import pytz
        _tz = pytz.timezone(_tz_str)
        _now = datetime.now(_tz)
    except Exception:
        _now = datetime.now(dt_timezone.utc)
    frontmatter: Dict[str, Any] = {
        "created_at": _now.isoformat(),
        "schedule": schedule,
        "payload": {
            "kind": payload_kind,
            "agent_name": agent_name,
        },
        "enabled": enabled,
    }
    if name:
        frontmatter["name"] = name
    if timezone:
        frontmatter["timezone"] = timezone
    if model_id is not None:
        frontmatter["payload"]["model_id"] = model_id
    if timeout_seconds is not None:
        frontmatter["payload"]["timeout_seconds"] = timeout_seconds
    if not notify_main_agent:
        frontmatter["payload"]["notify_main_agent"] = False

    fm_str = yaml.dump(frontmatter, allow_unicode=True, default_flow_style=False).rstrip()
    return f"---\n{fm_str}\n---\n\n{body.strip()}\n"


def patch_job_md(
    existing: str,
    schedule: Optional[Dict[str, Any]],
    payload_kind: Optional[str],
    agent_name: Optional[str],
    model_id: Optional[str],
    timeout_seconds: Optional[int],
    enabled: Optional[bool],
    body: Optional[str],
    notify_main_agent: Optional[bool] = None,
) -> str:
    """
    对已有 MD 文件进行局部更新。
    只更新传入了非 None 值的字段，其余保持原样。
    """
    import yaml
    if existing.startswith("---"):
        parts = existing.split("---", 2)
        if len(parts) >= 3:
            fm_raw = parts[1]
            old_body = parts[2].strip()
        else:
            fm_raw = ""
            old_body = existing
    else:
        fm_raw = ""
        old_body = existing

    try:
        meta = yaml.safe_load(fm_raw) or {}
    except Exception:
        meta = {}

    if schedule is not None:
        meta["schedule"] = schedule
    if enabled is not None:
        meta["enabled"] = enabled

    payload = meta.get("payload", {}) or {}
    if payload_kind is not None:
        payload["kind"] = payload_kind
    if agent_name is not None:
        payload["agent_name"] = agent_name
    if model_id is not None:
        payload["model_id"] = model_id
    if timeout_seconds is not None:
        payload["timeout_seconds"] = timeout_seconds
    if notify_main_agent is not None:
        if not notify_main_agent:
            payload["notify_main_agent"] = False
        else:
            payload.pop("notify_main_agent", None)
    meta["payload"] = payload

    new_body = body.strip() if body is not None else old_body
    fm_str = yaml.dump(meta, allow_unicode=True, default_flow_style=False).rstrip()
    return f"---\n{fm_str}\n---\n\n{new_body}\n"


# ── 已完成一次性任务归档 ──────────────────────────────────────────────────────

async def archive_completed_job(job: CronJob, result: CronRunResult, run_at: datetime) -> bool:
    """
    归档已成功完成的一次性任务（at 类型）。

    将任务定义和执行摘要追加到 cron-result/{YYYY-MM-DD}/.archived-jobs.jsonl，
    成功后删除 cron 目录下的原始 MD 文件。
    归档失败时记录错误并返回 False，原始文件保留不删除。
    """
    date_dir = run_at.strftime("%Y-%m-%d")
    archive_file = PathManager.get_cron_archived_jobs_file(date_dir)

    record = {
        "id": job.id,
        "name": job.name,
        "archived_at": run_at.isoformat(),
        "status": result.status,
        "duration_ms": result.duration_ms,
        "schedule": {
            "kind": str(job.schedule.kind),
            "at": job.schedule.at,
            "tz": job.schedule.tz,
        },
        "payload": {
            "kind": str(job.payload.kind),
            "agent_name": job.payload.agent_name,
        },
        "timezone": job.timezone,
        "body": job.body,
    }

    try:
        async with _archive_lock:
            await async_mkdir(archive_file.parent, parents=True, exist_ok=True)
            existing = await async_try_read_text(archive_file) or ""
            if existing and not existing.endswith("\n"):
                existing += "\n"
            line = json.dumps(record, ensure_ascii=False)
            await async_write_text(archive_file, existing + line + "\n")

        job_file = PathManager.get_cron_dir() / f"{job.id}.md"
        await async_unlink(job_file)
        logger.info(f"cron: job [{job.id}] archived to {archive_file} and removed from cron dir")
        return True
    except Exception as e:
        logger.error(f"cron: failed to archive job [{job.id}]: {e}")
        return False
