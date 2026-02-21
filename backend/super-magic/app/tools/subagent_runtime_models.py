from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel


SubagentStatus = Literal["idle", "pending", "running", "interrupted", "done", "error"]


class SubagentSessionState(BaseModel):
    """持久化到 .session.json 的 subagent 会话运行态。"""

    agent_name: str
    agent_id: str
    status: SubagentStatus = "idle"
    last_prompt_digest: Optional[str] = None
    last_result: Optional[str] = None
    last_error: Optional[str] = None
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    active_tool_call_id: Optional[str] = None
    last_tool_call_id: Optional[str] = None
    cached_tool_result: Optional[Dict[str, Any]] = None
    interrupt_requested: bool = False
    interrupt_reason: Optional[str] = None

