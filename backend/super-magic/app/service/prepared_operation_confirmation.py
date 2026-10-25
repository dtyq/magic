"""绑定准备快照的真人确认；Canvas 保留原目录和兼容入口。"""

from __future__ import annotations

import asyncio
import hashlib
import os
import time
from pathlib import Path
from typing import Literal

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from pydantic import BaseModel, ConfigDict, Field
from pydantic import JsonValue as PydanticJsonValue

from app.core.context.agent_context import AgentContext
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_chmod,
    async_exists,
    async_mkdir,
    async_read_json,
    async_scandir,
    async_unlink,
    async_write_json,
)

JsonObject = dict[str, PydanticJsonValue]


class PreparedOperationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class PreparedOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prepared_tool_call_id: str
    topic_id: str
    workspace: str
    operation: Literal["delete", "rename", "skill_publish"]
    payload: dict[str, PydanticJsonValue]
    fingerprint: str
    question: str
    created_at: float = Field(default_factory=time.time)
    state: Literal["prepared", "waiting", "approved", "consumed", "rejected", "executing", "completed"] = "prepared"
    identity: str = ""
    result: dict[str, PydanticJsonValue] | None = None
    confirmation_tool_call_id: str | None = None
    question_id: str | None = None


class PreparedOperationConfirmation:
    error_type = PreparedOperationError
    # 同一准备记录只绑定一次真人提问、消费一次；并发 SDK 调用不能重复执行。
    _locks: dict[str, asyncio.Lock] = {}
    MAX_RECORDS = 256
    RETENTION_SECONDS = 24 * 60 * 60

    def __init__(self, agent_context: AgentContext):
        self.agent_context = agent_context
        self.topic_id = str(agent_context.get_metadata().get("topic_id") or "")
        if not self.topic_id:
            raise self.error_type("CONFIRMATION_UNAVAILABLE", "An interactive topic is required for this operation.")
        self.workspace = os.path.abspath(agent_context.get_workspace_dir())
        self.directory = (
            PathManager.get_runtime_dir() / "canvas-operations" / hashlib.sha256(self.topic_id.encode()).hexdigest()
        )

    @classmethod
    def from_tool(cls, context: ToolContext) -> PreparedOperationConfirmation:
        agent = context.get_extension_typed("agent_context", AgentContext)
        if agent is None or not agent.is_interactive_main_agent_context():
            raise cls.error_type(
                "CONFIRMATION_UNAVAILABLE", "This operation requires the interactive main Agent."
            )
        return cls(agent)

    def _path(self, prepared_id: str) -> Path:
        if not prepared_id:
            raise self.error_type("CONFIRMATION_REQUIRED", "Supply the prepared tool call ID returned by prepare.")
        return self.directory / (hashlib.sha256(prepared_id.encode()).hexdigest() + ".json")

    async def save(self, record: PreparedOperation) -> None:
        await async_mkdir(self.directory, parents=True, exist_ok=True)
        await async_chmod(self.directory, 0o700)
        path = self._path(record.prepared_tool_call_id)
        await async_write_json(path, record.model_dump(), ensure_ascii=False)
        await async_chmod(path, 0o600)

    def _identity(self) -> str:
        auth = self.agent_context.get_user_context_auth()
        if auth is None:
            raise self.error_type("CONFIRMATION_UNAVAILABLE", "Current user identity is unavailable.")
        return hashlib.sha256(f"{auth.organization_code}:{auth.user_id}".encode()).hexdigest()

    async def read(self, prepared_id: str) -> PreparedOperation:
        path = self._path(prepared_id)
        if not await async_exists(path):
            raise self.error_type(
                "CONFIRMATION_REQUIRED", "The prepared operation is missing or expired. Prepare it again."
            )
        record = PreparedOperation.model_validate(await async_read_json(path))
        if record.topic_id != self.topic_id or record.workspace != self.workspace:
            raise self.error_type(
                "CONFIRMATION_MISMATCH", "The prepared operation belongs to another topic or workspace."
            )
        if time.time() - record.created_at > self.RETENTION_SECONDS:
            raise self.error_type("CONFIRMATION_EXPIRED", "Prepare and confirm this operation again.")
        if record.operation == "skill_publish" and record.identity != self._identity():
            raise self.error_type("CONFIRMATION_MISMATCH", "This preparation belongs to another user.")
        return record

    async def prepare(
        self,
        prepared_id: str,
        operation: Literal["delete", "rename", "skill_publish"],
        payload: JsonObject,
        fingerprint: str,
        question: str,
    ) -> PreparedOperation:
        await async_mkdir(self.directory, parents=True, exist_ok=True)
        entries = await async_scandir(self.directory)
        remaining = 0
        for entry in entries:
            if not entry.name.endswith(".json"):
                continue
            raw = PreparedOperation.model_validate(await async_read_json(entry.path))
            if raw.state == "rejected" or (
                raw.state in {"prepared", "waiting", "approved", "consumed", "executing", "completed"} and time.time() - raw.created_at > self.RETENTION_SECONDS
            ):
                await async_unlink(entry.path)
                self._locks.pop(str(Path(entry.path)), None)
            else:
                remaining += 1
        if remaining >= self.MAX_RECORDS or await async_exists(self._path(prepared_id)):
            raise self.error_type(
                "CONFIRMATION_PENDING",
                "An existing preparation must be completed or cancelled before preparing another operation in this tool call.",
            )
        record = PreparedOperation(
            prepared_tool_call_id=prepared_id,
            topic_id=self.topic_id,
            workspace=self.workspace,
            operation=operation,
            payload=payload,
            fingerprint=fingerprint,
            question=question,
            identity=self._identity() if operation == "skill_publish" else "",
        )
        await self.save(record)
        return record

    async def bind(self, prepared_id: str, confirmation_id: str, question_id: str) -> None:
        async with self._locks.setdefault(str(self._path(prepared_id)), asyncio.Lock()):
            record = await self.read(prepared_id)
            if record.state != "prepared":
                raise self.error_type(
                    "CONFIRMATION_PENDING", "This preparation is already bound or consumed. Prepare a new operation."
                )
            record.state, record.confirmation_tool_call_id, record.question_id = "waiting", confirmation_id, question_id
            await self.save(record)

    async def answer(self, prepared_id: str, confirmation_id: str, status: str, answers: dict[str, object], remark: str = "") -> None:
        async with self._locks.setdefault(str(self._path(prepared_id)), asyncio.Lock()):
            record = await self.read(prepared_id)
            if record.state != "waiting" or record.confirmation_tool_call_id != confirmation_id:
                raise self.error_type("CONFIRMATION_MISMATCH", "The human response does not match this preparation.")
            # 绑定提问只有一题：前端可能回传 UUID，也可能按位置回传 q-0。
            # 只兼容这个明确的位置键；展示层按顺序归一化任意旧 ID 的逻辑不能用于授权。
            approved = (
                not remark.strip() and status == "answered" and bool(record.question_id)
                and isinstance(answers, dict) and len(answers) == 1
                and (answers.get(record.question_id) == "是" or answers.get("q-0") == "是")
            )
            record.state = "approved" if approved else "rejected"
            await self.save(record)
            if not approved:
                await self.discard(record)

    async def discard(self, record: PreparedOperation) -> None:
        # 完成／拒绝后不保留无用途快照；清理失败由下次 prepare 的机会式淘汰处理。
        try:
            await async_unlink(self._path(record.prepared_tool_call_id))
            self._locks.pop(str(self._path(record.prepared_tool_call_id)), None)
        except OSError:
            get_logger(__name__).warning("Prepared operation record cleanup failed", exc_info=True)

    async def consume(
        self, prepared_id: str, confirmation_id: str, operation: str, fingerprint: str
    ) -> PreparedOperation:
        async with self._locks.setdefault(str(self._path(prepared_id)), asyncio.Lock()):
            record = await self.read(prepared_id)
            if (
                record.state != "approved"
                or record.confirmation_tool_call_id != confirmation_id
                or record.operation != operation
            ):
                raise self.error_type(
                    "CONFIRMATION_REQUIRED",
                    "A matching, explicit human confirmation is required; skipped, timed-out and consumed confirmations cannot authorize execution.",
                )
            if record.fingerprint != fingerprint:
                raise self.error_type(
                    "CONFIRMATION_STALE",
                    "The affected files, versions or descendants changed. Prepare and confirm the current scope again.",
                )
            record.state = "consumed"
            await self.save(record)
            return record
