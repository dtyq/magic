"""Human-friendly time formatting helpers for tool outputs."""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

DEFAULT_TIME_FORMAT = "%Y-%m-%d %H:%M:%S"


def format_tool_time(value: object, timezone_name: str = "UTC") -> str:
    """Format timestamps for user-visible and model-readable tool text."""
    dt = _parse_datetime(value)
    if dt is None:
        return "-"

    timezone = _load_timezone(timezone_name)
    localized = dt.astimezone(timezone)
    suffix = _timezone_suffix(localized, timezone_name)
    return f"{localized.strftime(DEFAULT_TIME_FORMAT)} {suffix}"


def _parse_datetime(value: object) -> datetime | None:
    if value in (None, "", "-", [], {}):
        return None

    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value

    if isinstance(value, int | float):
        return _datetime_from_timestamp(float(value))

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.isdigit():
            return _datetime_from_timestamp(float(text))
        # RFC 2822 变体: "Mon May 04 19:30:00 +0000 2026"（Twitter/X、部分社交平台 API 常用）
        dt = _datetime_from_rfc2822(text)
        if dt:
            return dt
        return _datetime_from_iso(text)

    return None


def _datetime_from_timestamp(value: float) -> datetime | None:
    if value <= 0:
        return None
    if value > 10_000_000_000:
        value = value / 1000
    return datetime.fromtimestamp(value, tz=UTC)


def _datetime_from_iso(text: str) -> datetime | None:
    normalized = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _datetime_from_rfc2822(text: str) -> datetime | None:
    """解析 RFC 2822 变体时间: 'Mon May 04 19:30:00 +0000 2026'"""
    try:
        parsed = datetime.strptime(text, "%a %b %d %H:%M:%S %z %Y")
        return parsed
    except ValueError:
        return None


def _load_timezone(timezone_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name)
    except Exception:
        return ZoneInfo("UTC")


def _timezone_suffix(value: datetime, timezone_name: str) -> str:
    if timezone_name == "UTC":
        return "UTC"

    offset = value.utcoffset()
    if offset is None:
        return timezone_name

    total_minutes = int(offset.total_seconds() // 60)
    sign = "+" if total_minutes >= 0 else "-"
    total_minutes = abs(total_minutes)
    hours, minutes = divmod(total_minutes, 60)
    return f"UTC{sign}{hours:02d}:{minutes:02d}"
