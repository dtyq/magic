from __future__ import annotations

from datetime import datetime, timezone

from pydantic import Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.context.agent_context import AgentContext
from app.core.entity.message.server_message import ToolDetail
from app.service.chat_history_query_service import (
    ChatHistoryQueryService,
    HistoryType,
    MessageType,
    TimeRange,
    format_history_time,
    parse_time_range,
)
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.utils.chat_history_display import (
    HistoryDisplayError,
    action,
    build_search_detail,
    classify_error,
    error_result_info,
    timezone_name,
    translate,
)


class SearchChatHistoryParams(BaseToolParams):
    history_types: list[HistoryType] | None = Field(
        None,
        description="History groups to search: current, compacted, or subagent.",
    )
    history_files: list[str] | None = Field(
        None,
        max_length=50,
        description="Exact relative history files returned by list_chat_history. Use this instead of history_types when the files are known.",
    )
    time_range: str | None = Field(
        None,
        max_length=120,
        description="A single time string such as 'today', 'last 7 days', 'last 2 hours', 'since <date>', or '<start> to <end>'.",
    )
    message_types: list[MessageType] | None = Field(
        None,
        description="Optional message types: user_input, user, assistant, tool, or system. Omit to include all types.",
    )
    pattern: str | None = Field(
        None,
        min_length=1,
        max_length=200,
        description="Optional ripgrep regular expression. Spaces stay literal; use |, groups, and character ranges when needed.",
    )
    limit: int = Field(20, ge=1, le=50, description="Maximum number of matching messages to return.")

    @model_validator(mode="after")
    def validate_scope(self) -> "SearchChatHistoryParams":
        if bool(self.history_types) == bool(self.history_files):
            raise ValueError("Provide exactly one of history_types or history_files")
        if not self.pattern and not self.message_types and not self.time_range:
            raise ValueError("pattern is optional only when message_types or time_range is provided")
        return self


# Full model-facing usage guidance: agents/skills/chat-history/SKILL.md
@tool(code_mode_only=True)
class SearchChatHistory(BaseTool[SearchChatHistoryParams]):
    """Search selected chat history with a ripgrep pattern and bounded output."""

    async def execute(self, tool_context: ToolContext, params: SearchChatHistoryParams) -> ToolResult:
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
            result = await service.search(
                history_types=params.history_types,
                history_files=params.history_files,
                pattern=params.pattern,
                message_types=params.message_types,
                time_range=time_range,
                limit=params.limit,
            )
        except Exception as exc:
            return ToolResult.error(
                f"Chat history search failed: {exc}",
                extra_info=error_result_info(classify_error(exc)),
                use_custom_remark=True,
            )

        lines = [
            f"History root (read-only): {result['history_root']}",
            f"Searched {result['searched_files']} of {result['candidate_files']} selected history files and found {result['total_matches']} matching messages.",
            f"Time range: {result['history_range']}.",
        ]
        if result["skipped_files"]:
            lines.append(f"Skipped {result['skipped_files']} oversized history files; narrow the history range to search them.")
        if result["truncated"]:
            lines.append("The result limit was reached. Narrow the history range or use a more specific pattern.")
        for item in result["matches"]:
            timestamp = format_history_time(
                _timestamp_to_datetime(item.get("timestamp")),
                context.get_user_timezone(),
            )
            lines.append(
                f"- {item['history_file']} message {item['message_index']} | {timestamp} | "
                f"{item['message_type']}\n  {item['excerpt'] or '(empty message)'}"
            )
        tool_result = ToolResult(content="\n".join(lines), data=result)
        tool_result.extra_info["history_display_time_range"] = time_range
        return tool_result

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, object]:
        pattern = (arguments or {}).get("pattern")
        remark = translate("search.before_pattern", pattern=pattern) if pattern else translate("search.before")
        return {"tool_name": tool_name, "action": action(tool_name), "remark": remark}

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        context = tool_context.get_extension_typed("agent_context", AgentContext)
        time_range = result.extra_info.get("history_display_time_range")
        return build_search_detail(
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
            remark = translate("search.failed")
        else:
            returned = result.data.get("returned_matches", 0)
            remark = translate("search.empty") if returned == 0 else translate("search.after", returned=returned)
            if result.data.get("skipped_files"):
                remark += " " + translate("search.skipped", count=result.data["skipped_files"])
            if result.data.get("truncated"):
                remark += " " + translate("search.truncated")
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


__all__ = ["SearchChatHistory", "SearchChatHistoryParams"]
