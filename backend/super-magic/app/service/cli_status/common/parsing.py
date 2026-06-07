"""CLI provider 共享的轻量解析工具。"""
from __future__ import annotations

import json
from typing import Optional


def loads_json(text: str) -> object | None:
    """尝试解析 JSON；失败返回 None，由 provider 决定降级策略。"""
    text = text.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def json_contains_truthy(value: object, keys: set[str]) -> Optional[bool]:
    """递归查找布尔语义字段，并归一化常见字符串真假值。"""
    if isinstance(value, dict):
        for key, item in value.items():
            normalized_key = str(key).replace("_", "").replace("-", "").lower()
            if normalized_key in keys:
                if isinstance(item, bool):
                    return item
                if isinstance(item, str):
                    lowered = item.strip().lower()
                    if lowered in {"true", "yes", "ok", "valid", "authenticated", "logged_in", "login"}:
                        return True
                    if lowered in {"false", "no", "invalid", "expired", "not_authenticated", "not_login", "logout"}:
                        return False
            nested = json_contains_truthy(item, keys)
            if nested is not None:
                return nested
    elif isinstance(value, list):
        for item in value:
            nested = json_contains_truthy(item, keys)
            if nested is not None:
                return nested
    return None


def json_find_status(value: object, keys: set[str]) -> Optional[str]:
    """递归查找状态字段，返回小写字符串状态。"""
    if isinstance(value, dict):
        for key, item in value.items():
            normalized_key = str(key).replace("_", "").replace("-", "").lower()
            if normalized_key in keys and isinstance(item, str):
                return item.strip().lower()
            nested = json_find_status(item, keys)
            if nested:
                return nested
    elif isinstance(value, list):
        for item in value:
            nested = json_find_status(item, keys)
            if nested:
                return nested
    return None


def parse_auth_from_text(text: str) -> tuple[str, str]:
    """从非结构化文本中粗略识别授权状态。

    仅用于 JSON 不可用或命令失败时兜底，无法确定时返回 unknown。
    """
    lowered = text.lower()
    if any(word in lowered for word in ("authenticated", "logged in", "login success", "valid credential")):
        if not any(word in lowered for word in ("not authenticated", "not logged", "no credential", "expired")):
            return "authenticated", "ok"
    if any(word in lowered for word in ("not authenticated", "not logged", "no credential", "expired", "unauthorized")):
        return "not_authenticated", "not_authenticated"
    if "keychain" in lowered:
        return "unknown", "keychain_unavailable"
    return "unknown", "unrecognized_output"
