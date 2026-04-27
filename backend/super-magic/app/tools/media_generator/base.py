"""媒体生成驱动抽象层

定义请求/响应数据类和 handler 抽象基类，各驱动实现 BaseImageGeneratorHandler 即可。
"""

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from agentlang.logger import get_logger
from agentlang.path_manager import PathManager
from app.utils.async_file_utils import async_close_fd, async_mkstemp

logger = get_logger(__name__)


class ImageGenerationProviderError(Exception):
    """Provider 级别的图片生成错误（非瞬时，不应重试）。

    当下游服务返回明确的业务错误码（如内容审核拦截、参数非法）时抛出。
    """

    def __init__(self, message: str, provider_error_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.provider_error_code = provider_error_code


@dataclass
class ImageGenerationRequest:
    """图片生成请求"""

    prompt: str
    model: str
    size: Optional[str] = None
    reference_image_urls: List[str] = field(default_factory=list)


@dataclass
class GeneratedImage:
    """单张生成图片，包含原始 URL 和本地临时文件路径"""

    image_url: str
    temp_file_path: str


@dataclass
class ImageGenerationResponse:
    """图片生成响应

    handler 负责将所有生成结果下载到本地临时文件，调用方直接对 temp_file_path 做文件操作即可，
    无需处理二进制流。调用方使用完毕后需负责清理各 GeneratedImage.temp_file_path。
    """

    images: List[GeneratedImage]
    _best_image_cache: Optional["GeneratedImage"] = field(default=None, init=False, repr=False)

    async def _pick_best_image(self) -> "GeneratedImage":
        """从候选图列表中选出分辨率最高的图片，结果缓存避免重复计算。

        API 返回多张图时（edit 模式偶发）以总像素数为指标取最大值，
        无法读取尺寸时回退到第一张。
        """
        if self._best_image_cache is not None:
            return self._best_image_cache

        if len(self.images) == 1:
            self._best_image_cache = self.images[0]
            return self._best_image_cache

        from PIL import Image as PILImage

        async def _read_pixels(img: GeneratedImage) -> float:
            try:
                def _open(p: str) -> tuple[int, int]:
                    with PILImage.open(p) as im:
                        return im.size

                w, h = await asyncio.to_thread(_open, img.temp_file_path)
                return float(w * h)
            except Exception as e:
                logger.warning(f"读取临时图片尺寸失败 {img.temp_file_path}: {e}")
                return -1.0

        pixel_counts = await asyncio.gather(*[_read_pixels(img) for img in self.images])
        best_idx = max(range(len(self.images)), key=lambda i: pixel_counts[i])
        best = self.images[best_idx]
        if best_idx != 0:
            logger.info(
                f"多图候选：共 {len(self.images)} 张，选取分辨率最高的图片 "
                f"(index={best_idx}, pixels={pixel_counts[best_idx]:.0f})"
            )
        self._best_image_cache = best
        return self._best_image_cache


class BaseImageGeneratorHandler(ABC):
    """图片生成驱动抽象基类"""

    def __init__(self) -> None:
        self._downloader = None  # 懒初始化，复用 DownloadFromUrl 的下载基础设施

    def _get_downloader(self):
        """懒加载 DownloadFromUrl 实例，复用其缓存、锁、重试、header 等下载能力。"""
        if self._downloader is None:
            from app.tools.download_from_url import DownloadFromUrl
            self._downloader = DownloadFromUrl(base_dir=PathManager.get_workspace_dir())
        return self._downloader

    async def _download_image(self, image_url: str) -> GeneratedImage:
        """
        将单个图片 URL 下载到临时文件，0 字节时自动重试一次。

        Returns:
            GeneratedImage，调用方负责清理 temp_file_path。

        Raises:
            ValueError: 两次下载均为空文件。
        """
        downloader = self._get_downloader()
        suffix = Path(image_url.split("?")[0]).suffix or ".jpg"

        for attempt in range(2):
            tmp_fd, tmp_path = await async_mkstemp(suffix=suffix)
            await async_close_fd(tmp_fd)
            result = await downloader.download_file(image_url, Path(tmp_path))
            if result.file_size > 0:
                logger.info(f"图片已下载到临时文件: {tmp_path} ({result.file_size} 字节)")
                return GeneratedImage(image_url=image_url, temp_file_path=tmp_path)
            logger.warning(f"下载图片为空文件 (attempt={attempt + 1}/2): {image_url}")

        raise ValueError(f"Downloaded image is empty after 2 attempts: {image_url}")

    async def _download_images(self, image_urls: List[str]) -> List[GeneratedImage]:
        """并发下载多个图片 URL 到临时文件。"""
        results = await asyncio.gather(*[self._download_image(url) for url in image_urls])
        return list(results)

    @property
    @abstractmethod
    def name(self) -> str:
        """驱动名称，用于日志和配置标识"""

    @abstractmethod
    def is_available(self) -> bool:
        """检查当前驱动是否可用（配置是否完整）"""

    @abstractmethod
    async def generate(self, request: ImageGenerationRequest) -> ImageGenerationResponse:
        """执行图片生成，返回含本地临时文件路径的响应"""
