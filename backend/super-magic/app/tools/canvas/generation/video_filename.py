"""Canvas 视频文件名策略。"""

from __future__ import annotations

import re


def build_video_filename(name: str | None, unique_id: str, fallback: str = "video") -> str:
    """生成使用模型名称和稳定唯一值的视频文件名。"""
    clean_name = sanitize_video_filename(name or fallback)
    clean_id = sanitize_video_filename(unique_id, max_length=32)
    return f"{clean_name}-{clean_id}.mp4"


def sanitize_video_filename(name: str, max_length: int = 200) -> str:
    """清理视频名称中的路径分隔符、控制字符和非法文件名字符。"""
    sanitized = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", str(name or ""))
    sanitized = sanitized.strip(". ")
    if not sanitized:
        sanitized = "video"
    return sanitized[:max_length]
