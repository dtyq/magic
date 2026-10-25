"""Canvas 工作区文件可见性检查。"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from stat import S_ISREG

from app.utils.async_file_utils import async_exists, async_stat


class CanvasFileReadinessChecker:
    """等待 MagicFS 工作区文件达到可消费状态。"""

    def __init__(self, workspace: Path, retry_delay: float = 0.2, max_attempts: int = 5) -> None:
        """保存工作区路径和默认重试参数。"""
        from app.tools.canvas.infrastructure.assets.project_asset_path_resolver import ProjectAssetPathResolver

        self._path_resolver = ProjectAssetPathResolver(workspace)
        self._retry_delay = max(0.0, retry_delay)
        self._max_attempts = max(1, max_attempts)

    async def wait_for_uri(
        self,
        project_path: str,
        uri: str | None,
        deadline: float | None = None,
    ) -> bool:
        """等待项目 URI 对应的本地文件可见；供应商 URI 不需要本地检查。"""
        if not uri or "://" in uri or uri.startswith("data:"):
            return True
        path = self._path_resolver.resolve_workspace_path_for_project(project_path, uri)
        return await self.wait_for_path(path, deadline=deadline)

    async def wait_for_path(self, path: Path, deadline: float | None = None) -> bool:
        """在有限时间内等待普通文件存在且大小大于零。"""
        for attempt in range(self._max_attempts):
            if await self._is_ready(path):
                return True
            if attempt >= self._max_attempts - 1:
                break
            if deadline is not None:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                await asyncio.sleep(min(self._retry_delay, remaining))
            else:
                await asyncio.sleep(self._retry_delay)
        return await self._is_ready(path)

    @staticmethod
    async def _is_ready(path: Path) -> bool:
        """判断路径是否已成为可读取的非空普通文件。"""
        if not await async_exists(path):
            return False
        file_stat = await async_stat(path)
        return S_ISREG(file_stat.st_mode) and file_stat.st_size > 0
