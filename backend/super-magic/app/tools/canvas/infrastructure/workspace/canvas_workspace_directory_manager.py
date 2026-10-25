"""Canvas 项目工作区目录管理。"""

from __future__ import annotations

from pathlib import Path
from stat import S_ISDIR

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.repository.canvas_path_resolver import CanvasPathResolver
from app.utils.async_file_utils import async_exists, async_mkdir, async_stat


class CanvasWorkspaceDirectoryManager:
    """保证 Canvas 项目所需的本地媒体目录存在且类型正确。"""

    REQUIRED_DIRECTORIES = ("images", "videos", "audios")

    def __init__(self, workspace: Path):
        """保存工作区根目录。"""
        self.workspace = workspace

    async def ensure_project(self, project_path: str) -> Path:
        """创建项目根目录，并确保项目媒体目录存在。"""
        project_root = CanvasPathResolver.resolve(self.workspace, project_path)
        await async_mkdir(project_root, parents=True, exist_ok=True)
        await self.ensure_media_directories(project_path)
        return project_root

    async def ensure_media_directories(self, project_path: str) -> Path:
        """检测并修复项目的本地媒体目录，拒绝同名普通文件。"""
        project_root = CanvasPathResolver.resolve(self.workspace, project_path)
        if not await async_exists(project_root):
            raise FileNotFoundError("PROJECT_NOT_FOUND")
        if not S_ISDIR((await async_stat(project_root)).st_mode):
            raise CanvasDomainError(
                "CANVAS_PROJECT_DIRECTORY_INVALID",
                f"Canvas project path is not a directory: {project_path}.",
            )

        for directory_name in self.REQUIRED_DIRECTORIES:
            directory = project_root / directory_name
            if await async_exists(directory):
                if not S_ISDIR((await async_stat(directory)).st_mode):
                    raise CanvasDomainError(
                        "CANVAS_MEDIA_DIRECTORY_INVALID",
                        f"Canvas media path is not a directory: {directory_name}.",
                    )
                continue
            await async_mkdir(directory, parents=False, exist_ok=True)
            if not S_ISDIR((await async_stat(directory)).st_mode):
                raise CanvasDomainError(
                    "CANVAS_MEDIA_DIRECTORY_INVALID",
                    f"Canvas media path is not a directory: {directory_name}.",
                )
        return project_root

    @classmethod
    def project_directory_parts(cls, project_path: str, media_directory: str) -> list[str]:
        """把项目路径和媒体目录转换为 Magic Service 文件树路径。"""
        normalized = project_path.strip().strip("/")
        parts = list(Path(normalized).parts)
        if not parts or any(part in {"", ".", ".."} for part in parts):
            raise ValueError("PROJECT_PATH_INVALID")
        if media_directory not in cls.REQUIRED_DIRECTORIES:
            raise ValueError("CANVAS_MEDIA_DIRECTORY_INVALID")
        return [*parts, media_directory]
