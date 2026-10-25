from __future__ import annotations

from datetime import datetime, timezone

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.context.agent_context import AgentContext
from app.core.entity.message.server_message import ToolDetail
from app.service.chat_history_query_service import (
    ChatHistoryQueryService,
    HistoryType,
    format_history_time,
    parse_time_range,
)
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.subagent_runtime_models import SubagentStatus
from app.tools.utils.chat_history_display import (
    HistoryDisplayError,
    action,
    build_list_detail,
    classify_error,
    error_result_info,
    timezone_name,
    translate,
)


class ListChatHistoryParams(BaseToolParams):
    history_types: list[HistoryType] | None = Field(
        None,
        description="History groups to inspect: current, compacted, or subagent. Omit to get a small inventory of all groups.",
    )
    time_range: str | None = Field(
        None,
        max_length=120,
        description="A single time string such as 'today', 'last 7 days', 'last 2 hours', 'since <date>', or '<start> to <end>'.",
    )
    statuses: list[SubagentStatus] | None = Field(
        None,
        description="Optional subagent statuses to keep: idle, pending, running, interrupted, done, or error.",
    )
    parent_agent_ids: list[str] | None = Field(
        None,
        description="Optional direct parent Agent IDs used to narrow subagent histories.",
    )
    pattern: str | None = Field(
        None,
        max_length=200,
        description="Optional ripgrep regular expression matched against subagent metadata, not chat content.",
    )
    limit: int = Field(20, ge=1, le=50, description="Maximum number of history entries to return.")


# Full model-facing usage guidance: agents/skills/chat-history/SKILL.md
@tool(code_mode_only=True)
class ListChatHistory(BaseTool[ListChatHistoryParams]):
    """List governed chat history files and discover subagent records."""

    async def execute(self, tool_context: ToolContext, params: ListChatHistoryParams) -> ToolResult:
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
            result = await service.describe_files(
                history_types=params.history_types,
                time_range=time_range,
                statuses=params.statuses,
                parent_agent_ids=params.parent_agent_ids,
                pattern=params.pattern,
                limit=params.limit,
            )
        except Exception as exc:
            return ToolResult.error(
                f"Chat history list failed: {exc}",
                extra_info=error_result_info(classify_error(exc)),
                use_custom_remark=True,
            )

        files = result["files"]
        lines = [
            f"History root (read-only): {result['history_root']}",
            f"Found {result['total']} matching history files. Returned {result['returned']}."
        ]
        counts = result["counts"]
        lines.append(
            "Inventory: "
            + ", ".join(
                f"{history_type}={counts.get(history_type, 0)}"
                for history_type in ("current", "compacted", "subagent")
            )
            + "."
        )
        if result["truncated"]:
            lines.append("More files matched the filters. Narrow history_types, time_range, status, parent, or pattern.")
        for item in files:
            history_type = item["history_type"]
            modified = format_history_time(
                _timestamp_to_datetime(item.get("modified_at")),
                context.get_user_timezone(),
            )
            line = f"- {history_type}: {item['history_file']} | {item['size_bytes']} bytes | modified {modified}"
            if history_type == HistoryType.SUBAGENT.value:
                parent = f"{item.get('parent_agent_name') or '?'}<{item.get('parent_agent_id') or '?'}>"
                line += f" | status={item.get('status') or '?'} | task={item.get('task_label') or '-'} | parent={parent}"
                if item.get("finished_at") is not None:
                    line += (
                        " | finished "
                        + format_history_time(
                            _timestamp_to_datetime(item["finished_at"]),
                            context.get_user_timezone(),
                        )
                    )
                if item.get("result_preview"):
                    line += f" | result={item['result_preview']}"
            lines.append(line)
        tool_result = ToolResult(content="\n".join(lines), data=result)
        tool_result.extra_info["history_display_time_range"] = time_range
        return tool_result

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, object]:
        return {
            "tool_name": tool_name,
            "action": action(tool_name),
            "remark": translate("list.before"),
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        return build_list_detail(result, timezone_name(tool_context.get_extension_typed("agent_context", AgentContext)))

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, object]:
        if not result.ok:
            remark = translate("list.failed")
        else:
            data = result.data
            if data.get("returned", 0) == 0:
                remark = translate("list.empty")
            else:
                remark = translate("list.after", returned=data.get("returned", 0), total=data.get("total", 0))
            if data.get("truncated"):
                remark += " " + translate("list.truncated")
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


__all__ = ["ListChatHistory", "ListChatHistoryParams"]
