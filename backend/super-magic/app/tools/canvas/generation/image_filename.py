"""Canvas 图片生成文件名策略。"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime


def build_image_filename(
    name: str,
    generated_at: datetime | None = None,
    unique_key: str | None = None,
) -> str:
    """按 Design 兼容规则生成安全、可追踪且支持并发的图片文件名。"""
    clean_name = sanitize_image_filename(name)
    timestamp = (generated_at or datetime.now()).strftime("%Y%m%d%H%M%S")
    if unique_key:
        unique_suffix = hashlib.sha256(unique_key.encode("utf-8")).hexdigest()[:12]
        return f"{clean_name}_{unique_suffix}_{timestamp}"
    return f"{clean_name}_{timestamp}"


def sanitize_image_filename(name: str, max_length: int = 200) -> str:
    """清理模型提供的图片名称，避免名称成为路径或非法文件名。"""
    sanitized = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    sanitized = sanitized.strip(". ")
    if not sanitized:
        sanitized = "image"
    return sanitized[:max_length]
