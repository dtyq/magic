"""Horizon 持久化格式链式迁移。

每个版本变更对应一个 _migrate_vN_to_vN+1 函数，注册到 _MIGRATIONS。
load 时检测 version 并依序执行所有需要的迁移，保证旧 JSON 无损升级。
"""
from __future__ import annotations

from typing import Callable

from agentlang.logger import get_logger

logger = get_logger(__name__)

CURRENT_VERSION = 2


def _migrate_v1_to_v2(data: dict) -> dict:
    """v1 → v2: 字段重命名 + 删除冗余字段。

    - read_content → file_content
    - full_file_hash → file_hash
    - read_content_hash → 删除
    """
    file_records = data.get("file_records", {})
    migrated_records: dict = {}
    for key, record in file_records.items():
        if not isinstance(record, dict):
            migrated_records[key] = record
            continue
        record["file_content"] = record.pop("read_content", "")
        record["file_hash"] = record.pop("full_file_hash", "")
        record.pop("read_content_hash", None)
        migrated_records[key] = record
    data["file_records"] = migrated_records
    data["version"] = 2
    return data


_MIGRATIONS: dict[int, Callable[[dict], dict]] = {
    1: _migrate_v1_to_v2,
}


def apply_migrations(data: dict) -> dict:
    """从当前 version 依序执行所有迁移直到 CURRENT_VERSION。"""
    version = data.get("version", 1)
    if version >= CURRENT_VERSION:
        return data
    while version < CURRENT_VERSION:
        migrate_fn = _MIGRATIONS.get(version)
        if migrate_fn is None:
            logger.warning(f"[HorizonMigration] 缺少 v{version} → v{version + 1} 的迁移函数，跳过")
            break
        logger.info(f"[HorizonMigration] 执行 v{version} → v{version + 1} 迁移")
        data = migrate_fn(data)
        version = data.get("version", version + 1)
    data["version"] = CURRENT_VERSION
    return data
