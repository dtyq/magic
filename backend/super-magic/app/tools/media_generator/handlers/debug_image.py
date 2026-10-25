"""本地图片生成 Handler。"""

import asyncio
import re
from pathlib import Path

from PIL import Image as PILImage
from PIL import ImageOps

from app.tools.media_generator.base import (
    BaseImageGeneratorHandler,
    GeneratedImage,
    ImageGenerationRequest,
    ImageGenerationResponse,
    ImageTaskCreatedCallback,
)
from app.utils.async_file_utils import async_close_fd, async_exists, async_mkstemp


class DebugImageGeneratorHandler(BaseImageGeneratorHandler):
    """使用固定本地素材模拟图片生成。"""

    _ASSET_PATH = Path(__file__).resolve().parents[1] / "assets" / "mock_media" / "mock-image.jpg"

    @property
    def name(self) -> str:
        """返回 Handler 名称。"""
        return "debug"

    def is_available(self) -> bool:
        """判断本地模拟素材是否存在。"""
        return self._ASSET_PATH.is_file()

    async def generate(
        self,
        request: ImageGenerationRequest,
        on_task_created: ImageTaskCreatedCallback | None = None,
    ) -> ImageGenerationResponse:
        """按请求尺寸生成一个本地临时图片结果。

        本地模拟没有任务创建阶段，故不触发 on_task_created。
        """
        if not await async_exists(self._ASSET_PATH):
            raise FileNotFoundError(f"Mock image asset is missing: {self._ASSET_PATH.name}")

        file_descriptor, temp_path = await async_mkstemp(suffix=".jpg")
        await async_close_fd(file_descriptor)
        target_size = self._parse_size(request.size)
        await asyncio.to_thread(self._render_image, temp_path, target_size)
        return ImageGenerationResponse(
            images=[
                GeneratedImage(
                    image_url=f"debug://{self._ASSET_PATH.name}",
                    temp_file_path=temp_path,
                )
            ]
        )

    @classmethod
    def _render_image(cls, temp_path: str, target_size: tuple[int, int] | None) -> None:
        """同步完成图片缩放和补边。"""
        with PILImage.open(cls._ASSET_PATH) as source:
            image = source.convert("RGB")
            if target_size is not None:
                contained = ImageOps.contain(image, target_size)
                canvas = PILImage.new("RGB", target_size, "black")
                offset = (
                    (target_size[0] - contained.width) // 2,
                    (target_size[1] - contained.height) // 2,
                )
                canvas.paste(contained, offset)
                image = canvas
            image.save(temp_path, format="JPEG", quality=92)

    @staticmethod
    def _parse_size(size: str | None) -> tuple[int, int] | None:
        """解析 WxH 图片尺寸，无法解析时使用素材原尺寸。"""
        if not size:
            return None
        match = re.fullmatch(r"\s*(\d+)\s*[xX×]\s*(\d+)\s*", size)
        if match is None:
            return None
        width, height = int(match.group(1)), int(match.group(2))
        return (width, height) if width > 0 and height > 0 else None
