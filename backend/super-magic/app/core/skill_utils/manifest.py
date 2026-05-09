"""SkillManifest：安装产物元数据读写

每个用户安装的 skill 目录下写入 .skill-manifest.json，
记录版本、来源、安装时间等信息，用于升级检测与审计。
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from agentlang.logger import get_logger

logger = get_logger(__name__)

MANIFEST_FILENAME = ".skill-manifest.json"
MANIFEST_SCHEMA = 1

# 进程级内存缓存（skill_dir -> manifest），仅读；写入时主动失效
_cache: dict[str, "SkillManifest"] = {}


@dataclass
class SkillManifest:
    """Skill 安装元数据"""

    name: str                   # skill 名称（目录名 / SKILL.md 中的 name）
    provider: str               # SkillProviderId.value 或 "unknown"（旧版兼容）
    source_id: str              # provider 内唯一 ID（code / slug / GitHub URL）
    version: str                # SemVer 或 commit sha 前 12 位；旧版兼容用 "unknown"
    installed_at: str           # ISO-8601 UTC，如 "2026-05-07T08:11:23Z"
    schema: int = MANIFEST_SCHEMA
    source_url: str = ""        # 非签名 URL，仅用于追溯
    installed_by: str = "install_skills"  # 安装来源标识
    checksum_sha256: str = ""   # 可选，zip 内容哈希


def read_manifest(skill_dir: Path) -> SkillManifest | None:
    """读取 skill 目录下的 .skill-manifest.json；文件不存在或损坏时返回 None"""
    key = str(skill_dir)
    if key in _cache:
        return _cache[key]

    manifest_file = skill_dir / MANIFEST_FILENAME
    if not manifest_file.exists():
        return None

    try:
        raw: dict[str, Any] = json.loads(manifest_file.read_text(encoding="utf-8"))
        m = SkillManifest(
            schema=raw.get("schema", MANIFEST_SCHEMA),
            name=raw.get("name", ""),
            provider=raw.get("provider", "unknown"),
            source_id=raw.get("source_id", ""),
            version=raw.get("version", "unknown"),
            installed_at=raw.get("installed_at", ""),
            source_url=raw.get("source_url", ""),
            installed_by=raw.get("installed_by", "unknown"),
            checksum_sha256=raw.get("checksum_sha256", ""),
        )
        _cache[key] = m
        return m
    except Exception as e:
        logger.warning(f"读取 manifest 失败 ({manifest_file}): {e}")
        return None


def write_manifest(skill_dir: Path, m: SkillManifest) -> None:
    """将 manifest 写入 skill 目录下的 .skill-manifest.json，同时更新内存缓存"""
    manifest_file = skill_dir / MANIFEST_FILENAME
    try:
        data = asdict(m)
        manifest_file.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        _cache[str(skill_dir)] = m
        logger.debug(f"写入 manifest: {manifest_file}")
    except Exception as e:
        logger.error(f"写入 manifest 失败 ({manifest_file}): {e}")
        raise


def invalidate_cache(skill_dir: Path) -> None:
    """主动失效指定目录的缓存（删除/替换 skill 后调用）"""
    _cache.pop(str(skill_dir), None)
