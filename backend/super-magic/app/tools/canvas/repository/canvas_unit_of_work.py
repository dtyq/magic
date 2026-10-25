"""Canvas Unit of Work 事务边界。"""

from __future__ import annotations

from typing import Awaitable, Callable, TypeVar

from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import (
    CanvasRepositoryInterface,
    RollbackCallback,
)

T = TypeVar("T")

class CanvasUnitOfWork:
    """封装一个 Canvas 用例的项目锁和原子提交边界。"""

    def __init__(self, repository: CanvasRepositoryInterface):
        """保存主文件仓储，避免 Application 直接编排事务细节。"""
        self.repository = repository

    async def transaction(
        self,
        project_path: str,
        mutator: Callable[[CanvasProject], T | Awaitable[T]],
    ) -> T:
        """执行只修改主文件的原子用例。"""
        return await self.repository.transaction(project_path, mutator)

    async def transaction_with_sidecar(
        self,
        project_path: str,
        mutator: Callable[[CanvasProject, dict], tuple[T, dict] | Awaitable[tuple[T, dict]]],
        filename: str = "element-details.json",
        on_rollback: RollbackCallback | None = None,
    ) -> T:
        """执行主文件、backend sidecar 和关联资源的联合提交。"""
        return await self.repository.transaction_with_sidecar(
            project_path,
            mutator,
            filename,
            on_rollback,
        )
