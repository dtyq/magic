"""基于 workspace 文件列表执行异步视频合成。"""

from typing import Any, Awaitable, Callable

from app.path_manager import PathManager
from app.service.file_service import FileService
from app.service.sandbox_task.models import SandboxTask, SandboxTaskStatus
from app.tools.canvas.production.adapters.ffmpeg_video_composition_port import (
    FfmpegVideoCompositionPort,
)
from app.tools.canvas.production.services.file_video_composition_service import (
    FileVideoCompositionService,
)


class VideoCompositionCapability:
    """在沙箱 workspace 中按指定文件顺序生成 MP4，不读取 Canvas DSL。"""

    def __init__(self) -> None:
        """初始化文件合成服务和 FFmpeg 适配器。"""
        self._adapter = FfmpegVideoCompositionPort()
        self._composition_service = FileVideoCompositionService(self._adapter)

    async def execute(
        self,
        task: SandboxTask,
        update_status: Callable[[SandboxTaskStatus], Awaitable[None]],
    ) -> dict[str, Any]:
        """读取指定媒体文件并生成 MP4，不修改 Canvas 或 magic.project.js。"""
        await update_status(SandboxTaskStatus.PREPARING)
        payload = task.payload
        composition = payload.get("composition") if isinstance(payload.get("composition"), dict) else {}
        generation = payload.get("generation") if isinstance(payload.get("generation"), dict) else {}
        output_file_name = str(payload.get("output_file_name") or payload.get("file_name") or "")
        plan = await self._composition_service.build_plan(
            workspace_dir=PathManager.get_workspace_dir().resolve(),
            file_dir=str(payload.get("file_dir") or ""),
            composition=composition,
            generation=generation,
            output_file_name=output_file_name,
            task_id=task.task_id,
        )
        await update_status(SandboxTaskStatus.RUNNING)
        result = await self._adapter.compose(plan.request)
        await update_status(SandboxTaskStatus.FINALIZING)
        file_url = None
        try:
            file_url = await FileService().get_workspace_file_url(plan.request.output_path)
        except Exception:
            # 本地开发时文件可能尚未有 MagicFS xattr，路径仍可用于本地调试。
            file_url = None
        return {
            "file_path": plan.output_relative_path,
            "file_url": file_url,
            "width": result.width,
            "height": result.height,
            "duration_seconds": result.duration_seconds,
            "has_audio": result.has_audio,
        }
