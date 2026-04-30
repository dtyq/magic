"""user_tool_call 通用服务：管理前端工具调用的 pending 状态、超时、持久化与恢复。

各工具注册两个回调来封装自身逻辑：
- result_builder(response_status, answer_json) -> (content, extra_info)
- timeout_answer_builder() -> answer_json

崩溃恢复时通过 _RESTORE_FACTORIES[tool_name](tool_data) 重建回调。
"""

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine, Dict, Optional, Tuple

from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult

from app.core.context.agent_context import AgentContext
from app.tools.core.tool_call_event_manager import ToolCallEventManager
from app.utils.async_file_utils import (
    async_exists,
    async_read_json,
    async_scandir,
    async_unlink,
    async_write_json,
)

logger = get_logger(__name__)

# (response_status, answer_json) -> (content, extra_info)
ResultBuilder = Callable[[str, str], Tuple[str, Dict[str, Any]]]
# () -> answer_json（超时时构造默认答案）
TimeoutAnswerBuilder = Callable[[], str]
# (tool_data) -> (result_builder, timeout_answer_builder)
RestoreFactory = Callable[[Dict[str, Any]], Tuple[ResultBuilder, TimeoutAnswerBuilder]]


@dataclass
class PendingToolCall:
    """记录一个等待用户在前端完成的工具调用上下文。"""
    tool_call_id: str
    tool_name: str
    agent_context: AgentContext
    timeout_task: asyncio.Task
    expires_at: int = 0
    agent_name: str = ""
    agent_id: str = ""
    # 原始参数，用于 AFTER_TOOL_CALL 事件
    raw_params: dict = field(default_factory=dict)
    # 工具自定义数据，序列化到磁盘供崩溃恢复时重建回调
    tool_data: dict = field(default_factory=dict)
    # 工具专属回调（不持久化，崩溃恢复时通过 RestoreFactory 重建）
    result_builder: Optional[ResultBuilder] = field(default=None, compare=False, repr=False)
    timeout_answer_builder: Optional[TimeoutAnswerBuilder] = field(default=None, compare=False, repr=False)


