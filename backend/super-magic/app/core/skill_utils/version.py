"""版本比较工具

支持三种版本格式：
- SemVer：1.2.3 / 1.2.3-rc.1
- Commit sha：前 12 位十六进制，如 a1b2c3d4e5f6
- 特殊值："unknown"（无法比较，始终视为旧于任何已知版本）

compare(a, b) 返回 -1 / 0 / 1；version_gt(a, b) 返回 a > b 的布尔值。
"""
from __future__ import annotations

import re

_SHA_RE = re.compile(r"^[0-9a-f]{7,40}$", re.IGNORECASE)
_SEMVER_RE = re.compile(
    r"^v?(\d+)\.(\d+)\.(\d+)"       # 主版本.次版本.修订
    r"(?:-([0-9A-Za-z.\-]+))?"       # 可选 pre-release
    r"(?:\+[0-9A-Za-z.\-]+)?$"       # 可选 build metadata（忽略）
)


def _semver_tuple(v: str) -> tuple | None:
    m = _SEMVER_RE.match(v)
    if not m:
        return None
    major, minor, patch = int(m.group(1)), int(m.group(2)), int(m.group(3))
    pre = m.group(4)
    # pre-release 版本低于正式版；无 pre 的用空元组（比任何字符串都大）
    pre_key: tuple = () if pre is None else tuple(
        int(p) if p.isdigit() else p for p in pre.split(".")
    )
    return (major, minor, patch, pre_key)


def compare(a: str, b: str) -> int:
    """比较两个版本字符串。

    Returns:
        -1  if a < b
         0  if a == b
         1  if a > b
    """
    if a == b:
        return 0
    # "unknown" 视为最旧
    if a == "unknown":
        return -1
    if b == "unknown":
        return 1

    # 两者都是 SemVer
    at = _semver_tuple(a)
    bt = _semver_tuple(b)
    if at is not None and bt is not None:
        if at < bt:
            return -1
        if at > bt:
            return 1
        return 0

    # commit sha：直接字符串比较（长度/字典序）
    if _SHA_RE.match(a) and _SHA_RE.match(b):
        # sha 无顺序语义，视为相等（无法判断新旧）
        return 0 if a.lower() == b.lower() else -1

    # 混合场景（一 SemVer 一 sha）：SemVer 视为更新
    if at is not None and bt is None:
        return 1
    if at is None and bt is not None:
        return -1

    # 兜底：字符串比较
    return -1 if a < b else (0 if a == b else 1)


def version_gt(a: str, b: str) -> bool:
    """返回 a 是否严格大于（即更新于）b"""
    return compare(a, b) > 0


def version_eq(a: str, b: str) -> bool:
    """返回 a 与 b 是否相同版本"""
    return compare(a, b) == 0
