"""Search selected project file metadata with one aggregate tool receipt."""

from __future__ import annotations

import asyncio
import json
from collections import deque
from time import monotonic

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import tool
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive

from .display import ProductTool
from .files import ListProjectFiles, ListProjectFilesParams
from .models import ProductParams, resource_id

SEARCH_SECONDS = 45
PAGE_SECONDS = 15


class FileSearchScope(ListProjectFilesParams):
    project_name: str | None = Field(None, max_length=200, description="Optional project name from discovery, used only for display.")

    @field_validator("project_id", "parent_id")
    @classmethod
    def validate_id(cls, value: str | None) -> str | None:
        return resource_id(value) if value is not None else None


class SearchProjectFilesParams(ProductParams):
    projects: list[FileSearchScope] = Field(..., min_length=1, max_length=20, description="Selected project/directory scopes; preserve returned cursors when continuing.")
    keywords: list[str] = Field(..., min_length=1, max_length=5, description="Case-insensitive literal substrings; match any keyword in a file name or project-relative path.")
    max_pages: int = Field(20, ge=1, le=50, description="Total page budget shared across all scopes.")
    max_results: int = Field(100, ge=1, le=100, description="Maximum matching files returned; omitted matches are reported.")

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, values: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(value.strip().casefold() for value in values))
        if any(not value or len(value) > 100 for value in normalized):
            raise ValueError("Each keyword must contain 1–100 non-whitespace characters.")
        return normalized

    @field_validator("projects")
    @classmethod
    def validate_scopes(cls, values: list[FileSearchScope]) -> list[FileSearchScope]:
        keys = [(item.project_id, item.parent_id) for item in values]
        if len(set(keys)) != len(keys):
            raise ValueError("Select each project/directory scope only once.")
        return values


