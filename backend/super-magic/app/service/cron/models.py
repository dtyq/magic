"""
cron 数据模型
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Optional


class ScheduleKind(StrEnum):
    AT = "at"
    EVERY = "every"
    CRON = "cron"


class PayloadKind(StrEnum):
    AGENT_TURN = "agent_turn"
    SYSTEM_EVENT = "system_event"  # TODO: 暂未实现


class CronJobStatus(StrEnum):
    OK = "ok"
    ERROR = "error"
    RUNNING = "running"


@dataclass
class CronSchedule:
    kind: ScheduleKind
    # kind=cron
    expr: Optional[str] = None
    tz: str = "UTC"
    # kind=at
    at: Optional[str] = None
    # kind=every
    every_ms: Optional[int] = None


@dataclass
class CronPayload:
    kind: PayloadKind = PayloadKind.AGENT_TURN
    agent_name: str = "magic"
    model_id: Optional[str] = None
    timeout_seconds: Optional[int] = None


@dataclass
class CronJob:
    """内存中的 cron 任务，由 MD 文件解析而来。"""
    id: str                        # 文件名（不含 .md），即任务唯一标识
    schedule: CronSchedule
    payload: CronPayload
    body: str                      # MD 正文，agent_turn 时是 prompt
    enabled: bool = True
    name: Optional[str] = None     # 可选的展示名称（从 frontmatter name 字段读取）
    mtime: float = 0.0             # 文件最后修改时间，用于变更检测


@dataclass
class CronJobState:
    """单个 job 的运行时状态，持久化到 .cron-state.json。"""
    next_run_at_ms: Optional[int] = None
    running_at_ms: Optional[int] = None
    last_run_at_ms: Optional[int] = None
    last_status: Optional[str] = None
    last_error: Optional[str] = None
    consecutive_errors: int = 0
    anchor_ms: Optional[int] = None   # every 类型锚点


@dataclass
class CronRunResult:
    status: str          # "ok" | "error"
    result: str = ""
    error: str = ""
    duration_ms: int = 0
    started_at_ms: Optional[int] = None   # 执行开始时间戳（毫秒）


@dataclass
class CronState:
    """整个 .cron-state.json 的内容。"""
    version: int = 1
    jobs: dict[str, CronJobState] = field(default_factory=dict)
