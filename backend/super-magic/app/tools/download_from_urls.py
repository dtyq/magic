import asyncio
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.event import EventPairType, get_correlation_manager
from agentlang.event.data import PendingToolCallEventData
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.factory.tool_detail_factory import ToolDetailFactory
from app.core.entity.message.server_message import OperationResultStatus
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive
from app.tools.download_from_url import DownloadFromUrl, DownloadFromUrlParams
from app.tools.download_utils.drivers.base import DownloadPhase, DownloadProgress
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry

logger = get_logger(__name__)

MAX_CONCURRENT_DOWNLOADS = 3
PROGRESS_REPORT_INTERVAL_SECONDS = 0.5
DOWNLOAD_CODE_MODE_MIN_TIMEOUT_SECONDS = 24 * 60 * 60
TRANSPORT_MANAGED_HEADERS = {"range", "if-range"}

SdkSnippetTimeoutRegistry.register(
    "download_from_urls",
    min_timeout=DOWNLOAD_CODE_MODE_MIN_TIMEOUT_SECONDS,
)


class DownloadTask(BaseModel):
    url: str = Field(..., description="HTTP or HTTPS file URL.")
    file_path: str = Field(..., description="Workspace-relative destination path including the file name.")
    headers: dict[str, str] = Field(
        default_factory=dict,
        description="Optional request header overrides. Usually omit this field.",
    )
    overwrite: bool = Field(
        default=True,
        description="Replace an existing complete target file. Usually omit this field.",
    )

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        normalized = value.strip()
        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("url must be a valid HTTP or HTTPS URL")
        return normalized

    @field_validator("file_path")
    @classmethod
    def validate_file_path(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("file_path must not be empty")
        return normalized

    @field_validator("headers")
    @classmethod
    def validate_headers(cls, headers: dict[str, str]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for raw_name, raw_value in headers.items():
            name = raw_name.strip()
            if not name:
                raise ValueError("header names must not be empty")
            if "\r" in name or "\n" in name or "\r" in raw_value or "\n" in raw_value:
                raise ValueError("header names and values must not contain line breaks")
            if name.lower() in TRANSPORT_MANAGED_HEADERS:
                raise ValueError(f"{name} is managed by the download engine and must not be provided")
            normalized[name] = raw_value
        return normalized


class DownloadFromUrlsParams(BaseToolParams):
    downloads: list[DownloadTask] = Field(
        ...,
        min_length=1,
        description="Files to download. Use one item per destination path.",
    )

    @model_validator(mode="after")
    def validate_declared_destinations(self) -> "DownloadFromUrlsParams":
        normalized_paths = [str(Path(item.file_path)) for item in self.downloads]
        if len(set(normalized_paths)) != len(normalized_paths):
            raise ValueError("downloads must not contain duplicate destination paths")
        return self


@dataclass
class BatchItemProgress:
    downloaded_bytes: int = 0
    total_bytes: int | None = None
    resumed: bool = False
    retry_count: int = 0
    status: str = "pending"


@dataclass
class BatchProgressState:
    total_files: int
    items: dict[int, BatchItemProgress] = field(default_factory=dict)
    completed_files: int = 0
    last_report_time: float = 0.0
    last_reported_progress: int | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


@dataclass(frozen=True)
class BatchDownloadResult:
    items: list[dict[str, object]]
    success: int
    failed: int
    skipped: int
    total_size_bytes: int


# Full model-facing usage guidance: agents/skills/download/SKILL.md
@tool(code_mode_only=True)
class DownloadFromUrls(BaseTool[DownloadFromUrlsParams]):
    """Download one or more external HTTP or HTTPS resources into the workspace."""

    async def execute(self, tool_context: ToolContext, params: DownloadFromUrlsParams) -> ToolResult:
        downloader = DownloadFromUrl()
        try:
            resolved_paths = self._resolve_unique_paths(downloader, params.downloads)
        except ValueError as exc:
            return ToolResult.error(
                f"Invalid download request: {exc}",
                extra_info={"status": "failed", "detailed_results": []},
            )

        agent_context = tool_context.get_extension("agent_context")
        interruption_event = (
            agent_context.get_interruption_event() if agent_context is not None else None
        )
        correlation_id = self._resolve_correlation_id(tool_context, agent_context)
        progress_state = BatchProgressState(
            total_files=len(params.downloads),
            items={index: BatchItemProgress() for index in range(len(params.downloads))},
        )
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)
        keep_alive_task = start_tool_keep_alive(tool_context)

        try:
            await self._dispatch_progress_event(
                tool_context,
                correlation_id,
                progress_state,
                current_file="",
                current_progress=None,
                status="starting",
                force=True,
            )
            results = await asyncio.gather(
                *(
                    self._download_one(
                        downloader=downloader,
                        task_index=index,
                        task=task,
                        resolved_path=resolved_paths[index],
                        tool_context=tool_context,
                        interruption_event=interruption_event,
                        semaphore=semaphore,
                        progress_state=progress_state,
                        correlation_id=correlation_id,
                    )
                    for index, task in enumerate(params.downloads)
                )
            )
        except asyncio.CancelledError:
            await self._dispatch_progress_event(
                tool_context,
                correlation_id,
                progress_state,
                current_file="",
                current_progress=None,
                status="cancelled",
                force=True,
            )
            raise
        finally:
            stop_tool_keep_alive(keep_alive_task)

        batch_result = self._summarize_results(results)
        final_status = "completed" if batch_result.failed == 0 else "partial_failed"
        await self._dispatch_progress_event(
            tool_context,
            correlation_id,
            progress_state,
            current_file="",
            current_progress=None,
            status=final_status,
            force=True,
        )

        content = self._build_model_summary(batch_result)
        extra_info = {
            "status": final_status,
            "detailed_results": batch_result.items,
            "total": len(batch_result.items),
            "success": batch_result.success,
            "failed": batch_result.failed,
            "skipped": batch_result.skipped,
            "total_size_bytes": batch_result.total_size_bytes,
        }
        if batch_result.success == 0 and batch_result.skipped == 0:
            return ToolResult.error(content, extra_info=extra_info)
        return ToolResult(content=content, extra_info=extra_info)

    def _resolve_unique_paths(
        self,
        downloader: DownloadFromUrl,
        downloads: list[DownloadTask],
    ) -> list[Path]:
        resolved_paths = [
            downloader.resolve_download_path(task.file_path, task.url) for task in downloads
        ]
        normalized = [os.path.normcase(os.path.normpath(str(path))) for path in resolved_paths]
        if len(set(normalized)) != len(normalized):
            raise ValueError("multiple downloads resolve to the same destination path")
        return resolved_paths

    async def _download_one(
        self,
        *,
        downloader: DownloadFromUrl,
        task_index: int,
        task: DownloadTask,
        resolved_path: Path,
        tool_context: ToolContext,
        interruption_event: asyncio.Event | None,
        semaphore: asyncio.Semaphore,
        progress_state: BatchProgressState,
        correlation_id: str,
    ) -> dict[str, object]:
        async with semaphore:
            self._raise_if_interrupted(interruption_event)

            async def report(progress: DownloadProgress) -> None:
                item = progress_state.items[task_index]
                item.downloaded_bytes = progress.downloaded_bytes
                item.total_bytes = progress.total_bytes
                item.resumed = progress.resumed
                item.retry_count = progress.retry_count
                item.status = progress.phase.value
                # 驱动的 COMPLETED 只表示单个文件传输完成；由下方结果处理统一更新
                # 已处理数量并发送文件级完成事件，避免被误判为整个批次完成。
                if progress.phase == DownloadPhase.COMPLETED:
                    return
                await self._dispatch_progress_event(
                    tool_context,
                    correlation_id,
                    progress_state,
                    current_file=resolved_path.name,
                    current_progress=item,
                    current_file_index=task_index,
                    status=progress.phase.value,
                )

            result = await downloader.execute_purely(
                DownloadFromUrlParams(url=task.url, file_path=task.file_path),
                tool_context=tool_context,
                headers=task.headers,
                overwrite=task.overwrite,
                progress_callback=report,
                interruption_event=interruption_event,
            )

            extra = result.extra_info or {}
            status = str(extra.get("status") or ("completed" if result.ok else "failed"))
            item_progress = progress_state.items[task_index]
            item_progress.status = status
            if isinstance(extra.get("file_size"), int):
                item_progress.downloaded_bytes = int(extra["file_size"])
                item_progress.total_bytes = int(extra["file_size"])
            progress_state.completed_files += 1
            progress_event_status = self._item_result_progress_status(status)

            await self._dispatch_progress_event(
                tool_context,
                correlation_id,
                progress_state,
                current_file=resolved_path.name,
                current_progress=item_progress,
                current_file_index=task_index,
                status=progress_event_status,
                force=True,
            )

            if result.ok:
                return {
                    "url": task.url,
                    "file_path": str(extra.get("file_path") or resolved_path),
                    "status": status,
                    "file_size_bytes": int(extra.get("file_size") or 0),
                    "content_type": str(extra.get("content_type") or "application/octet-stream"),
                    "final_url": str(extra.get("url") or task.url),
                    "from_cache": bool(extra.get("from_cache", False)),
                    "resumed": bool(extra.get("resumed", False)),
                    "retry_count": int(extra.get("retry_count") or 0),
                    "request_strategy": str(extra.get("request_strategy") or "unknown"),
                }

            return {
                "url": task.url,
                "file_path": str(resolved_path),
                "status": "failed",
                "error": result.content,
                "retryable": bool(extra.get("retryable", False)),
                "resume_available": bool(extra.get("resume_available", False)),
                "downloaded_bytes": int(extra.get("downloaded_bytes") or 0),
                "total_bytes": extra.get("total_bytes"),
                "next_action": str(extra.get("next_action") or "review_request"),
                "request_strategy": str(extra.get("request_strategy") or "unknown"),
            }

    async def _dispatch_progress_event(
        self,
        tool_context: ToolContext,
        correlation_id: str,
        progress_state: BatchProgressState,
        *,
        current_file: str,
        current_progress: BatchItemProgress | None,
        status: str,
        force: bool = False,
        current_file_index: int | None = None,
    ) -> None:
        agent_context = tool_context.get_extension("agent_context")
        if agent_context is None:
            return

        try:
            async with progress_state.lock:
                progress, indeterminate = self._calculate_batch_progress(progress_state)
                if status in {"completed", "partial_failed"}:
                    progress = 100
                    indeterminate = False
                now = time.monotonic()
                percentage_changed = progress != progress_state.last_reported_progress
                interval_elapsed = (
                    now - progress_state.last_report_time >= PROGRESS_REPORT_INTERVAL_SECONDS
                )
                if not force and not interval_elapsed and not percentage_changed:
                    return

                progress_state.last_report_time = now
                progress_state.last_reported_progress = progress
                current = current_progress or BatchItemProgress()
                message_key = self._progress_message_key(status)
                message = i18n.translate(
                    message_key,
                    category="tool.messages",
                    file=current_file or "-",
                    progress=progress,
                    completed=progress_state.completed_files,
                    total=progress_state.total_files,
                    retry_count=current.retry_count,
                )
                arguments = {
                    "name": "download_from_urls",
                    "correlation_id": correlation_id,
                    "action": i18n.translate("download_from_urls", category="tool.actions"),
                    "detail": {
                        "type": "text",
                        "data": {
                            "progress": progress,
                            "downloaded_bytes": current.downloaded_bytes,
                            "total_bytes": current.total_bytes,
                            "current_file": current_file,
                            "completed_files": progress_state.completed_files,
                            "total_files": progress_state.total_files,
                            "resumed": current.resumed,
                            "retry_count": current.retry_count,
                            "status": status,
                            "indeterminate": indeterminate,
                            "message": message,
                        },
                    },
                    "status": status,
                }
                if current_file_index is not None:
                    arguments["detail"]["data"]["current_file_index"] = current_file_index
                event_data = PendingToolCallEventData(
                    tool_context=tool_context,
                    tool_name="download_from_urls",
                    arguments=arguments,
                    tool_instance=self,
                    correlation_id=correlation_id,
                )
                agent_context.update_activity_time()
                await agent_context.dispatch_event(EventType.PENDING_TOOL_CALL, event_data)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("发送下载进度事件失败: %s", exc)

    @staticmethod
    def _calculate_batch_progress(progress_state: BatchProgressState) -> tuple[int, bool]:
        items = list(progress_state.items.values())
        all_totals_known = all(item.total_bytes is not None and item.total_bytes > 0 for item in items)
        if all_totals_known:
            total_bytes = sum(int(item.total_bytes or 0) for item in items)
            downloaded_bytes = sum(min(item.downloaded_bytes, int(item.total_bytes or 0)) for item in items)
            return min(100, int(downloaded_bytes * 100 / total_bytes)), False

        if progress_state.total_files <= 0:
            return 0, True
        return min(100, int(progress_state.completed_files * 100 / progress_state.total_files)), True

    @staticmethod
    def _progress_message_key(status: str) -> str:
        if status == DownloadPhase.RETRYING.value:
            return "download_from_urls.progress_retrying"
        if status == "item_completed":
            return "download_from_urls.progress_file_completed"
        if status == "item_skipped":
            return "download_from_urls.progress_file_skipped"
        if status == "cancelled":
            return "download_from_urls.progress_cancelled"
        if status in {"completed", "partial_failed"}:
            return "download_from_urls.progress_completed"
        if status == "failed":
            return "download_from_urls.progress_failed"
        return "download_from_urls.progress_downloading"

    @staticmethod
    def _item_result_progress_status(status: str) -> str:
        """将单文件结果转换为批量任务的中间进度状态。"""
        if status == DownloadPhase.COMPLETED.value:
            return "item_completed"
        if status == "skipped":
            return "item_skipped"
        return status

    @staticmethod
    def _resolve_correlation_id(tool_context: ToolContext, agent_context: object | None) -> str:
        scope_id = getattr(agent_context, "context_id", None)
        correlation_id = get_correlation_manager().get_active_correlation_id(
            EventPairType.TOOL_CALL,
            scope_id,
        )
        return correlation_id or tool_context.tool_call_id or str(uuid.uuid4())

    @staticmethod
    def _raise_if_interrupted(interruption_event: asyncio.Event | None) -> None:
        if interruption_event is not None and interruption_event.is_set():
            raise asyncio.CancelledError

    @staticmethod
    def _summarize_results(results: list[dict[str, object]]) -> BatchDownloadResult:
        success = sum(1 for item in results if item.get("status") == "completed")
        skipped = sum(1 for item in results if item.get("status") == "skipped")
        failed = len(results) - success - skipped
        total_size_bytes = sum(
            int(item.get("file_size_bytes") or 0)
            for item in results
            if item.get("status") in {"completed", "skipped"}
        )
        return BatchDownloadResult(
            items=results,
            success=success,
            failed=failed,
            skipped=skipped,
            total_size_bytes=total_size_bytes,
        )

    def _build_model_summary(self, result: BatchDownloadResult) -> str:
        lines = [
            (
                f"Batch download finished: {result.success} completed, "
                f"{result.skipped} skipped, {result.failed} failed."
            )
        ]
        for item in result.items:
            file_path = str(item.get("file_path") or "unknown")
            status = str(item.get("status") or "failed")
            if status == "completed":
                lines.append(
                    f"- completed: {file_path} ({self._format_size(int(item.get('file_size_bytes') or 0))})"
                )
            elif status == "skipped":
                lines.append(f"- skipped: {file_path} (the target already exists)")
            else:
                resume_available = "yes" if item.get("resume_available") else "no"
                next_action = str(item.get("next_action") or "review_request")
                error = self._truncate(str(item.get("error") or "unknown error"), 240)
                lines.append(
                    f"- failed: {file_path}; {error}; resume available: {resume_available}; "
                    f"next action: {next_action}"
                )
        return "\n".join(lines)

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict[str, object] | None = None,
    ) -> ToolDetail | None:
        detailed_results = list((result.extra_info or {}).get("detailed_results") or [])
        if not detailed_results:
            return ToolDetail(
                type=DisplayType.TEXT,
                data={"message": self._truncate(result.content, 300)},
            )

        success = sum(1 for item in detailed_results if item.get("status") == "completed")
        skipped = sum(1 for item in detailed_results if item.get("status") == "skipped")
        failed = len(detailed_results) - success - skipped
        lines = [
            "# Batch Download Result",
            "",
            f"Completed: {success} · Skipped: {skipped} · Failed: {failed}",
            "",
        ]
        for item in detailed_results:
            file_path = str(item.get("file_path") or "unknown")
            status = str(item.get("status") or "failed")
            if status in {"completed", "skipped"}:
                size = self._format_size(int(item.get("file_size_bytes") or 0))
                lines.append(f"- {status}: `{file_path}` — {size}")
            else:
                error = self._truncate(str(item.get("error") or "Download failed"), 200)
                lines.append(f"- failed: `{file_path}` — {error}")

        report = ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name=f"Batch download ({success} completed, {failed} failed)",
                content="\n".join(lines),
            ),
        )

        items = [ToolDetailFactory.create_file_result_item(
            str(item["file_path"]), DownloadFromUrl().base_dir,
            OperationResultStatus.SUCCESS if item.get("status") == "completed" else
            OperationResultStatus.SKIPPED if item.get("status") == "skipped" else OperationResultStatus.ERROR,
            message=self._format_size(int(item.get("file_size_bytes") or 0)) if item.get("status") in {"completed", "skipped"}
            else i18n.translate("tool_card.download_failed", category="tool.messages"),
        ) for item in detailed_results]
        return ToolDetailFactory.create_operation_result_detail(items, report=report, stage="download")

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        result.use_custom_remark = True
        extra = result.extra_info or {}
        success = int(extra.get("success") or 0)
        failed = int(extra.get("failed") or 0)
        skipped = int(extra.get("skipped") or 0)
        if success > 0 and failed == 0:
            remark = i18n.translate(
                "download_from_urls.success_count",
                category="tool.messages",
                count=success,
                skipped=skipped,
            )
        elif success > 0 or skipped > 0:
            remark = i18n.translate(
                "download_from_urls.partial_success",
                category="tool.messages",
                success=success,
                failed=failed,
                skipped=skipped,
            )
        else:
            remark = i18n.translate(
                "download_from_urls.failed_count",
                category="tool.messages",
                count=failed,
            )
        return {
            "action": i18n.translate("download_from_urls", category="tool.actions"),
            "remark": remark,
        }

    @staticmethod
    def _format_size(size_bytes: int) -> str:
        size = float(size_bytes)
        for unit in ("B", "KB", "MB", "GB", "TB"):
            if size < 1024 or unit == "TB":
                return f"{int(size)} {unit}" if unit == "B" else f"{size:.2f} {unit}"
            size /= 1024
        return f"{size_bytes} B"

    @staticmethod
    def _truncate(text: str, max_length: int) -> str:
        return text if len(text) <= max_length else f"{text[: max_length - 1]}…"


__all__ = ["DownloadFromUrls", "DownloadFromUrlsParams", "DownloadTask"]
