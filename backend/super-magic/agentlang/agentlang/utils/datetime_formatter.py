"""Datetime formatting utilities"""
from datetime import datetime
from typing import Optional


def get_current_datetime(tz: Optional[str] = None) -> datetime:
    """Return an aware datetime, preserving the existing timezone fallback."""
    from agentlang.utils.timezone_utils import get_system_timezone

    tz_name = tz or get_system_timezone()
    try:
        import pytz
    except ImportError:
        return datetime.now().astimezone()
    try:
        timezone_info = pytz.timezone(tz_name)
    except pytz.UnknownTimeZoneError:
        return datetime.now().astimezone()
    return datetime.now(timezone_info)


def format_datetime(value: datetime, *, include_calendar: bool = True) -> str:
    """Format an aware datetime; compact output still includes its UTC offset."""
    offset = value.utcoffset()
    if offset is None:
        raise ValueError("Datetime must include a timezone")
    offset_seconds = int(offset.total_seconds())
    hours, remainder = divmod(abs(offset_seconds), 3600)
    minutes, seconds = divmod(remainder, 60)
    sign = "+" if offset_seconds >= 0 else "-"
    utc_offset = f"UTC{sign}{hours:02d}:{minutes:02d}"
    if seconds:
        utc_offset += f":{seconds:02d}"
    time_text = value.strftime("%Y-%m-%d %H:%M:%S")
    if not include_calendar:
        return f"{time_text} {utc_offset}"

    # 星期名称保持英文，不让服务器 locale 改变进入模型的文案。
    weekday_names = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
    weekday_name = weekday_names[value.weekday()]
    # pytz 的 IANA 名称属于第三方可选属性；标准 tzinfo 则使用其公开 tzname 契约。
    tz_name = getattr(value.tzinfo, "zone", None)
    if not isinstance(tz_name, str) or not tz_name:
        tz_name = value.tzname() or "UTC"
    return f"{time_text} {weekday_name} (Week {value.strftime('%W')}) {tz_name} ({utc_offset})"


def get_current_datetime_str(tz: Optional[str] = None) -> str:
    """Get current datetime as formatted string for LLM context.

    Args:
        tz: IANA timezone name (e.g. "Asia/Shanghai"). Falls back to system timezone if not provided.

    Returns:
        Formatted datetime string, e.g., "2025-12-02 16:43:54 Tuesday (Week 48) Asia/Shanghai (UTC+08:00)"
    """
    return format_datetime(get_current_datetime(tz))
