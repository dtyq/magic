"""Prepare a small set of authorized project files in the local runtime directory."""

from __future__ import annotations

import asyncio
import os
import re
import shutil
import time
from pathlib import Path
from uuid import uuid4

import httpx
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.path_manager import PathManager
from app.tools.core import tool
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive

from .display import ProductTool
from .models import ProductParams, resource_id

MAX_FILE = 20 * 1024 * 1024
MAX_REQUEST = 100 * 1024 * 1024
MAX_RETAINED = 500 * 1024 * 1024
RETENTION_SECONDS = 24 * 60 * 60


def _root() -> Path:
    return PathManager.get_runtime_dir() / "super-magic-product-files"


def _cleanup_expired(root: Path) -> int:
    now = time.time()
    used = 0
    for entry in root.iterdir():
        if not entry.is_dir() or entry.is_symlink():
            continue
        if now - entry.stat().st_mtime > RETENTION_SECONDS:
            shutil.rmtree(entry)
            continue
        used += sum(path.stat().st_size for path in entry.rglob("*") if path.is_file() and not path.is_symlink())
    return used


class PrepareProjectFilesParams(ProductParams):
    project_id: str = Field(..., description="Project from which these file IDs were selected.")
    file_ids: list[str] = Field(..., min_length=1, max_length=10, description="One to ten exact, selected file IDs. Directories are unsupported.")
    purpose: str = Field(..., min_length=1, max_length=200, description="Why these files are needed for the current request.")


@tool(name="prepare_project_files", code_mode_only=True)
class PrepareProjectFiles(ProductTool[PrepareProjectFilesParams]):
    """Download selected authorized files to short-lived local paths for reading."""
    name = "prepare_project_files"

    async def execute(self, tool_context: ToolContext, params: PrepareProjectFilesParams) -> ToolResult:
        resource_id(params.project_id, "project_id")
        file_ids = [resource_id(item, "file_id") for item in params.file_ids]
        if len(set(file_ids)) != len(file_ids):
            return ToolResult.error("File IDs must be unique.", use_custom_remark=True, data={"code": "duplicate_file_id"})

        keepalive = start_tool_keep_alive(tool_context)
        try:
            return await self.run_product(
                tool_context, "File preparation",
                lambda ctx: self._prepare(ctx, file_ids),
                format_result=self._present,
            )
        finally:
            stop_tool_keep_alive(keepalive)

    async def _prepare(self, ctx, file_ids: list[str]) -> dict:
        root = _root()
        root.mkdir(mode=0o700, parents=True, exist_ok=True)
        used = _cleanup_expired(root)
        if used >= MAX_RETAINED:
            raise ValueError("The local file preparation quota is full. Wait for older files to expire.")

        response = await ctx.sdk.file.get_product_file_urls_async(ctx.auth, file_ids)
        available = {str(item.get("file_id")): item for item in response.get("list", []) if isinstance(item, dict)}
        missing = {str(item) for item in response.get("missing_file_ids", [])}
        request_dir = root / uuid4().hex
        request_dir.mkdir(mode=0o700)
        results = []
        total = 0
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(60.0), follow_redirects=False) as client:
                for file_id in file_ids:
                    if ctx.agent.is_interruption_requested():
                        raise asyncio.CancelledError
                    item = available.get(file_id)
                    if item is None or file_id in missing:
                        results.append({"file_id": file_id, "status": "failed", "reason": "No authorized URL was returned"})
                        continue
                    url = item.get("url")
                    if not isinstance(url, str) or not url.startswith(("https://", "http://")):
                        results.append({"file_id": file_id, "status": "failed", "reason": "Invalid signed URL"})
                        continue
                    try:
                        info = await ctx.sdk.file.get_product_file_async(ctx.auth, file_id)
                        name = str(info.get("file_name") or "")
                        suffix = Path(name).suffix.lower()
                        if not re.fullmatch(r"\.[a-z0-9]{1,12}", suffix):
                            suffix = ""
                        path = request_dir / f"{file_id}{suffix}"
                        size = 0
                        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                        try:
                            with os.fdopen(fd, "wb") as stream:
                                async with client.stream("GET", url) as downloaded:
                                    downloaded.raise_for_status()
                                    async for chunk in downloaded.aiter_bytes(64 * 1024):
                                        if ctx.agent.is_interruption_requested():
                                            raise asyncio.CancelledError
                                        size += len(chunk)
                                        if size > MAX_FILE or total + size > MAX_REQUEST or used + total + size > MAX_RETAINED:
                                            raise ValueError("File preparation size limit exceeded")
                                        stream.write(chunk)
                        except BaseException:
                            path.unlink(missing_ok=True)
                            raise
                        total += size
                        results.append({"file_id": file_id, "status": "prepared", "file_name": name, "path": str(path), "bytes": size})
                    except asyncio.CancelledError:
                        raise
                    except (httpx.HTTPError, OSError, ValueError) as exc:
                        reason = "Size limit exceeded" if isinstance(exc, ValueError) else "Download failed"
                        results.append({"file_id": file_id, "status": "failed", "reason": reason})
        except BaseException:
            shutil.rmtree(request_dir, ignore_errors=True)
            raise

        if not any(item["status"] == "prepared" for item in results):
            shutil.rmtree(request_dir, ignore_errors=True)
        return {"files": results, "partial_success": any(item["status"] == "failed" for item in results), "expires_at": int(time.time() + RETENTION_SECONDS)}

    @staticmethod
    def _present(data: dict) -> ToolResult:
        prepared = [item for item in data["files"] if item["status"] == "prepared"]
        failed = [item for item in data["files"] if item["status"] == "failed"]
        lines = [f"Prepared {len(prepared)} file(s); {len(failed)} failed. Local files are cleaned after 24 hours on the next preparation."]
        lines.extend(f"- {item['file_name']}: {item['path']}" for item in prepared)
        lines.extend(f"- File {item['file_id']}: {item['reason']}" for item in failed)
        result = ToolResult(content="\n".join(lines), data=data)
        return result if prepared else ToolResult.error("\n".join(lines), data=data)
