"""原生视觉用户消息构造服务。"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from agentlang.chat_history.chat_history_models import UserMessage, UserMessageContentPart
from agentlang.logger import get_logger
from app.service.browser.browser_screenshot_artifact import BrowserScreenshotArtifactStore
from app.tools.visual_understanding_utils import (
    ImageDimensionInfo,
    format_image_dimensions_info,
    get_image_dimensions,
)

logger = get_logger(__name__)

_NATIVE_VISUAL_HORIZON_HINT = (
    "The image(s) in this user message are already available as native visual input. "
    "When the user asks about them, answer directly from the images and do not request "
    "or process the same images again. "
    "Use the provided image dimensions and file sizes as metadata when relevant."
)


class NativeVisualMessageBuilder:
    """构造原生视觉用户消息及其 Horizon 上下文。"""

    def __init__(self, workspace_dir: str | Path) -> None:
        """初始化消息构造器并固定当前工作区边界。"""
        self.workspace_dir = Path(workspace_dir).expanduser().resolve()

    async def build_user_message(
        self,
        query: str,
        image_refs: List[str],
        *,
        show_in_ui: bool = True,
        source: Optional[str] = None,
    ) -> UserMessage:
        """构造只包含用户问题和图片引用的 UserMessage。"""
        content_parts = [UserMessageContentPart.text_part(query)]
        content_parts.extend(
            UserMessageContentPart.image_ref(self._normalize_image_ref(image_ref))
            for image_ref in dict.fromkeys(image_refs)
        )
        return UserMessage(
            content=query,
            show_in_ui=show_in_ui,
            source=source,
            content_parts=content_parts,
        )

    async def build_horizon_hint(self, image_refs: List[str]) -> str:
        """构造一次性原生视觉机制与图片元数据 Horizon 提示。"""
        normalized_refs = [
            self._normalize_image_ref(image_ref)
            for image_ref in dict.fromkeys(image_refs)
        ]
        dimensions_info = await self._get_dimensions_info(normalized_refs)
        if not dimensions_info:
            return _NATIVE_VISUAL_HORIZON_HINT
        return f"{_NATIVE_VISUAL_HORIZON_HINT}\n\n{dimensions_info}"

    def _normalize_image_ref(self, image_ref: str) -> str:
        """将 workspace 内图片转换为相对引用，artifact 引用和外部图片保持稳定。"""
        if BrowserScreenshotArtifactStore.is_source_ref(image_ref):
            return image_ref
        path = Path(image_ref).expanduser()
        if not path.is_absolute():
            path = (self.workspace_dir / path).resolve()
        else:
            path = path.resolve()
        try:
            return path.relative_to(self.workspace_dir).as_posix()
        except ValueError:
            return str(path)

    async def _get_dimensions_info(self, image_refs: List[str]) -> str:
        """读取图片尺寸、宽高比和文件大小并格式化为模型提示。"""
        dimension_infos: List[Optional[ImageDimensionInfo]] = []
        for image_ref in image_refs:
            if BrowserScreenshotArtifactStore.is_source_ref(image_ref):
                dimension_infos.append(None)
                continue
            try:
                image_path = Path(image_ref).expanduser()
                if not image_path.is_absolute():
                    image_path = self.workspace_dir / image_path
                image_size, aspect_ratio, file_size = await get_image_dimensions(str(image_path))
                dimension_infos.append(
                    ImageDimensionInfo(
                        size=image_size,
                        aspect_ratio=aspect_ratio,
                        file_size=file_size,
                    )
                )
            except Exception as exc:
                logger.debug("读取原生视觉图片元数据失败: image=%s error=%s", image_ref, exc)
                dimension_infos.append(None)
        return format_image_dimensions_info(dimension_infos, image_refs)
