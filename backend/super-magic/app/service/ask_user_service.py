"""ask_user 服务：管理 pending 问题状态、超时定时器、持久化、取消与恢复。

AskUserService 是 ask_user 功能的唯一状态持有者，以独立单例运行。
AskUserTool 只负责 execute()，所有生命周期管理都通过本服务完成。
"""

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Union

from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult

from app.core.context.agent_context import AgentContext
from app.tools.core.tool_call_event_manager import ToolCallEventManager
from app.utils.async_file_utils import (
    async_exists,
    async_read_json,
    async_unlink,
    async_write_json,
)

logger = get_logger(__name__)

# Python 侧内部超时（秒），与 PHP 侧 Redis TTL=3600s 配合
INTERNAL_TIMEOUT = 600


@dataclass
class PendingQuestion:
    """记录一个等待用户回答的问题批次的相关上下文"""
    question_id: str
    tool_call_id: str
    agent_context: AgentContext
    timeout_task: asyncio.Task
    expires_at: int = 0
    agent_name: str = ""
    agent_id: str = ""
    # 原始参数，用于 AFTER_TOOL_CALL 事件
    raw_params: dict = field(default_factory=dict)
    # 解析后的结构化问题列表（给前端 / AFTER 事件 / humanize 用）
    parsed_questions: List[dict] = field(default_factory=list)


