"""CLI 探测输出的脱敏工具。

这里维护保守的敏感字段集合；provider 只能输出脱敏后的摘要文本。
"""
from __future__ import annotations

import json
import re

SENSITIVE_WORDS = (
    "app_id",
    "appid",
    "appsecret",
    "app_secret",
    "access_token",
    "refreshtoken",
    "refresh_token",
    "tenant_access_token",
    "user_access_token",
    "token",
    "secret",
    "open_id",
    "openid",
    "union_id",
    "userid",
    "username",
    "user_name",
    "email",
    "mobile",
    "phone",
    "password",
    "credential",
    "corp_id",
    "corpid",
)

_SENSITIVE_KEY_RE = re.compile(
    r"(?i)(app[_-]?id|app[_-]?secret|access[_-]?token|refresh[_-]?token|"
    r"tenant[_-]?access[_-]?token|user[_-]?access[_-]?token|token|secret|"
    r"open[_-]?id|openId|union[_-]?id|user[_-]?id|user[_-]?name|email|"
    r"mobile|phone|password|credential|corp[_-]?id)"
)
_SENSITIVE_PAIR_RE = re.compile(
    r"(?i)(app[_-]?id|app[_-]?secret|access[_-]?token|refresh[_-]?token|"
    r"tenant[_-]?access[_-]?token|user[_-]?access[_-]?token|token|secret|"
    r"open[_-]?id|openId|union[_-]?id|user[_-]?id|user[_-]?name|email|"
    r"mobile|phone|password|credential|corp[_-]?id)"
    r"(\s*[:=]\s*)"
    r"([^\s,;}]+|\"[^\"]*\"|'[^']*')"
)


def _is_sensitive_key(key: object) -> bool:
    """判断 JSON 字段名是否属于需要脱敏的敏感字段。"""
    normalized = str(key).replace("_", "").replace("-", "").lower()
    return normalized in {word.replace("_", "").replace("-", "").lower() for word in SENSITIVE_WORDS} or bool(
        _SENSITIVE_KEY_RE.search(str(key))
    )


def _sanitize_json_value(value: object) -> object:
    """递归脱敏 JSON 对象，保留结构以便排查状态字段。"""
    if isinstance(value, dict):
        return {
            key: "<redacted>" if _is_sensitive_key(key) else _sanitize_json_value(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_sanitize_json_value(item) for item in value]
    return value


def sanitize_text(text: str) -> str:
    """替换常见 key-value 形式的敏感字段值。

    该函数用于容错清洗 CLI 输出，不能替代 provider 的最小化摘要原则。
    """
    if not text:
        return ""
    try:
        parsed = json.loads(text)
        return json.dumps(_sanitize_json_value(parsed), ensure_ascii=False, indent=2)
    except Exception:
        pass
    sanitized = _SENSITIVE_PAIR_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}<redacted>", text)
    lines = []
    for line in sanitized.splitlines():
        if _SENSITIVE_KEY_RE.search(line):
            lines.append(_SENSITIVE_PAIR_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}<redacted>", line))
        else:
            lines.append(line)
    return "\n".join(lines)


def first_sanitized_line(text: str) -> str:
    """取脱敏后的首个非空行，用于版本号等短文本摘要。"""
    for line in sanitize_text(text).splitlines():
        line = line.strip()
        if line:
            return line[:120]
    return "unknown"
