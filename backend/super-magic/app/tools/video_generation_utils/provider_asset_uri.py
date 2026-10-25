"""视频供应商素材 URI 识别工具。"""

from __future__ import annotations

import re

_PROVIDER_ASSET_URI_PATTERN = re.compile(r"^asset://[A-Za-z0-9][A-Za-z0-9._-]*$")


def normalize_provider_asset_uri(value: str) -> str | None:
    """规范化供应商素材 URI，兼容路径拼接误加的前导斜杠。"""
    normalized = str(value or "").strip()
    if normalized.startswith("/asset://"):
        normalized = normalized[1:]
    return normalized if _PROVIDER_ASSET_URI_PATTERN.fullmatch(normalized) else None


def is_provider_asset_uri(value: str) -> bool:
    """判断字符串是否为受控的供应商素材 URI。"""
    return normalize_provider_asset_uri(value) is not None


__all__ = ["is_provider_asset_uri", "normalize_provider_asset_uri"]
