import json
import uuid
from typing import Optional, Protocol

from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult

from app.api.http_dto.response import BaseResponse
from app.core.context.agent_context import AgentContext
from app.core.entity.message.client_message import ChatClientMessage, ContextType
from app.tools.ask_user import AskUserTool, PendingQuestion, _humanize_batch
from app.tools.core.tool_call_event_manager import ToolCallEventManager

logger = get_logger(__name__)


async def _emit_ask_user_after_tool_call(
    pending: PendingQuestion,
    *,
    content: str,
    extra_info: dict,
) -> None:
    """发送 AFTER_TOOL_CALL 消息，更新问题卡片状态（answered / skipped / timeout）"""
    tool_name = AskUserTool._tool_name
    arguments = pending.params.model_dump()
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


class _ChatResumePort(Protocol):
    """MessageProcessor 上用于 ask_user 恢复后重启对话的最小依赖面。"""

    def _load_last_chat_message(self) -> Optional[ChatClientMessage]:
        ...

    async def handle_chat(self, message: ChatClientMessage) -> BaseResponse:
        ...


class AskUserService:
    """ask_user 相关收口：新消息取消待答、用户答复/超时后恢复 Agent。"""

    CANCELLED_RESPONSE_STATUS = "cancelled"
    CANCELLED_TOOL_RESULT_CONTENT = "The user cancelled the tool call."

    async def cancel_pending_ask_user_for_new_message(self, agent_context: AgentContext) -> None:
        """Close the current ask_user as cancelled before processing a new user message."""
        question_id = agent_context.get_ask_user_pending_id()
        if not question_id:
            return

        pending = AskUserTool._pending_questions.pop(question_id, None)
        if not pending:
            # answered / timeout may have already consumed the in-memory pending entry.
            # We still clear residual waiting markers so the next normal message can continue.
            agent_context.clear_ask_user_pending()
            await AskUserTool._delete_pending_file()
            logger.warning(
                f"检测到 ask_user_pending_id={question_id}，但内存中未找到待处理问题，"
                "已执行最小残留清理后继续按普通消息处理"
            )
            return

        pending.timeout_task.cancel()
        pending.agent_context.clear_ask_user_pending()

        chat_history = getattr(pending.agent_context, "chat_history", None)
        if chat_history is None:
            raise RuntimeError("ask_user pending 存在，但 chat_history 未初始化，无法执行 cancelled 收口")

        await chat_history.append_tool_message(
            content=self.CANCELLED_TOOL_RESULT_CONTENT,
            tool_call_id=pending.tool_call_id,
        )
        logger.info(f"已追加 ask_user cancelled ToolResult: tool_call_id={pending.tool_call_id}")

        # 与 resume_after_ask_user / 主循环注入点 2 一致：tool 行落库后再注入 horizon，避免缺 hidden context
        try:
            ctx_update = await pending.agent_context.horizon.build_context_update()
            await chat_history.append_user_message(ctx_update, show_in_ui=False, source="horizon")
            logger.debug("[AgentHorizon] ask_user cancelled 收口后已注入 system_injected_context")
        except Exception as _horizon_err:
            logger.warning(f"[AgentHorizon] ask_user cancelled 收口后注入失败: {_horizon_err}")

        await _emit_ask_user_after_tool_call(
            pending,
            content=self.CANCELLED_TOOL_RESULT_CONTENT,
            extra_info={
                "status": self.CANCELLED_RESPONSE_STATUS,
                "answers": {},
                "questions": [q.model_dump() for q in pending.params.questions],
            },
        )

        await AskUserTool._delete_pending_file()
        logger.info(f"ask_user cancelled 收口完成: question_id={question_id}")

    async def resume_after_ask_user(
        self,
        message_processor: _ChatResumePort,
        pending: PendingQuestion,
        response_status: str,
        answer: str,
    ) -> None:
        """ask_user 答复/超时后的核心恢复逻辑：追加 ToolResult → 推送 AFTER → 重启 Agent。

        流程：
        1. 清除暂停标记
        2. 将答复人类语言加工为 ToolResult 内容
        3. 将 ToolResult 追加到 LLM 对话历史（此刻历史上下文完整）
        4. 向前端推送 AFTER_TOOL_CALL，更新问题卡片状态（answered / skipped / timeout）
        5. 删除持久化文件
        6. 以 CONTINUE 上下文调用 handle_chat，启动 Agent
        """
        # 1. 清除暂停标记
        pending.agent_context.clear_ask_user_pending()

        # 2. 人类语言加工：解析 JSON 答案字典，逐子问题生成描述
        try:
            answers: dict = json.loads(answer) if answer else {}
        except (json.JSONDecodeError, TypeError):
            answers = {}
        humanized = _humanize_batch(
            questions=pending.params.questions,
            response_status=response_status,
            answers=answers,
        )
        logger.info(
            f"ask_user 结果加工: response_status={response_status}, humanized={humanized!r}"
        )

        # 3. 追加 ToolResult 到聊天历史
        chat_history = getattr(pending.agent_context, "chat_history", None)

        try:
            await chat_history.append_tool_message(
                content=humanized,
                tool_call_id=pending.tool_call_id,
            )
            logger.info(f"已追加 ask_user ToolResult: tool_call_id={pending.tool_call_id}")
        except Exception as e:
            logger.error(f"追加 ask_user ToolResult 失败: {e}", exc_info=True)
            return

        # 3b. tool 已落库后补注入 horizon（与 agent 主循环注入点 2 一致；ASK_USER 退出时主循环会跳过该注入）
        try:
            ctx_update = await pending.agent_context.horizon.build_context_update()
            await chat_history.append_user_message(ctx_update, show_in_ui=False, source="horizon")
            logger.debug("[AgentHorizon] ask_user 恢复后已注入 system_injected_context")
        except Exception as _horizon_err:
            logger.warning(f"[AgentHorizon] ask_user 恢复后注入失败: {_horizon_err}")

        # 4. 向前端推送 AFTER_TOOL_CALL，更新问题卡片状态（answered / skipped / timeout）
        try:
            await _emit_ask_user_after_tool_call(
                pending,
                content=humanized,
                extra_info={
                    "status": response_status,
                    "answers": answers,
                    "questions": [q.model_dump() for q in pending.params.questions],
                },
            )
        except Exception as e:
            logger.error(f"发送 ask_user AFTER 消息失败: {e}", exc_info=True)

        await AskUserTool._delete_pending_file()

        last_message = message_processor._load_last_chat_message()
        if not last_message:
            logger.error("resume_after_ask_user: 未找到历史聊天消息，无法重启 Agent")
            return

        last_message.prompt = "/resume"
        last_message.context_type = ContextType.CONTINUE
        last_message.message_id = f"ask-user-resume-{uuid.uuid4()}"
        logger.info("resume_after_ask_user: 调用 handle_chat 重启 Agent")
        await message_processor.handle_chat(last_message)
