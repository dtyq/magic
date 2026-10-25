"""Canvas 视频输出分辨率解析工具。"""

from __future__ import annotations

import re

_RESOLUTION_PRESETS = {
    "480p": 480,
    "720p": 720,
    "1080p": 1080,
    "2k": 1440,
    "4k": 2160,
}
_NUMERIC_RESOLUTION_PATTERN = re.compile(r"^(\d+)(?:p)?$", re.IGNORECASE)


def parse_resolution_short_side(value: object) -> int | None:
    """解析预设或任意数字短边分辨率。"""
    if not isinstance(value, str):
        return None
    normalized = value.strip().casefold()
    if not normalized:
        return None
    preset = _RESOLUTION_PRESETS.get(normalized)
    if preset is not None:
        return preset
    match = _NUMERIC_RESOLUTION_PATTERN.fullmatch(normalized)
    if match is None:
        return None
    short_side = int(match.group(1))
    return short_side if short_side >= 2 else None
