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
from typing import Any, Dict, List, Mapping, Optional, Tuple

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.service.cron.models import (
    CronJob,
    CronJobPatch,
    CronJobState,
    CronPayload,
    CronRunResult,
    CronSchedule,
    CronState,
    PayloadKind,
    ScheduleKind,
)
from app.service.cron.schema import LEGACY_BASELINE_VERSION, PAYLOAD_VERSION_FIELD
from app.utils.async_file_utils import (
    async_exists,
    async_mkdir,
    async_read_json,
    async_read_text,
    async_stat,
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
_payload_field_locks: dict[Path, asyncio.Lock] = {}


# ── 任务文件扫描 ──────────────────────────────────────────────────────────────

async def scan_jobs(
    known_mtimes: Dict[str, float],
    known_invalid_mtimes: Optional[Dict[str, float]] = None,
) -> Tuple[List[CronJob], Dict[str, float]]:
    """
    扫描 cron 目录，返回所有有效任务列表及本次解析失败文件的 mtime 映射。

    known_mtimes: {job_id: mtime}，有效任务的 mtime 缓存，用于增量检测变更文件。
    known_invalid_mtimes: {job_id: mtime}，无效文件的 mtime 缓存；mtime 未变时跳过重解析，
        避免因文件内容未修复而在每次 tick 中重复打印告警。

    返回 (valid_jobs, new_invalid_mtimes)：
        valid_jobs: 本次扫描解析成功的 CronJob 列表
        new_invalid_mtimes: 本次仍无效的文件 mtime 映射（含跳过的和新发现的）
    """
    if known_invalid_mtimes is None:
        known_invalid_mtimes = {}

    cron_dir = PathManager.get_cron_dir()
    if not await async_exists(cron_dir):
        return [], {}

    jobs: List[CronJob] = []
    new_invalid_mtimes: Dict[str, float] = {}
    entries = await async_scandir(cron_dir)
    for entry in entries:
        if entry.is_dir() or not entry.name.endswith(".md") or entry.name.startswith("."):
            continue
        job_id = entry.name[:-3]  # 去掉 .md
        try:
            stat = entry.stat()
            mtime = stat.st_mtime
        except OSError:
            continue

        # mtime 未变的已知无效文件：直接跳过，不重复告警
        if known_invalid_mtimes.get(job_id) == mtime:
            new_invalid_mtimes[job_id] = mtime
            continue

        job = await _parse_job_file(Path(entry.path), job_id, mtime)
        if job is not None:
            jobs.append(job)
        else:
            new_invalid_mtimes[job_id] = mtime

    return jobs, new_invalid_mtimes


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

        schedule = CronSchedule.from_payload(schedule_cfg)

        # 最小调度粒度为 1 分钟，every_ms < 60000 视为无效配置
        if kind == ScheduleKind.EVERY:
            every_ms = schedule.every_ms
            if not every_ms or every_ms < 60_000:
                logger.warning(
                    f"cron: every_ms={every_ms} in {path} is below minimum (60000ms / 1min), ignoring job"
                )
                return None

        payload_kind_str = payload_cfg.get("kind", PayloadKind.AGENT_TURN)
        try:
            PayloadKind(payload_kind_str)
        except ValueError:
            logger.warning(f"cron: unknown payload kind '{payload_kind_str}' in {path}, defaulting to agent_turn")
            payload_cfg = dict(payload_cfg)
            payload_cfg["kind"] = PayloadKind.AGENT_TURN.value

        payload = CronPayload.from_payload(payload_cfg)

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
    tz_str = job.timezone or job.schedule.tz or "UTC"
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
        f"agent_id: {json.dumps(result.agent_id or '-', ensure_ascii=False)}\n"
        f"---\n\n"
        f"{body}\n"
    )
    await async_write_text(path, content)
    await _prune_result_files(path.parent, keep=5)
    return path


async def _prune_result_files(job_result_dir: Path, keep: int = 5) -> None:
    """保留目录下最新的 keep 条 .md 结果文件，删除更旧的。"""
    try:
        entries = await async_scandir(job_result_dir)
        md_names = sorted(
            [e.name for e in entries if e.name.endswith(".md")],
            reverse=True,
        )
        for old_name in md_names[keep:]:
            await async_unlink(job_result_dir / old_name)
    except Exception as e:
        logger.warning(f"cron: failed to prune result files in {job_result_dir}: {e}")


# ── job MD 文件构建 / 更新 ────────────────────────────────────────────────────

def build_job_md(job: CronJob) -> str:
    """构建新 cron job MD 文件内容。"""
    import yaml
    from datetime import datetime, timezone as dt_timezone
    from agentlang.utils.timezone_utils import get_system_timezone
    _tz_str = job.timezone or get_system_timezone()
    try:
        import pytz
        _tz = pytz.timezone(_tz_str)
        _now = datetime.now(_tz)
    except Exception:
        _now = datetime.now(dt_timezone.utc)
    frontmatter: Dict[str, Any] = {
        "created_at": _now.isoformat(),
        "schedule": job.schedule.to_payload(),
        "payload": job.payload.to_payload(),
        "enabled": job.enabled,
    }
    if job.name:
        frontmatter["name"] = job.name
    if job.timezone:
        frontmatter["timezone"] = job.timezone

    fm_str = yaml.dump(frontmatter, allow_unicode=True, default_flow_style=False).rstrip()
    return f"---\n{fm_str}\n---\n\n{job.body.strip()}\n"


