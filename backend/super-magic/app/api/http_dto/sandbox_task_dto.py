"""通用沙箱任务 HTTP 数据模型。"""

from typing import Any, Optional

from pydantic import BaseModel, Field


class CreateSandboxTaskRequest(BaseModel):
    """创建沙箱任务请求。"""

    task_id: str = Field(..., min_length=1, max_length=200)
    capability: str = Field(..., min_length=1, max_length=100)
    project_path: str = Field(..., min_length=1, max_length=1000)
    payload: dict[str, Any] = Field(default_factory=dict)


class SandboxTaskResponse(BaseModel):
    """沙箱任务响应。"""

    task_id: str
    capability: str
    status: str
    output: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: str
    updated_at: str