# Code Mode 使用说明：agents/skills/super-magic/references/files.md。
@tool(name="search_project_files", code_mode_only=True)
class SearchProjectFiles(ProductTool[SearchProjectFilesParams]):
    """Find matching file metadata across selected authorized project scopes."""

    name = "search_project_files"

    async def execute(self, tool_context: ToolContext, params: SearchProjectFilesParams) -> ToolResult:
        keepalive = start_tool_keep_alive(tool_context)
        try:
            return await self.run_product(
                tool_context, "Project file search",
                lambda ctx: self._interruptible_search(tool_context, ctx.agent, params),
                format_result=self._present,
            )
        finally:
            stop_tool_keep_alive(keepalive)

    async def _interruptible_search(self, tool_context, agent, params) -> dict:
        # 中断必须结束正在等待的请求，不能只在下一页开始前才检查。
        work = asyncio.create_task(self._search(tool_context, params))
        interrupted = asyncio.create_task(agent.get_interruption_event().wait())
        try:
            await asyncio.wait({work, interrupted}, return_when=asyncio.FIRST_COMPLETED)
            if interrupted.done():
                raise asyncio.CancelledError
            return await work
        finally:
            for task in (work, interrupted):
                if not task.done():
                    task.cancel()
            await asyncio.gather(work, interrupted, return_exceptions=True)

    async def _search(self, tool_context, params: SearchProjectFilesParams) -> dict:
        reader = ListProjectFiles()
        scopes = [dict(
            project_id=scope.project_id, project_name=scope.project_name,
            parent_id=scope.parent_id, next_parent_ids=scope.next_parent_ids,
            status="pending", pages_scanned=0,
        ) for scope in params.projects]
        pending = deque(range(len(scopes)))
        cursors_seen = [{json.dumps(scope.next_parent_ids, sort_keys=True)} for scope in params.projects]
        seen_files: set[tuple[str, str]] = set()
        matches = []
        matched_count = pages_requested = records_scanned = 0
        deadline = monotonic() + SEARCH_SECONDS
        while pending and pages_requested < params.max_pages and monotonic() < deadline:
            index = pending.popleft()
            state = scopes[index]
            request = ListProjectFilesParams(**params.projects[index].model_dump(exclude={"project_name"}))
            request.next_parent_ids = state["next_parent_ids"]
            pages_requested += 1
            try:
                # 直接复用列表实现和当前用户鉴权；不经过工具调度器逐页发送卡片。
                page = await asyncio.wait_for(reader.execute(tool_context, request), min(PAGE_SECONDS, max(0.001, deadline - monotonic())))
            except TimeoutError:
                if monotonic() >= deadline:
                    # 整体预算耗尽时仍可从本页继续，不误报服务失败。
                    break
                state.update(status="failed", error_code="network_error")
                continue
            if not page.ok:
                state.update(status="failed", error_code=(page.data or {}).get("code", "unexpected_error"))
                continue
            state["pages_scanned"] += 1
            data = page.data
            for item in data["items"]:
                records_scanned += 1
                if item.get("is_directory") in (True, 1, "1"):
                    continue
                name = str(item.get("file_name") or item.get("name") or "")
                path = str(item.get("relative_file_path") or "")
                if not any(word in name.casefold() or word in path.casefold() for word in params.keywords):
                    continue
                key = (state["project_id"], str(item.get("file_id") or item.get("id") or path or name))
                if key in seen_files:
                    continue
                seen_files.add(key)
                matched_count += 1
                if len(matches) < params.max_results:
                    matches.append({**item, "project_id": state["project_id"], "project_name": state["project_name"]})
            cursor = data.get("next_parent_ids")
            if data.get("has_more") is False and not cursor:
                state.update(status="complete", next_parent_ids=[])
            elif isinstance(cursor, list) and cursor:
                signature = json.dumps(cursor, sort_keys=True)
                if signature in cursors_seen[index]:
                    state.update(status="failed", error_code="invalid_input_or_response")
                else:
                    cursors_seen[index].add(signature)
                    state["next_parent_ids"] = cursor
                    pending.append(index)
            else:
                # 缺少明确结束信号或可用游标时，不能把第一页当成完整搜索。
                state.update(status="failed", error_code="invalid_input_or_response")
            # 保留整页的游标；若本页命中超出上限，明确告知用户缩小关键词范围。
            if matched_count >= params.max_results:
                break
        complete = all(scope["status"] == "complete" for scope in scopes)
        return {
            "items": matches, "keyword": " | ".join(params.keywords),
            "search_scopes": scopes, "pages_requested": pages_requested,
            "records_scanned": records_scanned, "matched_count": matched_count,
            "search_complete": complete, "results_truncated": matched_count > len(matches),
            "partial_success": any(scope["status"] == "failed" for scope in scopes) and any(scope["pages_scanned"] for scope in scopes),
        }

    @staticmethod
    def _present(data: dict) -> ToolResult:
        scopes = data["search_scopes"]
        lines = [f"File name search: {len(data['items'])} matching file(s) returned."]
        lines.append(f"Checked {data['records_scanned']} metadata records across {len(scopes)} selected scopes; {data['pages_requested']} page request(s).")
        for scope in scopes:
            label = scope.get("project_name") or scope["project_id"]
            detail = f" Reason: {scope['error_code']}." if scope.get("error_code") else ""
            lines.append(f"- Project {label} (id: {scope['project_id']}): {scope['status']}.{detail}")
        for item in data["items"]:
            name = item.get("file_name") or item.get("name") or "Unnamed file"
            identifier = item.get("file_id") or item.get("id") or "unavailable"
            path = item.get("relative_file_path") or "unavailable"
            lines.append(f"- {name} (file_id: {identifier}; project_id: {item['project_id']}; project file path: {path})")
        if not data["search_complete"]:
            lines.append("Search coverage is incomplete. Use pending search_scopes and their exact next_parent_ids to continue only if needed; do not claim no matching files exist elsewhere.")
        if data["results_truncated"]:
            lines.append("Matching results from scanned pages were omitted. Narrow keywords or directory scope to retrieve them; continuing the next-page cursor will not recover omitted matches.")
        lines.append("This searches names and paths, not file contents or a year/date range. Read selected files to verify their subject and year.")
        if not any(scope["pages_scanned"] for scope in scopes):
            return ToolResult.error("\n".join(lines), data={**data, "code": "search_unavailable"})
        return ToolResult(content="\n".join(lines), data=data)
