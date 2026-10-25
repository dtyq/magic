"""Canvas 项目初始化用例服务。"""

from __future__ import annotations

from app.tools.canvas.application.results import InitializeCanvasResult
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface


class InitializationService:
    """创建或复用 Canvas 项目，不处理 Element 业务。"""

    def __init__(self, repository: CanvasRepositoryInterface):
        """显式注入项目仓储。"""
        self.repository = repository

    async def initialize(self, project_path: str) -> InitializeCanvasResult:
        """创建或复用一个 Canvas 项目。"""
        path, created = await self.repository.initialize(project_path)
        return InitializeCanvasResult(project_path, path.name, created)
