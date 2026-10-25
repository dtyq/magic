"""Project discovery and management tools."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import tool

from .display import ProductTool
from .models import PROJECT, TOPIC, WORKSPACE, ProductParams, projected, projected_page, resource_id


class ListProjectsParams(ProductParams):
    keyword: str = Field("", max_length=255, description="Optional project name filter.")
    scope: Literal["owned", "participated"] = Field("owned", description="Owned projects or projects you participate in.")
    workspace_id: str | None = Field(None, description="Exact workspace ID. Limit results to projects in this workspace.")
    page: int = Field(1, ge=1, description="Page number.")
    page_size: int = Field(20, ge=1, le=100, description="Projects per page.")
    order_by: Literal["id", "created_at", "updated_at"] = Field("created_at", description="Owned projects only: order by ID, creation time, or project update time. Participated projects use last_active_at descending.")
    sort: Literal["asc", "desc"] = Field("desc", description="Owned projects only: ascending or descending order.")


@tool(name="list_projects", code_mode_only=True)
class ListProjects(ProductTool[ListProjectsParams]):
    """Find projects available to the current user."""
    name = "list_projects"

    async def execute(self, tool_context: ToolContext, params: ListProjectsParams) -> ToolResult:
        if params.scope == "participated" and (params.order_by != "created_at" or params.sort != "desc"):
            return ToolResult.error("Participated projects use last_active_at descending; order_by and sort apply only to owned projects.", use_custom_remark=True, data={"code": "invalid_input_or_response"})
        workspace_id = resource_id(params.workspace_id, "workspace_id") if params.workspace_id is not None else None
        async def operation(ctx):
            raw = await ctx.sdk.project.list_async(ctx.auth, keyword=params.keyword, scope=params.scope, workspace_id=workspace_id, page=params.page, page_size=params.page_size, order_by=params.order_by, sort=params.sort)
            result = projected_page(raw, PROJECT)
            result.update(page=params.page, page_size=params.page_size)
            if isinstance(result.get("total"), int):
                result["has_more"] = params.page * params.page_size < result["total"]
            return result
        return await self.run_product(tool_context, "Project search", operation)


class GetProjectParams(ProductParams):
    project_id: str = Field(..., description="Exact project ID.")


@tool(name="get_project", code_mode_only=True)
class GetProject(ProductTool[GetProjectParams]):
    """Read one project visible to the current user."""
    name = "get_project"

    async def execute(self, tool_context: ToolContext, params: GetProjectParams) -> ToolResult:
        project_id = resource_id(params.project_id, "project_id")
        async def operation(ctx):
            return projected(await ctx.sdk.project.get_async(ctx.auth, project_id), PROJECT)
        return await self.run_product(tool_context, "Project lookup", operation)


class ListTopicsParams(GetProjectParams):
    keyword: str = Field("", max_length=255, description="Optional topic name filter within this project.")
    order_by: Literal["created_at", "updated_at"] = Field("created_at", description="Default creation order, or recently updated topics. Name search uses recently updated order.")
    page: int = Field(1, ge=1, description="Page number.")
    page_size: int = Field(20, ge=1, le=100, description="Topics per page.")


@tool(name="list_topics", code_mode_only=True)
class ListTopics(ProductTool[ListTopicsParams]):
    """List visible topics belonging to one project."""
    name = "list_topics"

    async def execute(self, tool_context: ToolContext, params: ListTopicsParams) -> ToolResult:
        project_id = resource_id(params.project_id, "project_id")
        async def operation(ctx):
            searching = bool(params.keyword) or params.order_by == "updated_at"
            if searching:
                raw = await ctx.sdk.project.search_topics_async(ctx.auth, project_id, keyword=params.keyword, page=params.page, page_size=params.page_size)
            else:
                raw = await ctx.sdk.project.list_topics_async(ctx.auth, project_id, page=params.page, page_size=params.page_size)
            result = projected_page(raw, TOPIC)
            result.update(page=params.page, page_size=params.page_size)
            if isinstance(result.get("total"), int):
                result["has_more"] = params.page * params.page_size < result["total"]
                if searching and result["total"] >= 999:
                    result["coverage_limit"] = 999
            return result
        return await self.run_product(tool_context, "Topic search", operation)


class CreateProjectParams(ProductParams):
    workspace_id: str = Field(..., description="Workspace that will contain this project.")
    name: str = Field(..., min_length=1, max_length=255, description="New project name.")


@tool(name="create_project", code_mode_only=True)
class CreateProject(ProductTool[CreateProjectParams]):
    """Create a project and return its automatically created default topic."""
    name = "create_project"

    async def execute(self, tool_context: ToolContext, params: CreateProjectParams) -> ToolResult:
        workspace_id = resource_id(params.workspace_id, "workspace_id")
        async def operation(ctx):
            raw = await ctx.sdk.project.create_async(ctx.auth, {"workspace_id": workspace_id, "project_name": params.name})
            project = projected(raw.get("project"), PROJECT)
            topic = projected(raw.get("topic"), TOPIC)
            return {"id": project.get("id"), "project_name": project.get("project_name"), "default_topic_id": topic.get("id"), "project": project, "default_topic": topic}
        return await self.run_product(tool_context, "Project creation", operation, write=True)


class UpdateProjectParams(GetProjectParams):
    name: str = Field(..., min_length=1, max_length=255, description="Replacement project name.")


@tool(name="update_project", code_mode_only=True)
class UpdateProject(ProductTool[UpdateProjectParams]):
    """Rename one project."""
    name = "update_project"

    async def execute(self, tool_context: ToolContext, params: UpdateProjectParams) -> ToolResult:
        project_id = resource_id(params.project_id, "project_id")
        async def operation(ctx):
            return projected(await ctx.sdk.project.update_async(ctx.auth, project_id, {"project_name": params.name}), PROJECT)
        return await self.run_product(tool_context, "Project update", operation, write=True)


class MoveProjectParams(GetProjectParams):
    target_workspace_id: str = Field(..., description="Destination workspace ID.")


@tool(name="move_project", code_mode_only=True)
class MoveProject(ProductTool[MoveProjectParams]):
    """Move one project to another workspace."""
    name = "move_project"

    async def execute(self, tool_context: ToolContext, params: MoveProjectParams) -> ToolResult:
        project_id = resource_id(params.project_id, "project_id")
        workspace_id = resource_id(params.target_workspace_id, "target_workspace_id")
        async def operation(ctx):
            project = projected(await ctx.sdk.project.get_async(ctx.auth, project_id), PROJECT)
            target = projected(await ctx.sdk.workspace.get_async(ctx.auth, workspace_id), WORKSPACE)
            raw = await ctx.sdk.project.move_async(ctx.auth, {"source_project_id": project_id, "target_workspace_id": workspace_id})
            return {**project, "id": project_id, "workspace_id": workspace_id, "workspace_name": target.get("name", ""), "target_workspace": target, "success": raw.get("success"), "result": projected(raw, ("success", "id", "workspace_id"))}
        return await self.run_product(tool_context, "Project move", operation, write=True)


@tool(name="delete_project", code_mode_only=True)
class DeleteProject(ProductTool[GetProjectParams]):
    """Delete one project using its exact ID."""
    name = "delete_project"

    async def execute(self, tool_context: ToolContext, params: GetProjectParams) -> ToolResult:
        project_id = resource_id(params.project_id, "project_id")
        async def operation(ctx):
            project = projected(await ctx.sdk.project.get_async(ctx.auth, project_id), PROJECT)
            raw = await ctx.sdk.project.delete_async(ctx.auth, project_id)
            return {**project, "id": str(raw.get("id", project_id))}
        return await self.run_product(tool_context, "Project deletion", operation, write=True)
