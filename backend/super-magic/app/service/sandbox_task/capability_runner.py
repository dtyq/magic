"""沙箱任务能力分发。"""

from typing import Any, Awaitable, Callable

from app.service.sandbox_task.models import SandboxTask, SandboxTaskStatus
from app.service.sandbox_task.video_composition_capability import VideoCompositionCapability
from app.service.sandbox_task.workspace_export_capability import run_workspace_export


async def run_capability(
    task: SandboxTask,
    update_status: Callable[[SandboxTaskStatus], Awaitable[None]],
) -> dict[str, Any]:
    """根据 capability 执行沙箱任务。"""
    if task.capability == "video_composition":
        return await VideoCompositionCapability().execute(task, update_status)
    if task.capability == "workspace_export":
        return await run_workspace_export(task, update_status)
    raise ValueError(f"Unsupported sandbox capability: {task.capability}")
