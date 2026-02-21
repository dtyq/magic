from enum import StrEnum
from dataclasses import field
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator
from pydantic.dataclasses import dataclass


class SubagentStatus(StrEnum):
    IDLE = "idle"
    PENDING = "pending"
    RUNNING = "running"
    INTERRUPTED = "interrupted"
    DONE = "done"
    ERROR = "error"


class SubagentQueryStatus(StrEnum):
    NOT_FOUND = "not_found"
    AMBIGUOUS = "ambiguous"
    IDLE = SubagentStatus.IDLE
    PENDING = SubagentStatus.PENDING
    RUNNING = SubagentStatus.RUNNING
    INTERRUPTED = SubagentStatus.INTERRUPTED
    DONE = SubagentStatus.DONE
    ERROR = SubagentStatus.ERROR


class SubagentExecutionMode(StrEnum):
    SYNC = "sync"
    BACKGROUND = "background"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class SubagentPayload:
    """`call_subagent` 的结构化返回载荷。"""

    agent_name: str
    agent_id: str
    status: SubagentStatus
    mode: SubagentExecutionMode
    result: Optional[str] = None
    error: Optional[str] = None
    resume_hint: Optional[str] = None


@dataclass
class SubagentQueryResult:
    """`get_sub_agent_results` 的单项查询结果。"""

    agent_id: str
    status: SubagentQueryStatus
    agent_name: Optional[str] = None
    result: Optional[str] = None
    error: Optional[str] = None


@dataclass
class SubagentSessionConfigBlock:
    """`.session.json` 中沿用的模型配置块。"""

    model_id: Optional[str] = None
    image_model_id: Optional[str] = None
    image_model_sizes: Any = None
    mcp_servers: Any = None


@dataclass
class SubagentSessionDocument:
    """包含 subagent 运行态的完整会话文档。"""

    last: SubagentSessionConfigBlock = field(default_factory=SubagentSessionConfigBlock)
    current: SubagentSessionConfigBlock = field(default_factory=SubagentSessionConfigBlock)
    subagent: Optional["SubagentSessionState"] = None
    extra_fields: dict[str, Any] = field(default_factory=dict)


class SubagentSessionState(BaseModel):
    """持久化到 .session.json 的 subagent 会话运行态。"""

    agent_name: str
    agent_id: str
    status: SubagentStatus = SubagentStatus.IDLE
    last_prompt_digest: Optional[str] = None
    last_result: Optional[str] = None
    last_error: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    active_tool_call_id: Optional[str] = None
    last_tool_call_id: Optional[str] = None
    cached_tool_result: Optional[SubagentPayload] = None
    interrupt_requested: bool = False
    interrupt_reason: Optional[str] = None

    @model_validator(mode="after")
    def validate_lifecycle(self) -> "SubagentSessionState":
        if self.status in {SubagentStatus.PENDING, SubagentStatus.RUNNING} and self.started_at is None:
            raise ValueError("started_at is required when subagent status is pending or running")

        if self.status in {SubagentStatus.DONE, SubagentStatus.INTERRUPTED, SubagentStatus.ERROR}:
            if self.started_at is None:
                raise ValueError("started_at is required when subagent status is terminal")
            if self.finished_at is None:
                raise ValueError("finished_at is required when subagent status is terminal")

        return self