class UserToolCallService:
    """user_tool_call 通用生命周期服务。

    工具通过 register_restore_factory 注册崩溃恢复工厂；
    工具在创建 pending 时传入 result_builder / timeout_answer_builder 回调。
    """

    CANCELLED_RESPONSE_STATUS = "cancelled"
    CANCELLED_TOOL_RESULT_CONTENT = "The user cancelled the tool call."

    # 工具名 → 崩溃恢复工厂
    _RESTORE_FACTORIES: Dict[str, RestoreFactory] = {}

    _instance: Optional["UserToolCallService"] = None

    @classmethod
    def get_instance(cls) -> "UserToolCallService":
        if cls._instance is None:
            cls._instance = UserToolCallService()
        return cls._instance

    @classmethod
    def register_restore_factory(cls, tool_name: str, factory: RestoreFactory) -> None:
        """注册工具的崩溃恢复工厂，服务重启后可从 tool_data 重建回调。"""
        cls._RESTORE_FACTORIES[tool_name] = factory

    def __init__(self):
        if self.__class__._instance is not None:
            return
        self._pending: Dict[str, PendingToolCall] = {}

    # ─── 公共 API ─────────────────────────────────────────────────────────────

    def get_pending(self, tool_call_id: str) -> Optional[PendingToolCall]:
        return self._pending.get(tool_call_id)

    def pop_pending(self, tool_call_id: str) -> Optional[PendingToolCall]:
        return self._pending.pop(tool_call_id, None)

    # ─── 注册 pending ─────────────────────────────────────────────────────────

    async def create_and_register_pending(
        self,
        *,
        tool_call_id: str,
        tool_name: str,
        agent_context: AgentContext,
        expires_at: int,
        agent_name: str,
        agent_id: str,
        raw_params: dict,
        tool_data: dict,
        result_builder: ResultBuilder,
        timeout_answer_builder: TimeoutAnswerBuilder,
    ) -> PendingToolCall:
        """创建 PendingToolCall、启动超时定时器、注册到内存、持久化到文件。"""
        timeout_task = asyncio.create_task(
            self._timeout_watcher(tool_call_id, expires_at, agent_context),
            name=f"user_tool_call_timeout_{tool_call_id}",
        )

        pending = PendingToolCall(
            tool_call_id=tool_call_id,
            tool_name=tool_name,
            agent_context=agent_context,
            timeout_task=timeout_task,
            expires_at=expires_at,
            agent_name=agent_name,
            agent_id=agent_id,
            raw_params=raw_params,
            tool_data=tool_data,
            result_builder=result_builder,
            timeout_answer_builder=timeout_answer_builder,
        )
        self._pending[tool_call_id] = pending

        agent_context.set_user_tool_call_pending(tool_call_id)

        agent_context.register_run_cleanup(
            f"user_tool_call_{tool_call_id}",
            lambda: self._cleanup_pending(tool_call_id),
        )

        await self._save_pending_to_file(pending)
        return pending

    # ─── 新消息取消 ───────────────────────────────────────────────────────────

    async def cancel_pending_for_new_message(self, agent_context: AgentContext) -> None:
        """新用户消息到来时，将当前 pending 的工具调用标记为 cancelled。"""
        tool_call_id = agent_context.get_user_tool_call_pending_id()
        if not tool_call_id:
            return

        pending = self._pending.pop(tool_call_id, None)
        if not pending:
            agent_context.clear_user_tool_call_pending()
            await self._delete_pending_file(agent_context)
            logger.warning(
                f"user_tool_call pending_id={tool_call_id} found in context but not in memory, "
                "residual markers cleaned"
            )
            return

        pending.timeout_task.cancel()
        pending.agent_context.clear_user_tool_call_pending()

        chat_history = getattr(pending.agent_context, "chat_history", None)
        if chat_history is None:
            logger.error("user_tool_call pending exists but chat_history is None, cannot write cancelled ToolResult")
            return

        await chat_history.append_tool_message(
            content=self.CANCELLED_TOOL_RESULT_CONTENT,
            tool_call_id=pending.tool_call_id,
        )
        logger.info(f"Appended user_tool_call cancelled ToolResult: tool_call_id={pending.tool_call_id}")

        try:
            ctx_update = await pending.agent_context.horizon.build_context_update(
                injection_point="after_user_tool_call_cancel"
            )
            if ctx_update:
                await chat_history.append_user_message(ctx_update, show_in_ui=False, source="horizon")
        except Exception as e:
            logger.warning(f"[AgentHorizon] horizon injection after user_tool_call cancel failed: {e}")

        await self._emit_after_tool_call(
            pending,
            content=self.CANCELLED_TOOL_RESULT_CONTENT,
            extra_info={"status": self.CANCELLED_RESPONSE_STATUS},
        )

        await self._delete_pending_file(pending.agent_context)
        logger.info(f"user_tool_call cancelled: tool_call_id={tool_call_id}")

    # ─── 用户回答 / 超时后恢复 ────────────────────────────────────────────────

    async def resume_after_user_tool_call(
        self,
        pending: PendingToolCall,
        response_status: str,
        answer: str,
    ) -> None:
        """工具调用完成（answered / skipped / timeout）后的核心恢复流程。

        1. 清除暂停标记
        2. 调用工具专属 result_builder 得到 (content, extra_info)
        3. 追加 ToolResult 到对话历史
        4. 注入 horizon
        5. 向前端推送 AFTER_TOOL_CALL
        6. 删除持久化文件
        7. 重启 Agent 推理循环
        """
        pending.agent_context.clear_user_tool_call_pending()

        if pending.result_builder is None:
            logger.error(f"user_tool_call result_builder is None: tool_call_id={pending.tool_call_id}")
            return

        try:
            content, extra_info = pending.result_builder(response_status, answer)
        except Exception as e:
            logger.error(f"user_tool_call result_builder failed: {e}", exc_info=True)
            content, extra_info = str(e), {"status": "error"}

        logger.info(f"user_tool_call result: response_status={response_status}, content={content!r}")

        chat_history = getattr(pending.agent_context, "chat_history", None)
        if chat_history is None:
            logger.error("user_tool_call pending exists but chat_history is None, cannot resume")
            return

        try:
            await chat_history.append_tool_message(
                content=content,
                tool_call_id=pending.tool_call_id,
            )
            logger.info(f"Appended user_tool_call ToolResult: tool_call_id={pending.tool_call_id}")
        except Exception as e:
            logger.error(f"Failed to append user_tool_call ToolResult: {e}", exc_info=True)
            return

        try:
            ctx_update = await pending.agent_context.horizon.build_context_update(
                injection_point="after_user_tool_call_resume"
            )
            if ctx_update:
                await chat_history.append_user_message(ctx_update, show_in_ui=False, source="horizon")
        except Exception as e:
            logger.warning(f"[AgentHorizon] horizon injection after user_tool_call resume failed: {e}")

        try:
            await self._emit_after_tool_call(pending, content=content, extra_info=extra_info)
        except Exception as e:
            logger.error(f"Failed to send user_tool_call AFTER event: {e}", exc_info=True)

        await self._delete_pending_file(pending.agent_context)
        await self._resume_agent()

    # ─── 后台超时定时器 ───────────────────────────────────────────────────────

    async def _timeout_watcher(
        self,
        tool_call_id: str,
        expires_at: int,
        agent_context: AgentContext,
    ) -> None:
        """Sleep until expires_at; if not cancelled, trigger timeout flow."""
        try:
            while True:
                remaining = expires_at - int(time.time())
                if remaining <= 0:
                    break
                await asyncio.sleep(min(60, remaining))
                agent_context.update_activity_time()
        except asyncio.CancelledError:
            return

        pending = self._pending.pop(tool_call_id, None)
        if not pending:
            return

        logger.info(f"user_tool_call timeout: tool_call_id={tool_call_id}")

        if pending.timeout_answer_builder is None:
            timeout_answer = ""
        else:
            try:
                timeout_answer = pending.timeout_answer_builder()
            except Exception as e:
                logger.error(f"user_tool_call timeout_answer_builder failed: {e}", exc_info=True)
                timeout_answer = ""

        asyncio.create_task(
            self.resume_after_user_tool_call(
                pending=pending,
                response_status="timeout",
                answer=timeout_answer,
            ),
            name=f"user_tool_call_timeout_resume_{tool_call_id}",
        )

    # ─── cleanup（stop_run 时调用）────────────────────────────────────────────

    async def _cleanup_pending(self, tool_call_id: str) -> None:
        pending = self._pending.pop(tool_call_id, None)
        if not pending:
            return
        pending.timeout_task.cancel()
        pending.agent_context.clear_user_tool_call_pending()
        await self._delete_pending_file(pending.agent_context)
        logger.info(f"user_tool_call cleanup on stop_run: tool_call_id={tool_call_id}")

    # ─── 持久化 ───────────────────────────────────────────────────────────────

    async def _save_pending_to_file(self, pending: PendingToolCall) -> None:
        from app.path_manager import PathManager
        data = {
            "tool_call_id": pending.tool_call_id,
            "tool_name": pending.tool_name,
            "expires_at": pending.expires_at,
            "agent_name": pending.agent_name,
            "agent_id": pending.agent_id,
            "raw_params": pending.raw_params,
            "tool_data": pending.tool_data,
        }
        try:
            pending_file = PathManager.get_user_tool_call_pending_file(pending.agent_name, pending.agent_id)
            await async_write_json(pending_file, data, ensure_ascii=False)
            logger.info(
                f"Persisted user_tool_call pending: tool_call_id={pending.tool_call_id}, "
                f"file={pending_file.name}"
            )
        except Exception as e:
            logger.error(f"Failed to persist user_tool_call pending: {e}", exc_info=True)

    async def _delete_pending_file(self, agent_context: AgentContext) -> None:
        from app.path_manager import PathManager
        chat_history = getattr(agent_context, "chat_history", None)
        agent_name = chat_history.agent_name if chat_history else "magic"
        agent_id = chat_history.agent_id if chat_history else "main"
        try:
            pending_file = PathManager.get_user_tool_call_pending_file(agent_name, agent_id)
            if await async_exists(pending_file):
                await async_unlink(pending_file)
                logger.info(f"Deleted user_tool_call pending file: {pending_file.name}")
        except Exception as e:
            logger.error(f"Failed to delete user_tool_call pending file: {e}", exc_info=True)

    # ─── 崩溃恢复 ────────────────────────────────────────────────────────────

    async def restore_pending_from_disk(self, agent_context: AgentContext) -> None:
        """服务重启后，从持久化文件恢复超时定时器。"""
        from app.path_manager import PathManager

        chat_history_dir = PathManager.get_chat_history_dir()
        try:
            entries = await async_scandir(chat_history_dir)
        except Exception:
            return

        for entry in entries:
            if not entry.name.endswith(".user_tool_call.json"):
                continue
            try:
                data = await async_read_json(entry.path)
            except Exception as e:
                logger.error(f"Failed to read user_tool_call persistence file {entry.name}: {e}")
                continue

            try:
                tool_call_id = data["tool_call_id"]
                tool_name = data["tool_name"]
                expires_at = data["expires_at"]
                agent_name = data.get("agent_name", "magic")
                agent_id = data.get("agent_id", "main")
                raw_params = data.get("raw_params", {})
                tool_data = data.get("tool_data", {})
            except (KeyError, TypeError) as e:
                logger.error(f"Failed to parse user_tool_call persistence data from {entry.name}: {e}")
                continue

            if tool_call_id in self._pending:
                logger.info(f"user_tool_call already in memory, skip restore: tool_call_id={tool_call_id}")
                continue

            factory = self._RESTORE_FACTORIES.get(tool_name)
            if factory is None:
                logger.warning(f"No restore factory for tool_name={tool_name!r}, skip: tool_call_id={tool_call_id}")
                continue

            try:
                result_builder, timeout_answer_builder = factory(tool_data)
            except Exception as e:
                logger.error(f"Restore factory failed for tool_name={tool_name!r}: {e}", exc_info=True)
                continue

            timeout_task = asyncio.create_task(
                self._timeout_watcher(tool_call_id, expires_at, agent_context),
                name=f"user_tool_call_timeout_restore_{tool_call_id}",
            )

            pending = PendingToolCall(
                tool_call_id=tool_call_id,
                tool_name=tool_name,
                agent_context=agent_context,
                timeout_task=timeout_task,
                expires_at=expires_at,
                agent_name=agent_name,
                agent_id=agent_id,
                raw_params=raw_params,
                tool_data=tool_data,
                result_builder=result_builder,
                timeout_answer_builder=timeout_answer_builder,
            )
            self._pending[tool_call_id] = pending
            agent_context.set_user_tool_call_pending(tool_call_id)

            remaining = expires_at - int(time.time())
            logger.info(
                f"Restored user_tool_call timer: tool_call_id={tool_call_id}, "
                f"tool_name={tool_name}, remaining={max(0, remaining)}s"
            )

    # ─── 恢复 Agent 推理循环 ──────────────────────────────────────────────────

    @staticmethod
    async def _resume_agent() -> None:
        """Restart the Agent inference loop after user_tool_call completes."""
        from app.service.agent_dispatcher import AgentDispatcher
        dispatcher = AgentDispatcher.get_instance()

        last = await dispatcher.get_last_dispatch_message() or {}
        if not last:
            logger.error("[UserToolCallService] _resume_agent: no last_dispatch_message found, cannot resume")
            return

        from app.core.entity.message.client_message import ChatClientMessage, ContextType
        import uuid as _uuid
        message = ChatClientMessage(**last)
        message.prompt = "/resume"
        message.context_type = ContextType.CONTINUE
        message.message_id = f"user-tool-call-resume-{_uuid.uuid4()}"

        logger.info("[UserToolCallService] _resume_agent: restarting Agent via submit_message")
        await dispatcher.submit_message(message)

    # ─── AFTER_TOOL_CALL 事件 ─────────────────────────────────────────────────

    @staticmethod
    async def _emit_after_tool_call(
        pending: PendingToolCall,
        *,
        content: str,
        extra_info: dict,
    ) -> None:
        tool_name = pending.tool_name
        arguments = pending.raw_params
        tool_call = ToolCallEventManager.create_openai_tool_call(
            tool_call_id=pending.tool_call_id,
            tool_type="function",
            tool_name=tool_name,
            arguments=json.dumps(arguments),
        )
        tool_context = ToolCallEventManager.create_tool_context(
            agent_context=pending.agent_context,
            tool_call_id=pending.tool_call_id,
            tool_name=tool_name,
            arguments=arguments,
        )
        after_result = ToolResult(
            content=content,
            tool_call_id=pending.tool_call_id,
            extra_info=extra_info,
        )
        await ToolCallEventManager.trigger_after_tool_call(
            agent_context=pending.agent_context,
            tool_call=tool_call,
            tool_context=tool_context,
            tool_name=tool_name,
            arguments=arguments,
            result=after_result,
            execution_time=0.0,
            correlation_id=pending.tool_call_id,
        )
