"""Crew agent compiled-cache manifest and source fingerprint handling."""

from __future__ import annotations

import asyncio
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_exists,
    async_read_json,
    async_unlink,
    async_write_json,
)

logger = get_logger(__name__)


@dataclass(frozen=True)
class CrewSourceFingerprint:
    """Stable fingerprint for the files under a crew source directory."""

    fingerprint: str
    file_count: int


@dataclass(frozen=True)
class CrewAgentCacheState:
    """Compiled-cache freshness result."""

    stale: bool
    reason: str
    source: CrewSourceFingerprint


class CrewAgentCacheManager:
    """Manage `.agent` cache freshness for runtime-compiled crew agents."""

    # 名称兼容会改变默认工具的排除结果，必须从原 TOOLS.md 重新编译一次。
    MANIFEST_VERSION = 2

    def manifest_file(self, agent_code: str) -> Path:
        agent_file = PathManager.get_compiled_agent_file(agent_code)
        return agent_file.with_name(f"{agent_file.name}.manifest.json")

    async def evaluate_cache(self, agent_code: str, crew_dir: Path) -> CrewAgentCacheState:
        source = await self.source_fingerprint(crew_dir)
        manifest_path = self.manifest_file(agent_code)
        if not await async_exists(manifest_path):
            return CrewAgentCacheState(stale=True, reason="manifest_missing", source=source)

        try:
            manifest = await async_read_json(manifest_path)
        except Exception as e:
            logger.warning(f"Crew agent manifest unreadable, will recompile: {manifest_path}: {e}")
            return CrewAgentCacheState(stale=True, reason="manifest_unreadable", source=source)

        if manifest.get("version") != self.MANIFEST_VERSION:
            return CrewAgentCacheState(stale=True, reason="manifest_version_changed", source=source)
        if manifest.get("fingerprint") != source.fingerprint:
            return CrewAgentCacheState(stale=True, reason="source_changed", source=source)
        if manifest.get("file_count") != source.file_count:
            return CrewAgentCacheState(stale=True, reason="source_file_count_changed", source=source)

        return CrewAgentCacheState(stale=False, reason="fresh", source=source)

    async def write_manifest(
        self,
        agent_code: str,
        crew_dir: Path,
        source: CrewSourceFingerprint | None = None,
    ) -> CrewSourceFingerprint:
        source = source or await self.source_fingerprint(crew_dir)
        manifest = {
            "version": self.MANIFEST_VERSION,
            "agent_code": agent_code,
            "crew_dir": str(crew_dir),
            "fingerprint": source.fingerprint,
            "file_count": source.file_count,
            "compiled_at": datetime.now(timezone.utc).isoformat(),
        }
        await async_write_json(
            self.manifest_file(agent_code),
            manifest,
            ensure_ascii=False,
            indent=2,
        )
        return source

    async def clear_compiled_cache(self, agent_code: str) -> None:
        await async_unlink(PathManager.get_compiled_agent_file(agent_code))
        await async_unlink(self.manifest_file(agent_code))

    async def source_fingerprint(self, crew_dir: Path) -> CrewSourceFingerprint:
        return await asyncio.to_thread(self._scan_source_fingerprint, Path(crew_dir))

    def _scan_source_fingerprint(self, crew_dir: Path) -> CrewSourceFingerprint:
        if not crew_dir.exists():
            raise FileNotFoundError(f"Crew source directory not found: {crew_dir}")
        if not crew_dir.is_dir():
            raise NotADirectoryError(f"Crew source path is not a directory: {crew_dir}")

        entries: list[tuple[str, int, int]] = []
        self._collect_source_files(crew_dir, crew_dir, frozenset(), entries)
        entries.sort(key=lambda item: item[0])
        hasher = hashlib.sha256()
        for relative_path, size, mtime_ns in entries:
            hasher.update(f"{relative_path}\0{size}\0{mtime_ns}\n".encode("utf-8"))

        return CrewSourceFingerprint(
            fingerprint=hasher.hexdigest(),
            file_count=len(entries),
        )

    def _collect_source_files(
        self,
        directory: Path,
        root: Path,
        stack: frozenset[tuple[int, int]],
        entries: list[tuple[str, int, int]],
    ) -> None:
        directory_key = self._directory_key(directory)
        if directory_key in stack:
            logger.warning(f"Skip recursive crew source symlink loop: {directory}")
            return

        next_stack = stack | {directory_key}
        try:
            children = sorted(directory.iterdir(), key=lambda item: item.name)
        except OSError as e:
            logger.warning(f"Skip unreadable crew source directory: {directory}: {e}")
            return

        for child in children:
            try:
                if child.is_dir():
                    self._collect_source_files(child, root, next_stack, entries)
                    continue
                if not child.is_file():
                    continue
                stat = child.stat()
            except OSError as e:
                logger.warning(f"Skip unreadable crew source file: {child}: {e}")
                continue

            entries.append((child.relative_to(root).as_posix(), stat.st_size, stat.st_mtime_ns))

    def _directory_key(self, directory: Path) -> tuple[int, int]:
        stat = directory.stat()
        return (stat.st_dev, stat.st_ino)
