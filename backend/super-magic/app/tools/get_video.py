"""Query and download regular video generation tasks."""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Dict, Literal

from pydantic import Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.event.data import PendingToolCallEventData
from agentlang.event.event import EventType
from agentlang.utils.file import generate_safe_filename
from app.i18n import i18n
from app.core.entity.tool.tool_result import VideoToolResult
from app.tools.generate_video import GenerateVideo
from app.tools.core import BaseToolParams


class GetVideoParams(BaseToolParams):
    operation_id: str = Field(
        "",
        description="""<!--zh: 已创建的视频任务 ID。-->
Video operation ID returned by generate_video.
""",
    )
    wait_mode: Literal["once", "until_complete"] = Field(
        "until_complete",
        description="""<!--zh: once 只查询一次；until_complete 等待任务完成。-->
Query once, or wait until the task reaches a terminal status.
""",
    )
    video_name: str = Field(
        "",
        description="""<!--zh: 输出文件名（不含扩展名）。-->
Output filename stem without extension.
""",
    )
    output_path: str = Field(
        "videos",
        description="""<!--zh: 工作区内的视频保存目录。-->
Workspace-relative output directory.
""",
    )
    override: bool = Field(
        False,
        description="""<!--zh: 是否覆盖同名视频文件。-->
Whether to overwrite an existing video.
""",
    )

    @model_validator(mode="after")
    def validate_operation_id(self) -> "GetVideoParams":
        if not self.operation_id.strip():
            raise ValueError("The query action requires operation_id")
        return self


class GetVideo(GenerateVideo):
    """Query and download a regular video generation task."""

    _is_tool = False

    # Internal service helper; intentionally excluded from tool discovery.
    _is_tool = False

    name = "get_video"
    params_class = GetVideoParams
    MAX_WAIT_SECONDS = 1800
    POLL_INTERVAL_SECONDS = 10

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
调用流程：
1. 调用 generate_video 创建视频任务并取得 operation_id。
2. 将返回的 operation_id 传给 get_video 查询并下载视频。

通常使用默认的 wait_mode="until_complete" 持续等待结果；仅当用户只想查看当前状态时，使用 wait_mode="once" 只查询一次。
同一 operation_id 应持续复用，不要重复创建任务。
-->
Usage:
1. Call generate_video to create a video task and obtain an operation_id.
2. Pass its operation_id to get_video to query and download the video.

Normally keep the default wait_mode="until_complete" to wait and poll until completion. Use wait_mode="once" only when the user wants to query the current status once.
Keep reusing the same operation_id. Do not create a duplicate task.
"""

    async def execute(
        self, tool_context: ToolContext, params: GetVideoParams
    ) -> VideoToolResult:
        return await self.execute_purely(tool_context, params)

    async def execute_purely(
        self, tool_context: ToolContext, params: GetVideoParams
    ) -> VideoToolResult:
        operation_id = params.operation_id.strip()
        request_id = self._request_id()
        started_at = time.monotonic()
        operation: Dict[str, Any] = {}
        try:
            while True:
                operation = await self._get_magic_service_client().get_video_operation(
                    operation_id, request_id=request_id
                )
                status = self._status(operation)
                data = self._operation_data(operation, operation_id, status)
                if status in {"succeeded", "failed", "canceled"}:
                    if status != "succeeded":
                        return self._operation_failure_result(operation, operation_id, status)
                    return await self._download_succeeded_video(
                        tool_context, params, operation, data
                    )

                if params.wait_mode == "once":
                    return VideoToolResult(
                        ok=True,
                        content=(
                            f"Video task is still processing. Task ID: {operation_id}. "
                            f"Current status: {status}. Call get_video again later."
                        ),
                        videos=[],
                        data=data,
                        extra_info={"operation_id": operation_id, "status": status},
                    )
                elapsed = time.monotonic() - started_at
                if elapsed >= self.MAX_WAIT_SECONDS:
                    data["timed_out"] = True
                    return VideoToolResult(
                        ok=True,
                        content=(
                            f"Video task is still processing. Task ID: {operation_id}. "
                            f"Current status: {status}. Call get_video again later."
                        ),
                        videos=[],
                        data=data,
                        extra_info={
                            "operation_id": operation_id,
                            "status": status,
                            "timed_out": True,
                        },
                    )
                await self._dispatch_progress(tool_context, operation_id, status, elapsed)
                await asyncio.sleep(self.POLL_INTERVAL_SECONDS)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            content, error_code = self._exception_content(exc, "query")
            return VideoToolResult(
                ok=False,
                content=content,
                videos=[],
                data={
                    "operation": operation or None,
                    "operation_id": operation_id,
                    "status": self._status(operation) or "unknown",
                    "error_code": error_code,
                    "points_deducted": False,
                },
                extra_info={
                    "operation_id": operation_id,
                    "status": self._status(operation) or "unknown",
                    "error_code": error_code,
                    "points_deducted": False,
                },
            )

    async def _download_succeeded_video(
        self,
        tool_context: ToolContext,
        params: GetVideoParams,
        operation: Dict[str, Any],
        data: Dict[str, Any],
    ) -> VideoToolResult:
        video_url = ((operation.get("output") or {}).get("video_url"))
        if not video_url:
            raise ValueError("Video task succeeded but output.video_url is missing")
        stem = self._safe_video_name(params.video_name or params.operation_id)
        saved_path, relative = await self._download_video(
            tool_context, video_url, params.output_path, stem, params.override
        )
        data["saved_video_relative_path"] = relative
        result = VideoToolResult(
            ok=True,
            content=f"Video generated successfully. Saved to: {relative}.",
            videos=[saved_path],
            data=data,
            extra_info={
                "operation_id": data["operation_id"],
                "status": data["status"],
                "saved_video_relative_path": relative,
            },
        )
        result.video_url = saved_path
        return result

    async def _dispatch_progress(
        self,
        tool_context: ToolContext | None,
        operation_id: str,
        status: str,
        elapsed: float,
    ) -> None:
        if tool_context is None:
            return
        agent_context = tool_context.get_extension("agent_context")
        if agent_context is None:
            return
        event_data = PendingToolCallEventData(
            tool_context=tool_context,
            tool_name="get_video",
            arguments={
                "name": "get_video",
                "action": i18n.translate("video_generation_progress", category="tool.actions"),
                "detail": {
                    "type": "text",
                    "data": {
                        "operation_id": operation_id,
                        "status": status,
                        "elapsed_seconds": round(elapsed),
                    },
                },
                "status": status,
            },
            tool_instance=self,
            correlation_id=getattr(tool_context, "tool_call_id", None),
        )
        agent_context.update_activity_time()
        await agent_context.dispatch_event(EventType.PENDING_TOOL_CALL, event_data)

    @staticmethod
    def _request_id() -> str:
        return str(uuid.uuid4())

    @staticmethod
    def _safe_video_name(value: str) -> str:
        return generate_safe_filename(value) or "video"
