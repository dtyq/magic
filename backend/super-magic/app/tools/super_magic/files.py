"""Discover and organize selected project files."""

from __future__ import annotations

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import tool

from .display import ProductTool
from .models import FILE, ProductParams, projected, projected_page, resource_id


def _batch_result(raw: dict, batch_key: str | None = None) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("The service returned an invalid batch result")
    data = projected(raw, ("batch_key", "status", "operation", "progress", "current", "total", "success", "count"))
    if "message" in raw:
        data["message"] = str(raw["message"])[:500]
    if batch_key is not None:
        data["batch_key"] = batch_key
    files = raw.get("files")
    if isinstance(files, list):
        data["files"] = [projected(item, ("file_id", "target_file_id", "file_name", "relative_file_path", "status", "success", "message", "error")) for item in files if isinstance(item, dict)]
    elif isinstance(raw.get("file_ids"), list) and "count" in raw:
        data["status"] = "success"
        data["files"] = [{"file_id": str(file_id), "status": "success"} for file_id in raw["file_ids"]]
    return data


def _batch_present(data: dict) -> ToolResult:
    status = data.get("status", "accepted" if data.get("batch_key") else "unknown")
    batch_key = data.get("batch_key")
    lines = [f"File batch status: {status}." + (f" Batch key: {batch_key}." if batch_key else "")]
    if data.get("message"):
        lines.append(data["message"])
    for item in data.get("files", []):
        file_id = item.get("file_id", "unknown")
        item_status = item.get("status", "success" if status == "success" else "unknown")
        message = str(item.get("message") or item.get("error") or "")[:500]
        lines.append(f"- File {file_id}: {item_status}." + (f" {message}" if message else ""))
    if status in {"accepted", "processing", "waiting", "queued"}:
        lines.append("Check batch status before reporting completion.")
    if data.get("success") is False or status in {"failed", "not_found"}:
        return ToolResult.error("\n".join(lines), data=data)
    return ToolResult(content="\n".join(lines), data=data)


class ListProjectFilesParams(ProductParams):
    project_id: str = Field(..., description="Exact project ID.")
    parent_id: str | None = Field(None, description="Directory to start from; omit for project root.")
    page_size: int = Field(50, ge=1, le=100, description="Files per page.")
    next_parent_ids: list[dict] | None = Field(None, description="Opaque next_parent_ids from the previous page. Pass it unchanged.")


@tool(name="list_project_files", code_mode_only=True)
class ListProjectFiles(ProductTool[ListProjectFilesParams]):
    """Browse project file metadata with the server's directory cursor."""
    name = "list_project_files"

    async def execute(self, tool_context: ToolContext, params: ListProjectFilesParams) -> ToolResult:
        project_id = resource_id(params.project_id, "project_id")
        parent_id = resource_id(params.parent_id, "parent_id") if params.parent_id else None
        body = {"page_size": params.page_size}
        if parent_id:
            body["parent_id"] = parent_id
        if params.next_parent_ids is not None:
            body["next_parent_ids"] = params.next_parent_ids
        async def operation(ctx):
            raw = await ctx.sdk.file.list_project_async(ctx.auth, project_id, body)
            return projected_page(raw, FILE)
        return await self.run_product(tool_context, "Project file search", operation)


class GetProjectFileParams(ProductParams):
    file_id: str = Field(..., description="Exact file ID.")


@tool(name="get_project_file", code_mode_only=True)
class GetProjectFile(ProductTool[GetProjectFileParams]):
    """Read basic metadata for one authorized project file."""
    name = "get_project_file"

    async def execute(self, tool_context: ToolContext, params: GetProjectFileParams) -> ToolResult:
        file_id = resource_id(params.file_id, "file_id")
        async def operation(ctx):
            raw = await ctx.sdk.file.get_product_file_async(ctx.auth, file_id)
            return {"file_id": file_id, **projected(raw, ("file_name", "version", "relative_file_path"))}
        return await self.run_product(tool_context, "File lookup", operation)


class CreateDirectoryParams(ProductParams):
    project_id: str = Field(..., description="Exact project ID.")
    parent_id: str = Field(..., description="Exact parent directory ID.")
    name: str = Field(..., min_length=1, max_length=255, description="New directory name.")


@tool(name="create_project_directory", code_mode_only=True)
class CreateProjectDirectory(ProductTool[CreateDirectoryParams]):
    """Create a directory in one project."""
    name = "create_project_directory"

    async def execute(self, tool_context: ToolContext, params: CreateDirectoryParams) -> ToolResult:
        project_id = resource_id(params.project_id, "project_id")
        parent_id = resource_id(params.parent_id, "parent_id")
        async def operation(ctx):
            raw = await ctx.sdk.file.create_directory_async(ctx.auth, {"project_id": project_id, "parent_id": parent_id, "file_name": params.name, "is_directory": True})
            return projected(raw, FILE)
        return await self.run_product(tool_context, "Directory creation", operation, write=True)


