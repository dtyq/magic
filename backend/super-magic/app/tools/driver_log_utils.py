import json
from typing import Any


MAX_LOG_CHARS = 2000
_REDACT_KEYS = ("authorization", "api-key", "apikey", "token", "secret", "password")


def truncate_text(value: str, max_chars: int = MAX_LOG_CHARS) -> str:
    if len(value) <= max_chars:
        return value
    return f"{value[:max_chars]}...<truncated {len(value) - max_chars} chars>"


def redact_headers(headers: dict[str, Any] | None) -> dict[str, Any]:
    if not headers:
        return {}
    redacted: dict[str, Any] = {}
    for key, value in headers.items():
        key_lower = str(key).lower()
        if any(mark in key_lower for mark in _REDACT_KEYS):
            redacted[key] = "***"
        else:
            redacted[key] = value
    return redacted


def truncate_value(value: Any, max_chars: int = MAX_LOG_CHARS) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        return truncate_text(value, max_chars=max_chars)
    if isinstance(value, dict):
        return {k: truncate_value(v, max_chars=max_chars) for k, v in value.items()}
    if isinstance(value, list):
        if len(value) > 20:
            preview = [truncate_value(item, max_chars=max_chars) for item in value[:20]]
            preview.append(f"<truncated {len(value) - 20} items>")
            return preview
        return [truncate_value(item, max_chars=max_chars) for item in value]
    return value


def to_log_text(value: Any, max_chars: int = MAX_LOG_CHARS) -> str:
    safe_value = truncate_value(value, max_chars=max_chars)
    try:
        text = json.dumps(safe_value, ensure_ascii=False, default=str)
    except Exception:
        text = str(safe_value)
    return truncate_text(text, max_chars=max_chars)