class AskUserService:
    """ask_user 相关收口：新消息取消待答、用户答复/超时后恢复 Agent。"""

    CANCELLED_RESPONSE_STATUS = "cancelled"
    CANCELLED_TOOL_RESULT_CONTENT = "The user cancelled the tool call."

    _instance: Optional["AskUserService"] = None

    @classmethod
    def get_instance(cls) -> "AskUserService":
        if cls._instance is None:
            cls._instance = AskUserService()
        return cls._instance

    def __init__(self):
        if self.__class__._instance is not None:
            return
        self._pending_questions: Dict[str, PendingQuestion] = {}

    # ─── 公共 API ─────────────────────────────────────────────────────────────

    def get_pending(self, question_id: str) -> Optional[PendingQuestion]:
        return self._pending_questions.get(question_id)

    def pop_pending(self, question_id: str) -> Optional[PendingQuestion]:
        return self._pending_questions.pop(question_id, None)

    # ─── 注册 pending（由 AskUserTool.execute 调用）─────────────────────────

    async def create_and_register_pending(
        self,
        *,
        question_id: str,
        tool_call_id: str,
        agent_context: AgentContext,
        expires_at: int,
        agent_name: str,
        agent_id: str,
        raw_params: dict,
        parsed_questions: List[dict],
    ) -> PendingQuestion:
        """创建 PendingQuestion、启动超时定时器、注册到内存、持久化到文件。"""

        timeout_task = asyncio.create_task(
            self._timeout_watcher(question_id, expires_at, agent_context),
            name=f"ask_user_timeout_{question_id}",
        )

        pending = PendingQuestion(
            question_id=question_id,
            tool_call_id=tool_call_id,
            agent_context=agent_context,
            timeout_task=timeout_task,
            expires_at=expires_at,
            agent_name=agent_name,
            agent_id=agent_id,
            raw_params=raw_params,
            parsed_questions=parsed_questions,
        )
        self._pending_questions[question_id] = pending

        # 在 agent_context 上设置暂停标记
        agent_context.set_ask_user_pending(question_id)

        # 注册 run cleanup：stop_run 时自动清理此 pending
        agent_context.register_run_cleanup(
            f"ask_user_{question_id}",
            lambda: self._cleanup_pending(question_id),
        )

        # 持久化
        await self._save_pending_to_file(pending)

        return pending

    # ─── 新消息取消 ──────────────────────────────────────────────────────────

    async def cancel_pending_ask_user_for_new_message(self, agent_context: AgentContext) -> None:
        """Close the current ask_user as cancelled before processing a new user message."""
        question_id = agent_context.get_ask_user_pending_id()
        if not question_id:
            return

        pending = self._pending_questions.pop(question_id, None)
        if not pending:
            # 已被回答/超时消费，只做残留清理
            agent_context.clear_ask_user_pending()
            await self._delete_pending_file(agent_context)
            logger.warning(
                f"ask_user_pending_id={question_id} found in context but not in memory, "
                "residual markers cleaned"
            )
            return

        pending.timeout_task.cancel()
        pending.agent_context.clear_ask_user_pending()

        chat_history = getattr(pending.agent_context, "chat_history", None)
        if chat_history is None:
            logger.error("ask_user pending exists but chat_history is None, cannot write cancelled ToolResult")
            return

        await chat_history.append_tool_message(
            content=self.CANCELLED_TOOL_RESULT_CONTENT,
            tool_call_id=pending.tool_call_id,
        )
        logger.info(f"Appended ask_user cancelled ToolResult: tool_call_id={pending.tool_call_id}")

        # 注入 horizon（与主循环注入点一致）
        try:
            ctx_update = await pending.agent_context.horizon.build_context_update()
            await chat_history.append_user_message(ctx_update, show_in_ui=False, source="horizon")
        except Exception as e:
            logger.warning(f"[AgentHorizon] horizon injection after ask_user cancel failed: {e}")

        await self._emit_after_tool_call(
            pending,
            content=self.CANCELLED_TOOL_RESULT_CONTENT,
            extra_info={
                "status": self.CANCELLED_RESPONSE_STATUS,
                "answers": {},
                "questions": pending.parsed_questions,
            },
        )

        await self._delete_pending_file(pending.agent_context)
        logger.info(f"ask_user cancelled: question_id={question_id}")

    # ─── 用户回答 / 超时后恢复 ──────────────────────────────────────────────

    async def resume_after_ask_user(
        self,
        pending: PendingQuestion,
        response_status: str,
        answer: str,
    ) -> None:
        """ask_user 答复/超时后的核心恢复逻辑：追加 ToolResult → 推送 AFTER → 重启 Agent。

        1. 清除暂停标记
        2. 人类语言加工答案
        3. 追加 ToolResult 到对话历史
        4. 向前端推送 AFTER_TOOL_CALL
        5. 删除持久化文件
        6. 调用 dispatcher.resume_agent() 重启 Agent
        """
        # 1. 清除暂停标记
        pending.agent_context.clear_ask_user_pending()

        # 2. 人类语言加工
        try:
            answers: dict = json.loads(answer) if answer else {}
        except (json.JSONDecodeError, TypeError):
            answers = {}
        humanized = _humanize_batch(
            questions=pending.parsed_questions,
            response_status=response_status,
            answers=answers,
        )
        logger.info(f"ask_user result: response_status={response_status}, humanized={humanized!r}")

        # 3. 追加 ToolResult 到聊天历史
        chat_history = getattr(pending.agent_context, "chat_history", None)
        if chat_history is None:
            logger.error("ask_user pending exists but chat_history is None, cannot resume")
            return

        try:
            await chat_history.append_tool_message(
                content=humanized,
                tool_call_id=pending.tool_call_id,
            )
            logger.info(f"Appended ask_user ToolResult: tool_call_id={pending.tool_call_id}")
        except Exception as e:
            logger.error(f"Failed to append ask_user ToolResult: {e}", exc_info=True)
            return

        # 3b. 注入 horizon
        try:
            ctx_update = await pending.agent_context.horizon.build_context_update()
            await chat_history.append_user_message(ctx_update, show_in_ui=False, source="horizon")
        except Exception as e:
            logger.warning(f"[AgentHorizon] horizon injection after ask_user resume failed: {e}")

        # 4. 向前端推送 AFTER_TOOL_CALL
        try:
            await self._emit_after_tool_call(
                pending,
                content=humanized,
                extra_info={
                    "status": response_status,
                    "answers": answers,
                    "questions": pending.parsed_questions,
                },
            )
        except Exception as e:
            logger.error(f"Failed to send ask_user AFTER event: {e}", exc_info=True)

        # 5. 删除持久化文件
        await self._delete_pending_file(pending.agent_context)

        # 6. 重启 Agent（从 last_dispatch_message 快照构建 CONTINUE 消息）
        await self._resume_agent()

    # ─── 后台超时定时器 ──────────────────────────────────────────────────────

    async def _timeout_watcher(
        self,
        question_id: str,
        expires_at: int,
        agent_context: AgentContext,
    ) -> None:
        """Sleep until expires_at; if not cancelled, trigger timeout flow."""
        try:
            while True:
                now = int(time.time())
                remaining = expires_at - now
                if remaining <= 0:
                    break
                await asyncio.sleep(min(60, remaining))
                agent_context.update_activity_time()
        except asyncio.CancelledError:
            return

        pending = self._pending_questions.pop(question_id, None)
        if not pending:
            return

        logger.info(f"ask_user timeout: question_id={question_id}")

        # 构建超时答案
        timeout_answers = {}
        for q in pending.parsed_questions:
            sub_id = q.get("sub_id", "")
            default = q.get("default_value") or q.get("default", "")
            timeout_answers[sub_id] = default
        timeout_answer = json.dumps(timeout_answers, ensure_ascii=False)

        asyncio.create_task(
            self.resume_after_ask_user(
                pending=pending,
                response_status="timeout",
                answer=timeout_answer,
            ),
            name=f"ask_user_timeout_resume_{question_id}",
        )

    # ─── cleanup（stop_run 时调用）────────────────────────────────────────

    async def _cleanup_pending(self, question_id: str) -> None:
        """stop_run 触发时的清理：取消定时器、移除 pending、删持久化文件。"""
        pending = self._pending_questions.pop(question_id, None)
        if not pending:
            return
        pending.timeout_task.cancel()
        pending.agent_context.clear_ask_user_pending()
        await self._delete_pending_file(pending.agent_context)
        logger.info(f"ask_user cleanup on stop_run: question_id={question_id}")

    # ─── 持久化 ──────────────────────────────────────────────────────────────

    async def _save_pending_to_file(self, pending: PendingQuestion) -> None:
        """将待处理问题持久化到 .chat_history/{agent_name}<{agent_id}>.ask_user.json"""
        from app.path_manager import PathManager

        data = {
            "question_id": pending.question_id,
            "tool_call_id": pending.tool_call_id,
            "expires_at": pending.expires_at,
            "agent_name": pending.agent_name,
            "agent_id": pending.agent_id,
            "raw_params": pending.raw_params,
            "parsed_questions": pending.parsed_questions,
        }
        try:
            pending_file = PathManager.get_ask_user_pending_file(pending.agent_name, pending.agent_id)
            await async_write_json(pending_file, data, ensure_ascii=False)
            logger.info(
                f"Persisted ask_user pending: question_id={pending.question_id}, "
                f"file={pending_file.name}"
            )
        except Exception as e:
            logger.error(f"Failed to persist ask_user pending: {e}", exc_info=True)

    async def _delete_pending_file(self, agent_context: AgentContext) -> None:
        """删除持久化文件"""
        from app.path_manager import PathManager

        chat_history = getattr(agent_context, "chat_history", None)
        agent_name = chat_history.agent_name if chat_history else "magic"
        agent_id = chat_history.agent_id if chat_history else "main"

        try:
            pending_file = PathManager.get_ask_user_pending_file(agent_name, agent_id)
            if await async_exists(pending_file):
                await async_unlink(pending_file)
                logger.info(f"Deleted ask_user pending file: {pending_file.name}")
        except Exception as e:
            logger.error(f"Failed to delete ask_user pending file: {e}", exc_info=True)

    # ─── 崩溃恢复 ────────────────────────────────────────────────────────────

    async def restore_pending_from_disk(self, agent_context: AgentContext) -> None:
        """服务重启后，从持久化文件恢复超时定时器。

        扫描所有 *.ask_user.json 文件，逐个恢复。
        """
        from app.path_manager import PathManager
        from app.utils.async_file_utils import async_scandir

        chat_history_dir = PathManager.get_chat_history_dir()
        try:
            entries = await async_scandir(chat_history_dir)
        except Exception:
            return

        for entry in entries:
            if not entry.name.endswith(".ask_user.json"):
                continue

            try:
                data = await async_read_json(entry.path)
            except Exception as e:
                logger.error(f"Failed to read ask_user persistence file {entry.name}: {e}")
                continue

            try:
                question_id = data["question_id"]
                tool_call_id = data["tool_call_id"]
                expires_at = data["expires_at"]
                agent_name = data.get("agent_name", "magic")
                agent_id = data.get("agent_id", "main")
                raw_params = data.get("raw_params", {})
                parsed_questions = data.get("parsed_questions", [])
            except (KeyError, TypeError) as e:
                logger.error(f"Failed to parse ask_user persistence data from {entry.name}: {e}")
                continue

            if question_id in self._pending_questions:
                logger.info(f"ask_user question already in memory, skip restore: question_id={question_id}")
                continue

            timeout_task = asyncio.create_task(
                self._timeout_watcher(question_id, expires_at, agent_context),
                name=f"ask_user_timeout_restore_{question_id}",
            )

            pending = PendingQuestion(
                question_id=question_id,
                tool_call_id=tool_call_id,
                agent_context=agent_context,
                timeout_task=timeout_task,
                expires_at=expires_at,
                agent_name=agent_name,
                agent_id=agent_id,
                raw_params=raw_params,
                parsed_questions=parsed_questions,
            )
            self._pending_questions[question_id] = pending
            agent_context.set_ask_user_pending(question_id)

            remaining = expires_at - int(time.time())
            logger.info(
                f"Restored ask_user timer: question_id={question_id}, "
                f"questions={len(parsed_questions)}, remaining={max(0, remaining)}s"
            )

    # ─── 恢复 Agent 推理循环 ──────────────────────────────────────────────────

    @staticmethod
    async def _resume_agent() -> None:
        """Restart the Agent inference loop after ask_user answer/timeout.

        ToolResult has already been appended to chat history.
        Constructs a minimal CONTINUE message from the last dispatch snapshot
        and submits it through AgentDispatcher.
        """
        from app.service.agent_dispatcher import AgentDispatcher
        dispatcher = AgentDispatcher.get_instance()

        last = await dispatcher.get_last_dispatch_message() or {}
        if not last:
            logger.error("[AskUserService] _resume_agent: no last_dispatch_message found, cannot resume")
            return

        from app.core.entity.message.client_message import ChatClientMessage, ContextType
        import uuid as _uuid
        message = ChatClientMessage(**last)
        message.prompt = "/resume"
        message.context_type = ContextType.CONTINUE
        message.message_id = f"ask-user-resume-{_uuid.uuid4()}"

        logger.info("[AskUserService] _resume_agent: restarting Agent via submit_message")
        await dispatcher.submit_message(message)

    # ─── AFTER_TOOL_CALL 事件 ────────────────────────────────────────────────

    @staticmethod
    async def _emit_after_tool_call(
        pending: PendingQuestion,
        *,
        content: str,
        extra_info: dict,
    ) -> None:
        """发送 AFTER_TOOL_CALL 消息，更新问题卡片状态"""
        tool_name = "ask_user"
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