def patch_job_md(
    existing: str,
    patch: CronJobPatch,
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

    if patch.schedule is not None:
        meta["schedule"] = patch.schedule.to_payload()
    if patch.enabled is not None:
        meta["enabled"] = patch.enabled

    payload = meta.get("payload", {}) or {}
    if patch.timeout_seconds is not None:
        payload["timeout_seconds"] = patch.timeout_seconds
    if patch.notify_user is not None:
        if not patch.notify_user:
            payload["notify_user"] = False
        else:
            payload.pop("notify_user", None)
    if patch.fork is not None:
        payload["fork"] = patch.fork
        if patch.fork:
            if patch.context_source is None:
                raise ValueError("fork cron update requires context_source")
            payload["context_source"] = patch.context_source.to_payload()
        else:
            # fork=false 表示这个任务以后不再从来源聊天创建 Agent，旧来源不能继续残留。
            payload.pop("context_source", None)
    if patch.update_agent_id:
        # None 既可能表示“这次没有修改 agent_id”，也可能表示“明确删除固定 Agent”，
        # 所以是否修改由 update_agent_id 单独表达。例如只修改每天执行时间时，不能因为
        # agent_id 没传，就删掉原来用于持续追踪进度的固定 Agent。
        if patch.agent_id:
            payload["agent_id"] = patch.agent_id
        else:
            payload.pop("agent_id", None)
    meta["payload"] = payload

    new_body = patch.body.strip() if patch.body is not None else old_body
    fm_str = yaml.dump(meta, allow_unicode=True, default_flow_style=False).rstrip()
    return f"---\n{fm_str}\n---\n\n{new_body}\n"


async def persist_payload_fields(
    job: CronJob,
    field_patch: Mapping[str, object | None],
) -> CronPayload | None:
    """幂等写回 payload 字段，并返回文件中的最新 payload。"""
    import yaml

    if not field_patch:
        return job.payload

    path = PathManager.get_cron_dir() / f"{job.id}.md"
    lock = _payload_field_locks.setdefault(path, asyncio.Lock())
    async with lock:
        current_stat = await async_stat(path)
        if job.mtime and current_stat.st_mtime != job.mtime:
            existing_job = await _parse_job_file(path, job.id, current_stat.st_mtime)
            if existing_job is None:
                logger.warning(
                    f"cron: skip payload field patch for [{job.id}], "
                    "job file changed and could not be reloaded"
                )
                return None
            job.mtime = current_stat.st_mtime
            return existing_job.payload

        existing = await async_read_text(path)
        parts = existing.split("---", 2)
        if len(parts) < 3:
            raise ValueError(f"cron job [{job.id}] has invalid frontmatter")

        metadata = yaml.safe_load(parts[1]) or {}
        if not isinstance(metadata, dict):
            raise ValueError(f"cron job [{job.id}] frontmatter must be an object")
        current_payload = metadata.get("payload") or {}
        if not isinstance(current_payload, dict):
            raise ValueError(f"cron job [{job.id}] payload must be an object")

        current_agent_name = current_payload.get("agent_name")
        normalized_current_name = (
            current_agent_name.strip()
            if isinstance(current_agent_name, str)
            else ""
        )
        expected_agent_name = (
            job.payload.agent_name.strip()
            if isinstance(job.payload.agent_name, str)
            else ""
        )
        if normalized_current_name != expected_agent_name:
            logger.warning(
                f"cron: skip payload field patch for [{job.id}], "
                "agent identity changed while the job was running"
            )
            return CronPayload.from_payload(current_payload)

        raw_current_version = current_payload.get(
            PAYLOAD_VERSION_FIELD,
            LEGACY_BASELINE_VERSION,
        )
        current_version = (
            raw_current_version
            if isinstance(raw_current_version, int) and not isinstance(raw_current_version, bool)
            else LEGACY_BASELINE_VERSION
        )
        target_version = field_patch.get(PAYLOAD_VERSION_FIELD)
        if isinstance(target_version, int) and not isinstance(target_version, bool):
            if current_version > target_version:
                return CronPayload.from_payload(current_payload)

        for field_name, field_value in field_patch.items():
            if field_name == PAYLOAD_VERSION_FIELD:
                continue
            if field_name in current_payload and current_payload[field_name] != field_value:
                logger.warning(
                    f"cron: skip payload field patch for [{job.id}], "
                    f"field '{field_name}' changed while the job was running"
                )
                return CronPayload.from_payload(current_payload)

        patch_is_applied = all(
            (
                field_name not in current_payload
                if field_value is None
                else current_payload.get(field_name) == field_value
            )
            for field_name, field_value in field_patch.items()
        )
        if patch_is_applied:
            return CronPayload.from_payload(current_payload)

        latest_stat = await async_stat(path)
        if job.mtime and latest_stat.st_mtime != job.mtime:
            latest_job = await _parse_job_file(path, job.id, latest_stat.st_mtime)
            if latest_job is None:
                logger.warning(
                    f"cron: skip payload field patch for [{job.id}], "
                    "job file changed before patch write-back"
                )
                return None
            job.mtime = latest_job.mtime
            return latest_job.payload

        for field_name, field_value in field_patch.items():
            if field_value is None:
                current_payload.pop(field_name, None)
            else:
                current_payload[field_name] = field_value
        metadata["payload"] = current_payload
        frontmatter = yaml.dump(
            metadata,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False,
        ).rstrip()
        updated = f"---\n{frontmatter}\n---{parts[2]}"
        await async_write_text(path, updated)
        logger.info(
            f"cron job [{job.id}] persisted payload fields: "
            f"{', '.join(sorted(field_patch))}"
        )
        return CronPayload.from_payload(current_payload)


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
            "tz": job.schedule.tz or "UTC",
        },
        "payload": {
            "kind": str(job.payload.kind),
            "agent_mode": job.payload.agent_mode,
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
