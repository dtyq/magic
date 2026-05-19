from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


@dataclass
class DownloadResultItem:
    """下载结果数据"""
    file_path: Path           # 下载文件保存路径
    content_type: str         # HTTP Content-Type
    file_size: int            # 文件大小（字节）
    final_url: str            # 最终 URL（重定向后）
    filename: str = ""        # 原始文件名（如果可获取）


class DownloadDriverInterface(ABC):
    """下载驱动接口"""

    @abstractmethod
    def is_available(self) -> bool:
        """检查驱动是否可用"""
        ...

    @abstractmethod
    async def download(self, url: str, dest: Path, timeout: int = 15) -> DownloadResultItem:
        """
        下载文件到指定路径。

        Args:
            url: 要下载的 URL
            dest: 目标文件路径
            timeout: 超时时间（秒）

        Returns:
            DownloadResultItem: 下载结果

        Raises:
            Exception: 下载失败时抛出异常
        """
        ...
