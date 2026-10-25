"""Topic read and management tools."""

from __future__ import annotations

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import tool

from .display import ProductTool
from .models import TOPIC, ProductParams, projected, resource_id


class GetTopicParams(ProductParams):
    topic_id: str = Field(..., description="Exact topic ID, including when reading another topic.")


@tool(name="get_topic", code_mode_only=True)
class GetTopic(ProductTool[GetTopicParams]):
    """Read one topic visible to the current user."""
    name = "get_topic"

    async def execute(self, tool_context: ToolContext, params: GetTopicParams) -> ToolResult:
        topic_id = resource_id(params.topic_id, "topic_id")
        async def operation(ctx):
            return projected(await ctx.sdk.topic.get_async(ctx.auth, topic_id), TOPIC)
        return await self.run_product(tool_context, "Topic lookup", operation)


class CreateTopicParams(ProductParams):
    project_id: str = Field(..., description="Project that will contain this topic.")
    name: str = Field(..., min_length=1, max_length=255, description="New topic name.")


@tool(name="create_topic", code_mode_only=True)
class CreateTopic(ProductTool[CreateTopicParams]):
    """Create a topic in an accessible project."""
    name = "create_topic"

    async def execute(self, tool_context: ToolContext, params: CreateTopicParams) -> ToolResult:
        project_id = resource_id(params.project_id, "project_id")
        async def operation(ctx):
            raw = await ctx.sdk.topic.create_async(ctx.auth, {"project_id": project_id, "topic_name": params.name})
            return projected(raw, TOPIC)
        return await self.run_product(tool_context, "Topic creation", operation, write=True)


class UpdateTopicParams(GetTopicParams):
    name: str = Field(..., min_length=1, max_length=255, description="Replacement topic name.")


@tool(name="update_topic", code_mode_only=True)
class UpdateTopic(ProductTool[UpdateTopicParams]):
    """Rename one topic."""
    name = "update_topic"

    async def execute(self, tool_context: ToolContext, params: UpdateTopicParams) -> ToolResult:
        topic_id = resource_id(params.topic_id, "topic_id")
        async def operation(ctx):
            # 后端保存接口要求 project_id；从目标话题读取，避免跨项目操作误用当前会话归属。
            topic = projected(await ctx.sdk.topic.get_async(ctx.auth, topic_id), ("project_id",))
            project_id = resource_id(topic.get("project_id", ""), "project_id")
            raw = await ctx.sdk.topic.update_async(ctx.auth, topic_id, {"project_id": project_id, "topic_name": params.name})
            return {"id": str(raw.get("id", topic_id)), "topic_name": params.name}
        return await self.run_product(tool_context, "Topic update", operation, write=True)


class ArchiveTopicParams(GetTopicParams):
    archived: bool = Field(..., description="True to archive; false to restore.")


@tool(name="archive_topic", code_mode_only=True)
class ArchiveTopic(ProductTool[ArchiveTopicParams]):
    """Set one topic's archive state."""
    name = "archive_topic"

    async def execute(self, tool_context: ToolContext, params: ArchiveTopicParams) -> ToolResult:
        topic_id = resource_id(params.topic_id, "topic_id")
        async def operation(ctx):
            topic = projected(await ctx.sdk.topic.get_async(ctx.auth, topic_id), ("id", "topic_name", "project_id", "workspace_id"))
            raw = await ctx.sdk.topic.archive_async(ctx.auth, topic_id, params.archived)
            return {**topic, "id": topic_id, "archived": params.archived, "success": raw.get("success"), "result": projected(raw, ("id", "success"))}
        return await self.run_product(tool_context, "Topic archive update", operation, write=True)


@tool(name="delete_topic", code_mode_only=True)
class DeleteTopic(ProductTool[GetTopicParams]):
    """Delete one topic using its exact ID."""
    name = "delete_topic"

    async def execute(self, tool_context: ToolContext, params: GetTopicParams) -> ToolResult:
        topic_id = resource_id(params.topic_id, "topic_id")
        async def operation(ctx):
            topic = projected(await ctx.sdk.topic.get_async(ctx.auth, topic_id), ("id", "topic_name", "project_id", "workspace_id"))
            raw = await ctx.sdk.topic.delete_async(ctx.auth, {"id": topic_id})
            return {**topic, "id": str(raw.get("id", topic_id))}
        return await self.run_product(tool_context, "Topic deletion", operation, write=True)
