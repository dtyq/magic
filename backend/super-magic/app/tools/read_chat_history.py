from __future__ import annotations

from datetime import datetime, timezone

from pydantic import Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.context.agent_context import AgentContext
from app.core.entity.message.server_message import ToolDetail
from app.service.chat_history_query_service import (
    ChatHistoryQueryService,
    MessageType,
    format_history_time,
    parse_time_range,
    TimeRange,
)
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.utils.chat_history_display import (
    HistoryDisplayError,
    HistoryMessagePreview,
    HistoryReadDisplay,
    action,
    build_read_detail,
    classify_error,
    error_result_info,
    timezone_name,
    translate,
)


class ReadChatHistoryParams(BaseToolParams):
    history_file: str = Field(..., min_length=1, description="Relative path returned by list_chat_history or search_chat_history.")
    start: int = Field(0, ge=0, description="First original message index, inclusive.")
    end: int = Field(20, ge=0, description="Last original message index, exclusive; maximum range is 50.")
    message_types: list[MessageType] | None = Field(
        None,
        description="Optional message types: user_input, user, assistant, tool, or system. Omit to include all types.",
    )
    time_range: str | None = Field(
        None,
        max_length=120,
        description="A single time string such as 'today', 'last 7 days', 'last 2 hours', 'since <date>', or '<start> to <end>'.",
    )

    @model_validator(mode="after")
    def validate_range(self) -> "ReadChatHistoryParams":
        if self.end < self.start:
            raise ValueError("end must be greater than or equal to start")
        if self.end - self.start > 50:
            raise ValueError("message range must be at most 50 messages")
        return self


# Full model-facing usage guidance: agents/skills/chat-history/SKILL.md
@tool(code_mode_only=True)
class ReadChatHistory(BaseTool[ReadChatHistoryParams]):
    """Read a bounded message range from one saved chat history file."""

    async def execute(self, tool_context: ToolContext, params: ReadChatHistoryParams) -> ToolResult:
        context = tool_context.get_extension_typed("agent_context", AgentContext)
        if context is None or context.is_subagent_context():
            return ToolResult.error(
                "Chat history lookup is available only to the main Agent.",
                extra_info=error_result_info(HistoryDisplayError.UNAVAILABLE),
                use_custom_remark=True,
            )

        time_range = None
        try:
            time_range = parse_time_range(params.time_range, context.get_user_timezone())
            service = _build_service(context)
            result = await service.read_range(
                history_file=params.history_file,
                start=params.start,
                end=params.end,
                message_types=params.message_types,
                time_range=time_range,
            )
        except Exception as exc:
            return ToolResult.error(
                f"Chat history read failed: {exc}",
                extra_info=error_result_info(classify_error(exc)),
                use_custom_remark=True,
            )

        lines = [
            f"History root (read-only): {result['history_root']}",
            f"Read {len(result['messages'])} matching messages from {params.history_file} "
            f"in message range [{params.start}, {params.end})."
        ]
        remaining_chars = 12_000
        previews: list[HistoryMessagePreview] = []
        output_truncated = False
        for message in result["messages"]:
            content = str(message.get("content") or "")
            timestamp = format_history_time(
                _timestamp_to_datetime(message.get("timestamp")),
                context.get_user_timezone(),
            )
            header = f"[{message['message_index']}] {message['message_type']} | {timestamp}: "
            available = max(remaining_chars - len(header), 0)
            if available == 0:
                lines.append("Output limit reached. Read a smaller or later range to continue.")
                output_truncated = True
                break
            excerpt = content[:available]
            lines.append(header + excerpt)
            remaining_chars -= len(header) + len(excerpt)
            message_truncated = len(excerpt) < len(content)
            previews.append(
                HistoryMessagePreview(
                    message_index=int(message["message_index"]),
                    message_type=MessageType(str(message["message_type"])),
                    timestamp=message.get("timestamp") if isinstance(message.get("timestamp"), (int, float)) else None,
                    content=excerpt,
                    truncated=message_truncated,
                )
            )
            if message_truncated:
                lines.append("Message truncated. Read a smaller range around this message to continue.")
                output_truncated = True
                break
        tool_result = ToolResult(content="\n".join(lines), data=result)
        tool_result.extra_info.update({
            "history_display_time_range": time_range,
            "history_read_display": HistoryReadDisplay(
                matched_count=len(result["messages"]),
                messages=tuple(previews),
                output_truncated=output_truncated,
            ),
        })
        return tool_result

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, object]:
        start = (arguments or {}).get("start", 0)
        end = (arguments or {}).get("end", 20)
        end_index = max(start, end - 1) if isinstance(start, int) and isinstance(end, int) and end > start else start
        remark = translate("read.before", start=start, end=end_index)
        return {"tool_name": tool_name, "action": action(tool_name), "remark": remark}

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        context = tool_context.get_extension_typed("agent_context", AgentContext)
        time_range = result.extra_info.get("history_display_time_range")
        return build_read_detail(
            result,
            timezone_name(context),
            time_range if isinstance(time_range, TimeRange) else None,
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, object]:
        if not result.ok:
            remark = translate("read.failed")
        else:
            read_display = result.extra_info.get("history_read_display")
            if isinstance(read_display, HistoryReadDisplay):
                start = result.data.get("start", 0)
                end = result.data.get("end", start)
                remark = translate(
                    "read.after",
                    start=start,
                    end=max(start, end - 1) if end > start else start,
                    returned=len(read_display.messages),
                )
                if read_display.output_truncated:
                    remark += " " + translate("read.output_truncated")
            else:
                remark = translate("read.detail_unavailable")
        return {"tool_name": tool_name, "action": action(tool_name), "remark": remark}


def _build_service(context: AgentContext) -> ChatHistoryQueryService:
    return ChatHistoryQueryService(
        context.agent_name,
        context.get_agent_id() or "main",
        chat_history=getattr(context, "chat_history", None),
        interruption_event=context.get_interruption_event(),
    )


def _timestamp_to_datetime(value: object) -> datetime | None:
    if not isinstance(value, (int, float)):
        return None
    return datetime.fromtimestamp(value, timezone.utc)


__all__ = ["ReadChatHistory", "ReadChatHistoryParams"]
