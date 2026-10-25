"""视频生成请求输入转换工具。

负责在视频请求发送前，将本地参考图片转换为 magic-service 约定的
Base64 结构。画布中持久化的请求仍由调用方保留为路径形式。
"""

from __future__ import annotations

import re
import tempfile
from pathlib import Path
from typing import Any, Dict

from agentlang.config.config import config
from agentlang.logger import get_logger
from app.tools.video_generation_utils.provider_asset_uri import normalize_provider_asset_uri
from app.tools.visual_understanding_utils.image_conversion_utils import (
    convert_unsupported_format_to_jpeg,
    local_file_to_base64,
)
from app.tools.visual_understanding_utils.image_format_utils import (
    get_content_type_for_local_file,
)

logger = get_logger(__name__)

_ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
_BASE64_COMPRESS_THRESHOLD_MB = 3.0
_DATA_URL_PATTERN = re.compile(r"^data:(?P<mime>[^;,]+);base64,(?P<data>.+)$", re.DOTALL)


class VideoInputPayloadBuilder:
    """构建视频生成服务可接受的参考图片输入。"""

    def __init__(self, workspace_root: Path):
        self._workspace_root = workspace_root.expanduser().resolve()

    @property
    def enabled(self) -> bool:
        """读取视频参考图片 Base64 开关，默认关闭。"""
        return config.get("video_generator.use_base64_reference_images", False) is True

    async def build_image_input(self, source_path: str) -> Dict[str, Any]:
        """将单个本地图片转换为 magic-service 的 Base64 输入结构。"""
        normalized_provider_uri = normalize_provider_asset_uri(source_path)
        if normalized_provider_uri is not None:
            # 供应商素材库中的 URI 不属于 workspace 文件，必须原样交给 magic-service。
            return {"uri": normalized_provider_uri}
        resolved_path = self._resolve_path(source_path)
        if not resolved_path.is_file():
            raise FileNotFoundError(f"视频参考图片不存在: {source_path}")

        mime_type = (await get_content_type_for_local_file(str(resolved_path)) or "").split(";", 1)[0]
        encoding_path = resolved_path
        if mime_type not in _ALLOWED_IMAGE_MIME_TYPES:
            converted_path = await convert_unsupported_format_to_jpeg(
                str(resolved_path),
                str(Path(tempfile.gettempdir()) / "super-magic" / "video-base64"),
            )
            if not converted_path:
                raise ValueError(f"视频参考图片格式不受支持: {source_path}")
            encoding_path = Path(converted_path).resolve()
            mime_type = "image/jpeg"

        data_url = await local_file_to_base64(
            str(encoding_path),
            # 不固定传入原始 MIME，避免压缩后文件已变成 JPEG 但仍标记为 PNG。
            "",
            compress_threshold_mb=_BASE64_COMPRESS_THRESHOLD_MB,
        )
        match = _DATA_URL_PATTERN.match(data_url)
        if not match:
            raise ValueError(f"视频参考图片 Base64 编码失败: {source_path}")

        base64_data = match.group("data")
        final_mime_type = match.group("mime").lower()
        if final_mime_type not in _ALLOWED_IMAGE_MIME_TYPES:
            raise ValueError(f"视频参考图片 MIME 类型不受支持: {final_mime_type}")

        logger.info(
            "视频参考图片已转换为 Base64: path=%s mime_type=%s encoded_length=%s",
            source_path,
            final_mime_type,
            len(base64_data),
        )
        return {
            "source_type": "base64",
            "base64_data": base64_data,
            "mime_type": final_mime_type,
        }

    def _resolve_path(self, source_path: str) -> Path:
        """解析绝对路径或 workspace 相对路径。"""
        candidate = Path(source_path).expanduser()
        if candidate.is_absolute():
            return candidate.resolve()
        return (self._workspace_root / candidate).resolve()
