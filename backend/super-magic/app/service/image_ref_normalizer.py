"""Agent 图片引用的应用层规范化服务。"""

import asyncio
from pathlib import Path
from typing import List, Sequence

from agentlang.logger import get_logger
from app.utils.async_file_utils import async_is_file

logger = get_logger(__name__)


class ImageRefNormalizer:
    """在进入 agentlang 前规范化并校验图片引用的工作区边界。"""

    def __init__(self, workspace_dir: str | Path) -> None:
        """初始化当前请求使用的工作区边界。"""
        self.workspace_dir = Path(workspace_dir).expanduser().resolve()

    async def normalize(self, image_refs: Sequence[str]) -> List[str]:
        """规范化图片引用，保留工作区相对路径和可用的外部绝对路径。"""
        normalized_refs: List[str] = []
        for raw_path in image_refs:
            try:
                raw = Path(raw_path).expanduser()
                path = await asyncio.to_thread(
                    raw.resolve if raw.is_absolute() else (self.workspace_dir / raw).resolve
                )
                if not await async_is_file(path):
                    logger.warning("忽略不存在的图片引用: %s", raw_path)
                    continue

                try:
                    workspace_path = path.relative_to(self.workspace_dir)
                    normalized_refs.append(workspace_path.as_posix())
                except ValueError:
                    if raw.is_absolute():
                        normalized_refs.append(str(path))
                    else:
                        logger.warning("忽略不在工作区内的图片引用: %s", raw_path)
            except (ValueError, OSError):
                logger.warning("忽略无法解析的图片引用: %s", raw_path)

        return normalized_refs
