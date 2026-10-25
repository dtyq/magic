"""
cron 数据模型
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Mapping, Optional, cast

from agentlang.logger import get_logger
from app.core.models.agent_session import AgentSessionRef
from app.core.models.media_model import JsonObject
from app.service.cron.schema import (
    CURRENT_PAYLOAD_VERSION,
    LEGACY_BASELINE_VERSION,
    PAYLOAD_VERSION_FIELD,
)

logger = get_logger(__name__)


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
    tz: Optional[str] = None
    # kind=at
    at: Optional[str] = None
    # kind=every
    every_ms: Optional[int] = None
    # kind=cron / kind=every：达到此时间后自动禁用任务（ISO 8601，含时区偏移）
    end_at: Optional[str] = None
    @classmethod
    def from_payload(cls, payload: Mapping[str, object]) -> "CronSchedule":
        """从 cron Markdown 的 schedule 块恢复结构化调度配置。"""
        return cls(
            kind=ScheduleKind(str(payload.get("kind") or "")),
            expr=cast(Optional[str], payload.get("expr")),
            tz=cast(Optional[str], payload.get("tz")),
            at=cast(Optional[str], payload.get("at")),
            every_ms=cast(Optional[int], payload.get("every_ms")),
            end_at=cast(Optional[str], payload.get("end_at")),
        )

    def to_payload(self) -> dict[str, object]:
        """转换为 cron Markdown 的 schedule 块。"""
        payload: dict[str, object] = {"kind": self.kind.value}
        if self.expr is not None:
            payload["expr"] = self.expr
        if self.tz is not None:
            payload["tz"] = self.tz
        if self.at is not None:
            payload["at"] = self.at
        if self.every_ms is not None:
            payload["every_ms"] = self.every_ms
        if self.end_at is not None:
            payload["end_at"] = self.end_at
        return payload


@dataclass
class CronPayload:
    kind: PayloadKind = PayloadKind.AGENT_TURN
    agent_mode: Optional[str] = None
    agent_name: Optional[str] = None
    model_id: Optional[str] = None
    image_model_id: Optional[str] = None
    video_model_id: Optional[str] = None
    video_generation_config: Optional[JsonObject] = None
    # fork 保存的是“首次创建时是否继承来源上下文”，不是“每次都覆盖目标会话”。
    fork: bool = False
    # 有值表示跨触发继续同一最终 ID；为空表示每次触发重新分配一个新 ID。
    agent_id: Optional[str] = None
    # 只有 fork=true 才保存来源。执行时读取来源的最新持久化快照，而不是复制配置时的内存对象。
    context_source: Optional[AgentSessionRef] = None
    timeout_seconds: Optional[int] = None
    notify_user: bool = True
    # 仅用于 payload 结构迁移，不改变旧字段的位置参数顺序。
    version: int = CURRENT_PAYLOAD_VERSION

    def __post_init__(self) -> None:
        if (
            isinstance(self.version, bool)
            or not isinstance(self.version, int)
            or self.version < LEGACY_BASELINE_VERSION
        ):
            raise ValueError(
                f"cron payload.{PAYLOAD_VERSION_FIELD} must be >= "
                f"{LEGACY_BASELINE_VERSION}, got {self.version}"
            )
        if self.agent_id is not None:
            self.agent_id = self.agent_id.strip() or None
        if self.fork and self.context_source is None:
            raise ValueError("fork cron payload requires context_source")
        if not self.fork and self.context_source is not None:
            raise ValueError("non-fork cron payload cannot define context_source")

    @classmethod
    def from_payload(cls, payload: Mapping[str, object]) -> "CronPayload":
        """从 cron Markdown 的 payload 块恢复结构化执行配置。"""
        raw_version = payload.get(PAYLOAD_VERSION_FIELD, LEGACY_BASELINE_VERSION)
        if (
            isinstance(raw_version, bool)
            or not isinstance(raw_version, int)
            or raw_version < LEGACY_BASELINE_VERSION
        ):
            logger.warning(
                f"cron payload.{PAYLOAD_VERSION_FIELD} is invalid; "
                f"treating it as legacy v{LEGACY_BASELINE_VERSION}: {raw_version!r}"
            )
            raw_version = LEGACY_BASELINE_VERSION

        raw_kind = payload.get("kind", PayloadKind.AGENT_TURN.value)
        try:
            kind = PayloadKind(str(raw_kind))
        except ValueError:
            kind = PayloadKind.AGENT_TURN

        raw_agent_mode = payload.get("agent_mode")
        if raw_agent_mode is not None and not isinstance(raw_agent_mode, str):
            raise ValueError(
                "cron payload.agent_mode must be a string when present, "
                f"got {type(raw_agent_mode).__name__}"
            )
        agent_mode = raw_agent_mode.strip() or None if raw_agent_mode is not None else None

        raw_context_source = payload.get("context_source")
        context_source = (
            AgentSessionRef.from_payload(raw_context_source)
            if raw_context_source is not None
            else None
        )
        video_generation_config = payload.get("video_generation_config")
        if video_generation_config is not None and not isinstance(video_generation_config, dict):
            raise ValueError("cron payload.video_generation_config must be an object when present")

        return cls(
            kind=kind,
            version=raw_version,
            agent_mode=agent_mode,
            agent_name=_optional_non_empty_string(payload.get("agent_name")),
            model_id=cast(Optional[str], payload.get("model_id")),
            image_model_id=cast(Optional[str], payload.get("image_model_id")),
            video_model_id=cast(Optional[str], payload.get("video_model_id")),
            video_generation_config=cast(Optional[JsonObject], video_generation_config),
            fork=bool(payload.get("fork", False)),
            agent_id=_optional_non_empty_string(payload.get("agent_id")),
            context_source=context_source,
            timeout_seconds=cast(Optional[int], payload.get("timeout_seconds")),
            notify_user=bool(payload.get("notify_user", payload.get("notify_main_agent", True))),
        )

    def to_payload(self) -> dict[str, object]:
        """转换为 cron Markdown 的 payload 块。"""
        payload: dict[str, object] = {
            "kind": self.kind.value,
            PAYLOAD_VERSION_FIELD: self.version,
        }
        if self.agent_mode:
            payload["agent_mode"] = self.agent_mode
        if self.agent_name:
            payload["agent_name"] = self.agent_name
        if self.model_id is not None:
            payload["model_id"] = self.model_id
        if self.image_model_id is not None:
            payload["image_model_id"] = self.image_model_id
        if self.video_model_id is not None:
            payload["video_model_id"] = self.video_model_id
        if self.video_generation_config is not None:
            payload["video_generation_config"] = self.video_generation_config
        payload["fork"] = self.fork
        if self.agent_id is not None:
            payload["agent_id"] = self.agent_id
        if self.context_source is not None:
            payload["context_source"] = self.context_source.to_payload()
        if self.timeout_seconds is not None:
            payload["timeout_seconds"] = self.timeout_seconds
        if not self.notify_user:
            payload["notify_user"] = False
        return payload


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
    timezone: Optional[str] = None # 用户时区（IANA 名称），创建时写入，影响结果文件目录和时间戳展示


@dataclass
class CronJobPatch:
    """manage_cron update 当前允许修改的 cron 字段。"""

    schedule: Optional[CronSchedule] = None
    timeout_seconds: Optional[int] = None
    enabled: Optional[bool] = None
    body: Optional[str] = None
    notify_user: Optional[bool] = None
    fork: Optional[bool] = None
    agent_id: Optional[str] = None
    # agent_id=None 既可能表示“没有更新”，也可能表示“明确删除固定 ID”；
    # 单独的布尔值用于区分这两种情况，避免 update 意外改变会话生命周期。
    update_agent_id: bool = False
    context_source: Optional[AgentSessionRef] = None


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
    agent_id: Optional[str] = None


@dataclass
class CronState:
    """整个 .cron-state.json 的内容。"""
    version: int = 1
    jobs: dict[str, CronJobState] = field(default_factory=dict)


def _optional_non_empty_string(value: object) -> Optional[str]:
    return value if isinstance(value, str) and value else None
