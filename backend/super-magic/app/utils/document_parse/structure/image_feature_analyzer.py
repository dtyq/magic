"""Lightweight image feature extraction for document asset filtering.

The analyzer avoids full-resolution pixel scans. It reads dimensions from the
image header first, skips oversized files, then samples a tiny thumbnail only
when needed for transparent or blank-image checks.
"""

from __future__ import annotations

from io import BytesIO
from typing import Any

from app.utils.async_file_utils import async_read_bytes


class ImageFeatureAnalyzer:
    """Extract low-cost image features from bytes or a file path."""

    MAX_PIXEL_ANALYSIS_BYTES = 10 * 1024 * 1024
    THUMBNAIL_SIZE = (64, 64)
    TINY_MAX_SIDE = 8
    TINY_MAX_AREA = 64
    DECORATIVE_LINE_MIN_RATIO = 30
    DECORATIVE_LINE_MAX_THIN_SIDE = 8
    TRANSPARENT_ALPHA_MAX = 8
    SOLID_CHANNEL_DELTA_MAX = 8

    @classmethod
    async def analyze_path(cls, path) -> dict[str, Any]:
        """Read an image with async file IO and return lightweight features."""

        return cls.analyze_bytes(await async_read_bytes(path))

    @classmethod
    def analyze_bytes(cls, image_bytes: bytes) -> dict[str, Any]:
        """Return image features; failures are encoded instead of raised."""

        features: dict[str, Any] = {
            "byte_size": len(image_bytes),
            "analysis_error": None,
            "pixel_analysis_skipped": False,
        }
        try:
            from PIL import Image

            with Image.open(BytesIO(image_bytes)) as image:
                width, height = image.size
                features.update({
                    "width": width,
                    "height": height,
                    "mode": image.mode,
                    "is_tiny": cls._is_tiny(width, height),
                    "is_decorative_line": cls._is_decorative_line(width, height),
                })
                if len(image_bytes) > cls.MAX_PIXEL_ANALYSIS_BYTES:
                    features["pixel_analysis_skipped"] = True
                    features["pixel_analysis_skip_reason"] = "image file is too large"
                    return features

                sample = image.copy()
                sample.thumbnail(cls.THUMBNAIL_SIZE)
                rgba = sample.convert("RGBA")
                alpha = rgba.getchannel("A")
                alpha_min, alpha_max = alpha.getextrema()
                features["is_transparent"] = alpha_max <= cls.TRANSPARENT_ALPHA_MAX

                rgb = rgba.convert("RGB")
                extrema = rgb.getextrema()
                channel_delta = max(high - low for low, high in extrema)
                features["channel_delta"] = channel_delta
                features["is_solid_or_blank"] = channel_delta <= cls.SOLID_CHANNEL_DELTA_MAX
                features["alpha_min"] = alpha_min
                features["alpha_max"] = alpha_max
        except Exception as exc:
            features["analysis_error"] = str(exc)
        return features

    @classmethod
    def _is_tiny(cls, width: int, height: int) -> bool:
        return max(width, height) <= cls.TINY_MAX_SIDE or width * height <= cls.TINY_MAX_AREA

    @classmethod
    def _is_decorative_line(cls, width: int, height: int) -> bool:
        thin_side = min(width, height)
        if thin_side > cls.DECORATIVE_LINE_MAX_THIN_SIDE:
            return False
        ratio = max(width, height) / max(thin_side, 1)
        return ratio >= cls.DECORATIVE_LINE_MIN_RATIO
