"""Canvas 主文件仓储抽象接口。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Awaitable, Callable, TypeVar

from app.tools.canvas.domain.models import CanvasProject

T = TypeVar("T")
RollbackCallback = Callable[[], None | Awaitable[None]]


class CanvasRepositoryInterface(ABC):
    """定义 Application 使用的 Canvas 持久化边界。"""

    @property
    @abstractmethod
    def workspace(self) -> Path:
        """基础工作区路径，所有项目路径都基于它解析；只读，禁止外部修改。"""

    @abstractmethod
    async def initialize(self, project_path: str) -> tuple[Any, bool]:
        """初始化或读取一个 Canvas 项目目录。"""

    @abstractmethod
    async def read(self, project_path: str) -> CanvasProject:
        """读取并校验当前 Canvas 项目。"""

    @abstractmethod
    async def transaction(
        self,
        project_path: str,
        mutator: Callable[[CanvasProject], T | Awaitable[T]],
    ) -> T:
        """在项目锁内执行主文件事务。"""

    @abstractmethod
    async def transaction_with_sidecar(
        self,
        project_path: str,
        mutator: Callable[[CanvasProject, dict], tuple[T, dict] | Awaitable[tuple[T, dict]]],
        filename: str = "element-details.json",
        on_rollback: RollbackCallback | None = None,
    ) -> T:
        """在项目锁内执行主文件和 sidecar 联合事务，并回滚关联资源。"""

    @abstractmethod
    async def read_sidecar(self, project_path: str, filename: str = "element-details.json") -> dict:
        """读取可选 sidecar。"""

    @abstractmethod
    async def read_sidecar_runtime(self, project_path: str) -> dict:
        """读取生成任务运行态 sidecar。"""

    @abstractmethod
    async def write_sidecar(self, project_path: str, data: dict, filename: str = "element-details.json") -> None:
        """写入 sidecar。"""
