"""记录实际文件改名结果，供失败后核查身份并只恢复画布引用。"""

from __future__ import annotations

import hashlib
import os
import time
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field
from pydantic import JsonValue as PydanticJsonValue

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.path_manager import PathManager
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.types import JsonObject
from app.utils.async_file_utils import (
    async_chmod,
    async_exists,
    async_mkdir,
    async_read_json,
    async_scandir,
    async_unlink,
    async_write_json,
)


class CanvasRenameExecution(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tool_call_id: str
    topic_id: str
    workspace: str
    payload: dict[str, PydanticJsonValue]
    created_at: float = Field(default_factory=time.time)


class CanvasRenameExecutionStore:
    MAX_RECORDS = 256
    RETENTION_SECONDS = 24 * 60 * 60

    def __init__(self, agent_context: AgentContext):
        self.agent_context = agent_context
        self.topic_id = str(agent_context.get_metadata().get("topic_id") or "")
        if not self.topic_id:
            raise CanvasDomainError("RECOVERY_UNAVAILABLE", "A topic is required to retain file rename outcomes.")
        self.workspace = os.path.abspath(agent_context.get_workspace_dir())
        self.directory = (
            PathManager.get_runtime_dir() / "canvas-renames" / hashlib.sha256(self.topic_id.encode()).hexdigest()
        )

    @classmethod
    def from_tool(cls, context: ToolContext) -> CanvasRenameExecutionStore:
        agent = context.get_extension_typed("agent_context", AgentContext)
        if agent is None:
            raise CanvasDomainError("AGENT_CONTEXT_REQUIRED", "File rename requires the current Agent context.")
        return cls(agent)

    def _path(self, tool_call_id: str) -> Path:
        if not tool_call_id:
            raise CanvasDomainError("RECOVERY_UNAVAILABLE", "Supply recovery_tool_call_id from the rename execution.")
        return self.directory / (hashlib.sha256(tool_call_id.encode()).hexdigest() + ".json")

    async def save(self, record: CanvasRenameExecution) -> None:
        await async_mkdir(self.directory, parents=True, exist_ok=True)
        await async_chmod(self.directory, 0o700)
        path = self._path(record.tool_call_id)
        await async_write_json(path, record.model_dump(), ensure_ascii=False)
        await async_chmod(path, 0o600)

    async def read(self, tool_call_id: str) -> CanvasRenameExecution:
        path = self._path(tool_call_id)
        if not await async_exists(path):
            raise CanvasDomainError(
                "RECOVERY_UNAVAILABLE", "The rename execution is missing or expired. Query the current files first."
            )
        record = CanvasRenameExecution.model_validate(await async_read_json(path))
        if record.tool_call_id != tool_call_id or record.topic_id != self.topic_id or record.workspace != self.workspace:
            raise CanvasDomainError("RECOVERY_UNAVAILABLE", "The rename execution belongs to another call or workspace.")
        return record

    async def create(self, tool_call_id: str, payload: JsonObject) -> CanvasRenameExecution:
        # 仅 execute 创建结果记录；prepare 不落盘，也不生成授权凭据。
        await async_mkdir(self.directory, parents=True, exist_ok=True)
        entries = await async_scandir(self.directory)
        remaining = 0
        for entry in entries:
            if not entry.name.endswith(".json"):
                continue
            record = CanvasRenameExecution.model_validate(await async_read_json(entry.path))
            if time.time() - record.created_at > self.RETENTION_SECONDS:
                await async_unlink(entry.path)
            else:
                remaining += 1
        if remaining >= self.MAX_RECORDS or await async_exists(self._path(tool_call_id)):
            raise CanvasDomainError(
                "RECOVERY_UNAVAILABLE",
                "Rename outcomes cannot be retained, or this call already has an execution record. Query existing outcomes before a new file write.",
            )
        record = CanvasRenameExecution(
            tool_call_id=tool_call_id, topic_id=self.topic_id, workspace=self.workspace, payload=payload
        )
        await self.save(record)
        return record

    async def discard(self, record: CanvasRenameExecution) -> None:
        # 执行完成后清理；失败残留由下一次实际改名按保留期限淘汰。
        try:
            await async_unlink(self._path(record.tool_call_id))
        except OSError:
            get_logger(__name__).warning("Canvas rename execution cleanup failed", exc_info=True)
