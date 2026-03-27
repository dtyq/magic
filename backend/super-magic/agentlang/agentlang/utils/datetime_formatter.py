"""Datetime formatting utilities"""
from datetime import datetime
from typing import Optional


def get_current_datetime_str(tz: Optional[str] = None) -> str:
    """Get current datetime as formatted string for LLM context.

    Args:
        tz: IANA timezone name (e.g. "Asia/Shanghai"). Falls back to system timezone if not provided.

    Returns:
        Formatted datetime string, e.g., "2025-12-02 16:43:54 Tuesday (Week 48) Asia/Shanghai (UTC+08:00)"
    """
    from agentlang.utils.timezone_utils import get_system_timezone
    tz_name = tz or get_system_timezone()
    try:
        import pytz
        now = datetime.now(pytz.timezone(tz_name))
    except Exception:
        now = datetime.now().astimezone()
        tz_name = now.tzname() or "UTC"

    weekday_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekday_name = weekday_names[now.weekday()]
    raw_offset = now.strftime("%z")
    utc_offset = f"UTC{raw_offset[:3]}:{raw_offset[3:]}" if len(raw_offset) == 5 else f"UTC{raw_offset}"
    return now.strftime(f"%Y-%m-%d %H:%M:%S {weekday_name} (Week %W)") + f" {tz_name} ({utc_offset})"
