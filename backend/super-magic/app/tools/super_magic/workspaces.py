"""Workspace discovery and management tools."""

from __future__ import annotations

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import tool

from .display import ProductTool
from .models import WORKSPACE, ProductParams, projected, projected_page, resource_id


class ListWorkspacesParams(ProductParams):
    keyword: str = Field("", max_length=255, description="Optional workspace name filter.")
    page: int = Field(1, ge=1, description="Page number.")
    page_size: int = Field(20, ge=1, le=100, description="Number of workspaces per page.")


@tool(name="list_workspaces", code_mode_only=True)
class ListWorkspaces(ProductTool[ListWorkspacesParams]):
    """Find the current user's workspaces without creating any new workspace."""
    name = "list_workspaces"

    async def execute(self, tool_context: ToolContext, params: ListWorkspacesParams) -> ToolResult:
        async def operation(ctx):
            raw = await ctx.sdk.workspace.list_async(ctx.auth, keyword=params.keyword, page=params.page, page_size=params.page_size)
            return projected_page(raw, WORKSPACE)
        return await self.run_product(tool_context, "Workspace search", operation)


class GetWorkspaceParams(ProductParams):
    workspace_id: str = Field(..., description="Exact workspace ID.")


@tool(name="get_workspace", code_mode_only=True)
class GetWorkspace(ProductTool[GetWorkspaceParams]):
    """Read one workspace visible to the current user."""
    name = "get_workspace"

    async def execute(self, tool_context: ToolContext, params: GetWorkspaceParams) -> ToolResult:
        workspace_id = resource_id(params.workspace_id, "workspace_id")
        async def operation(ctx):
            return projected(await ctx.sdk.workspace.get_async(ctx.auth, workspace_id), WORKSPACE)
        return await self.run_product(tool_context, "Workspace lookup", operation)


class CreateWorkspaceParams(ProductParams):
    name: str = Field(..., min_length=1, max_length=50, description="New workspace name.")


@tool(name="create_workspace", code_mode_only=True)
class CreateWorkspace(ProductTool[CreateWorkspaceParams]):
    """Create a workspace for the current user."""
    name = "create_workspace"

    async def execute(self, tool_context: ToolContext, params: CreateWorkspaceParams) -> ToolResult:
        async def operation(ctx):
            return projected(await ctx.sdk.workspace.create_async(ctx.auth, {"workspace_name": params.name, "workspace_type": "default"}), WORKSPACE)
        return await self.run_product(tool_context, "Workspace creation", operation, write=True)


class UpdateWorkspaceParams(ProductParams):
    workspace_id: str = Field(..., description="Exact workspace ID.")
    name: str = Field(..., min_length=1, max_length=50, description="Replacement workspace name.")


@tool(name="update_workspace", code_mode_only=True)
class UpdateWorkspace(ProductTool[UpdateWorkspaceParams]):
    """Rename one workspace."""
    name = "update_workspace"

    async def execute(self, tool_context: ToolContext, params: UpdateWorkspaceParams) -> ToolResult:
        workspace_id = resource_id(params.workspace_id, "workspace_id")
        async def operation(ctx):
            return projected(await ctx.sdk.workspace.update_async(ctx.auth, workspace_id, {"workspace_name": params.name}), WORKSPACE)
        return await self.run_product(tool_context, "Workspace update", operation, write=True)


class ArchiveWorkspaceParams(ProductParams):
    workspace_id: str = Field(..., description="Exact workspace ID.")
    archived: bool = Field(..., description="True to archive; false to restore.")


@tool(name="archive_workspace", code_mode_only=True)
class ArchiveWorkspace(ProductTool[ArchiveWorkspaceParams]):
    """Set one workspace's archive state."""
    name = "archive_workspace"

    async def execute(self, tool_context: ToolContext, params: ArchiveWorkspaceParams) -> ToolResult:
        workspace_id = resource_id(params.workspace_id, "workspace_id")
        async def operation(ctx):
            workspace = projected(await ctx.sdk.workspace.get_async(ctx.auth, workspace_id), WORKSPACE)
            raw = await ctx.sdk.workspace.archive_async(ctx.auth, workspace_id, params.archived)
            return {**workspace, "id": workspace_id, "archived": params.archived, "is_archived": params.archived, "success": raw.get("success")}
        return await self.run_product(tool_context, "Workspace archive update", operation, write=True)


@tool(name="delete_workspace", code_mode_only=True)
class DeleteWorkspace(ProductTool[GetWorkspaceParams]):
    """Delete one workspace using the product's existing delete behavior."""
    name = "delete_workspace"

    async def execute(self, tool_context: ToolContext, params: GetWorkspaceParams) -> ToolResult:
        workspace_id = resource_id(params.workspace_id, "workspace_id")
        async def operation(ctx):
            workspace = projected(await ctx.sdk.workspace.get_async(ctx.auth, workspace_id), WORKSPACE)
            raw = await ctx.sdk.workspace.delete_async(ctx.auth, workspace_id)
            return {**workspace, "id": str(raw.get("id", workspace_id))}
        return await self.run_product(tool_context, "Workspace deletion", operation, write=True)
