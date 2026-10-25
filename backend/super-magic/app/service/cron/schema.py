"""Cron payload 的稳定版本协议。"""

from __future__ import annotations

PAYLOAD_VERSION_FIELD: str = "version"
LEGACY_BASELINE_VERSION: int = 1
CURRENT_PAYLOAD_VERSION: int = 2

__all__ = [
    "CURRENT_PAYLOAD_VERSION",
    "LEGACY_BASELINE_VERSION",
    "PAYLOAD_VERSION_FIELD",
]
