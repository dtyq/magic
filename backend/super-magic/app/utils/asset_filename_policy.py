"""项目素材文件名策略。"""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from uuid import uuid4


class AssetFilenamePolicy:
    """在保留原名的前提下生成安全且不覆盖已有文件的文件名。"""

    _INVALID_CHARACTER_PATTERN = re.compile(r"[^\w.\- ]+", re.UNICODE)

    @classmethod
    def sanitize(cls, value: str, fallback: str = "asset") -> str:
        """清理用户或上传文件提供的名称，同时保留中文和常见分隔符。"""
        raw_name = Path(str(value or "").strip().replace("\\", "/")).name
        normalized = cls._INVALID_CHARACTER_PATTERN.sub("_", raw_name).strip(" .")
        return normalized or fallback

    @classmethod
    def unique_name(cls, filename: str) -> str:
        """为冲突文件名追加时间和短唯一值，不改变扩展名。"""
        path = Path(cls.sanitize(filename))
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        token = uuid4().hex[:8]
        return f"{path.stem}-{timestamp}-{token}{path.suffix}"