# ─── 模块级辅助函数 ──────────────────────────────────────────────────────────


def _humanize_single(
    question: str,
    interaction_type: str,
    answer: Union[str, list],
) -> str:
    """Format a single sub-question answer into natural language (answered status)."""
    if interaction_type == "confirm":
        return f'"{question}": {answer}'
    if interaction_type == "input":
        return f'"{question}": {answer}'
    if interaction_type == "select":
        return f'"{question}": selected "{answer}"'
    if interaction_type == "multi_select":
        return f'"{question}": selected {answer}'
    return f'"{question}": {answer}'


def _humanize_batch(
    questions: List[dict],
    response_status: str,
    answers: dict,
) -> str:
    """Convert multiple sub-question answers into a natural language paragraph
    that the model can directly reason about.

    answers is a {sub_id: answer_str} dict.
    """
    if response_status == "timeout":
        parts = []
        for q in questions:
            name = q.get("question", "")
            dv = q.get("default_value") or q.get("default")
            if dv is not None:
                parts.append(f'"{name}" (timed out, used default: {dv})')
            else:
                parts.append(f'"{name}" (timed out, no default)')
        has_no_default = any(
            (q.get("default_value") or q.get("default")) is None for q in questions
        )
        summary = "; ".join(parts)
        if has_no_default:
            return (
                f"The following questions timed out: {summary}. "
                "Some have no default value — decide whether to abort the related operation."
            )
        return f"The following questions timed out and defaults were applied: {summary}. Continue with the next steps."

    if response_status == "skipped":
        parts = []
        for q in questions:
            name = q.get("question", "")
            dv = q.get("default_value") or q.get("default")
            if dv is not None:
                parts.append(f'"{name}" (used default: {dv})')
            else:
                parts.append(f'"{name}" (no default)')
        has_no_default = any(
            (q.get("default_value") or q.get("default")) is None for q in questions
        )
        summary = "; ".join(parts)
        if has_no_default:
            return (
                f"The user skipped the following questions: {summary}. "
                "Some have no default value — decide whether to abort the related operation."
            )
        return f"The user skipped the following questions and defaults were applied: {summary}. Continue with the next steps."

    # answered
    parts = []
    for q in questions:
        name = q.get("question", "")
        interaction_type = q.get("interaction_type", "input")
        sub_id = q.get("sub_id", "")
        default = [] if interaction_type == "multi_select" else ""
        ans = answers.get(sub_id, default)
        parts.append(_humanize_single(name, interaction_type, ans))
    summary = "; ".join(parts)
    return f"The user answered the following questions: {summary}. Proceed accordingly."