class RenameFileParams(GetProjectFileParams):
    name: str = Field(..., min_length=1, max_length=255, description="Replacement file name, at most 255 UTF-8 bytes.")

    @field_validator("name")
    @classmethod
    def validate_name_bytes(cls, value: str) -> str:
        # 与后端 WorkFileUtil 的 PHP trim + strlen 保持一致；中文和 emoji 不能按字符数计量。
        if len(value.strip(" \t\n\r\0\v").encode("utf-8")) > 255:
            raise ValueError("File name cannot exceed 255 UTF-8 bytes")
        return value


@tool(name="rename_project_file", code_mode_only=True)
class RenameProjectFile(ProductTool[RenameFileParams]):
    """Rename one project file or directory."""
    name = "rename_project_file"

    async def execute(self, tool_context: ToolContext, params: RenameFileParams) -> ToolResult:
        file_id = resource_id(params.file_id, "file_id")
        async def operation(ctx):
            raw = await ctx.sdk.file.rename_product_file_async(ctx.auth, file_id, params.name)
            return {"file_id": file_id, "name": params.name, "result": projected(raw, ("file_id", "file_name", "success"))}
        return await self.run_product(tool_context, "File rename", operation, write=True)


class FileBatchParams(ProductParams):
    project_id: str = Field(..., description="Source project ID.")
    file_ids: list[str] = Field(..., min_length=1, max_length=100, description="Exact selected file IDs.")
    target_project_id: str = Field(..., description="Destination project ID.")
    target_parent_id: str = Field(..., description="Destination directory ID.")


class FileBatchTool(ProductTool[FileBatchParams]):
    """Shared typed arguments for selected file copy and move operations."""
    operation: str

    async def execute(self, tool_context: ToolContext, params: FileBatchParams) -> ToolResult:
        body = {
            "project_id": resource_id(params.project_id, "project_id"),
            "file_ids": [resource_id(item, "file_id") for item in params.file_ids],
            "target_project_id": resource_id(params.target_project_id, "target_project_id"),
            "target_parent_id": resource_id(params.target_parent_id, "target_parent_id"),
        }
        async def call(ctx):
            raw = await ctx.sdk.file.batch_product_file_async(ctx.auth, self.operation, body)
            return _batch_result(raw)
        return await self.run_product(tool_context, f"File {self.operation}", call, write=True, format_result=_batch_present)


@tool(name="copy_project_files", code_mode_only=True)
class CopyProjectFiles(FileBatchTool):
    """Copy selected files to a specified project directory."""
    name = "copy_project_files"
    operation = "copy"


@tool(name="move_project_files", code_mode_only=True)
class MoveProjectFiles(FileBatchTool):
    """Move selected files to a specified project directory."""
    name = "move_project_files"
    operation = "move"


class DeleteProjectFilesParams(ProductParams):
    project_id: str = Field(..., description="Source project ID.")
    file_ids: list[str] = Field(..., min_length=1, max_length=100, description="Exact selected file IDs.")


@tool(name="delete_project_files", code_mode_only=True)
class DeleteProjectFiles(ProductTool[DeleteProjectFilesParams]):
    """Delete selected project files using the existing batch endpoint."""
    name = "delete_project_files"

    async def execute(self, tool_context: ToolContext, params: DeleteProjectFilesParams) -> ToolResult:
        body = {"project_id": resource_id(params.project_id, "project_id"), "file_ids": [resource_id(item, "file_id") for item in params.file_ids]}
        async def operation(ctx):
            raw = await ctx.sdk.file.batch_product_file_async(ctx.auth, "delete", body)
            return _batch_result(raw)
        return await self.run_product(tool_context, "File deletion", operation, write=True, format_result=_batch_present)


class FileBatchStatusParams(ProductParams):
    batch_key: str = Field(..., min_length=1, description="Batch key returned by a file operation.")


@tool(name="get_file_batch_status", code_mode_only=True)
class GetFileBatchStatus(ProductTool[FileBatchStatusParams]):
    """Check a file batch operation's actual status."""
    name = "get_file_batch_status"

    async def execute(self, tool_context: ToolContext, params: FileBatchStatusParams) -> ToolResult:
        async def operation(ctx):
            raw = await ctx.sdk.file.batch_status_async(ctx.auth, params.batch_key)
            return _batch_result(raw, params.batch_key)
        return await self.run_product(tool_context, "File batch lookup", operation, format_result=_batch_present)
