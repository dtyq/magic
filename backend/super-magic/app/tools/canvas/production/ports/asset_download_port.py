"""素材下载端口。"""

from abc import ABC, abstractmethod
from pathlib import Path


class AssetDownloadPort(ABC):
    """定义从外部 URL 下载到工作区的最小能力。"""

    @abstractmethod
    async def download(self, url: str, target_path: Path) -> None:
        """下载一个非空文件并原子落盘。"""
