"""Read messages in another owned topic through the existing V2 route."""

from __future__ import annotations

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import tool

from .display import ProductTool
from .message_formatter import format_topic_messages
from .models import ProductParams, resource_id


class ReadTopicMessagesParams(ProductParams):
    topic_id: str = Field(..., description="Exact topic ID to read, including a topic outside the current project.")
    after_id: str | None = Field(None, description="The previous page's next_cursor. Omit for the oldest page.")
    limit: int = Field(20, ge=1, le=100, description="Maximum number of source records to scan in this page.")


@tool(name="read_topic_messages", code_mode_only=True)
class ReadTopicMessages(ProductTool[ReadTopicMessagesParams]):
    """Read one oldest-first page of messages from a topic owned by the current user."""
    name = "read_topic_messages"

    async def execute(self, tool_context: ToolContext, params: ReadTopicMessagesParams) -> ToolResult:
        topic_id = resource_id(params.topic_id, "topic_id")
        after_id = resource_id(params.after_id, "after_id") if params.after_id else None
        async def operation(ctx):
            return await ctx.sdk.message.list_topic_async(ctx.auth, topic_id, after_id=after_id, limit=params.limit)
        return await self.run_product(
            tool_context, "Topic messages", operation,
            format_result=lambda raw: format_topic_messages(topic_id, raw),
        )
