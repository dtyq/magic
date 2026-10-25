"""工作区异步导出任务能力。"""

from typing import Any, Awaitable, Callable

from app.service.sandbox_task.models import SandboxTask, SandboxTaskStatus
from app.service.workspace_export_service import export_workspace


async def run_workspace_export(
    task: SandboxTask,
    update_status: Callable[[SandboxTaskStatus], Awaitable[None]],
) -> dict[str, Any]:
    """执行工作区打包上传，并返回文件 key 与元数据。"""
    await update_status(SandboxTaskStatus.PREPARING)
    await update_status(SandboxTaskStatus.RUNNING)
    payload = task.payload
    result = await export_workspace(
        export_type=str(payload.get("type") or ""),
        code=str(payload.get("code") or ""),
        upload_config=payload.get("upload_config") or {},
        public_upload_config=payload.get("public_upload_config"),
        source_path=str(payload.get("source_path") or ""),
        archive_root=str(payload.get("archive_root") or ""),
        file_name=str(payload.get("file_name") or ""),
        exclude_paths=payload.get("exclude_paths"),
        skills_md_hash=payload.get("skills_md_hash"),
        progress_callback=lambda: update_status(SandboxTaskStatus.FINALIZING),
    )
    return result
