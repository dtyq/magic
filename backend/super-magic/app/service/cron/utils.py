"""
cron 工具函数
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional


def ms_to_iso(ms: Optional[int]) -> str:
    """毫秒时间戳转 ISO 格式字符串（UTC），None 返回 '-'。"""
    if ms is None:
        return "-"
    try:
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return str(ms)


def name_to_job_id(name: str) -> str:
    """将任务名称转换为合法文件名 ID（小写 + 连字符）。"""
    s = name.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "unnamed-job"
