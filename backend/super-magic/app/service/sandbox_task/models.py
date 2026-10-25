"""通用沙箱任务的数据模型。"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class SandboxTaskStatus(str, Enum):
    """通用沙箱任务状态。"""

    QUEUED = "queued"
    PREPARING = "preparing"
    RUNNING = "running"
    FINALIZING = "finalizing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SandboxTask(BaseModel):
    """可持久化的沙箱任务快照。"""

    model_config = ConfigDict(use_enum_values=True)

    task_id: str
    capability: str
    project_path: str
    payload: dict[str, Any] = Field(default_factory=dict)
    status: SandboxTaskStatus = SandboxTaskStatus.QUEUED
    output: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

