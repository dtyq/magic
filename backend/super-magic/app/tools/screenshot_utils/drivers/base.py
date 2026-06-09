from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class ScreenshotResultItem:
    """截图结果数据"""
    file_path: Path            # 截图文件保存路径
    format: str = "png"        # 图片格式
    width: int = 0             # 视窗宽度
    height: int = 0            # 视窗高度
    file_size: int = 0         # 文件大小（字节）


class ScreenshotDriverInterface(ABC):
    """截图驱动接口"""

    @abstractmethod
    def is_available(self) -> bool:
        """检查驱动是否可用"""
        ...

    @abstractmethod
    async def screenshot(
        self,
        url: str,
        dest: Path,
        full_page: bool = False,
        width: int = 1280,
        height: int = 720,
        wait_for: Optional[str] = None,
        format: str = "png",
    ) -> ScreenshotResultItem:
        """
        对目标 URL 进行截图并保存到指定路径。

        Args:
            url: 目标网页 URL
            dest: 截图保存路径
            full_page: 是否截取整页
            width: 视窗宽度
            height: 视窗高度
            wait_for: 等待指定 CSS 选择器出现后再截图
            format: 图片格式 (png/jpeg)

        Returns:
            ScreenshotResultItem: 截图结果

        Raises:
            Exception: 截图失败时抛出异常
        """
        ...
