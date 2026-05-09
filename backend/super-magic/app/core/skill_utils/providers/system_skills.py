"""SystemSkillsProvider：从 agents/skills/ 和 agents/crews/*/skills/ 目录加载内置系统 skill

系统 skill 已内置于项目中，无需安装，最高优先级。
同时扫描数字员工（crew）的专属 skill 目录，对外统一以 system 来源呈现。
搜索时联合匹配 name / description / name-cn / description-cn / 目录名。
"""
from __future__ import annotations

import asyncio
from pathlib import Path

from agentlang.logger import get_logger
from agentlang.skills.loader import SkillLoader
from app.utils.async_file_utils import async_exists, async_iterdir
from app.core.skill_utils.providers.base import (
    FetchedSkill,
    SkillCandidate,
    SkillProvider,
    SkillProviderId,
)

logger = get_logger(__name__)

_loader = SkillLoader()


class SystemSkillsProvider(SkillProvider):
    """内置系统 skill 来源（agents/skills/ 及 agents/crews/*/skills/ 目录）"""

    id = SkillProviderId.SYSTEM

    def _get_skills_root(self) -> Path:
        from app.path_manager import PathManager
        return PathManager.get_agents_dir() / "skills"

    def _get_crew_skills_roots(self) -> list[Path]:
        """返回所有 crew 的 skills 目录路径列表（agents/crews/*/skills/）"""
        from app.path_manager import PathManager
        crews_root = PathManager.get_crew_root_dir()
        if not crews_root.exists():
            return []
        try:
            return [
                entry / "skills"
                for entry in crews_root.iterdir()
                if entry.is_dir() and not entry.name.startswith(".")
            ]
        except Exception as e:
            logger.warning(f"[system_skills] 遍历 crews 目录失败: {e}")
            return []

    async def _scan_dir(self, skills_dir: Path) -> list[dict]:
        """扫描单个 skills 目录，返回 skill 元数据列表"""
        if not await async_exists(skills_dir):
            return []

        try:
            all_entries = await async_iterdir(skills_dir)
            entries = [e for e in all_entries if e.is_dir() and not e.name.startswith(".")]
        except Exception as e:
            logger.warning(f"[system_skills] 遍历 {skills_dir} 失败: {e}")
            return []

        results: list[dict] = []
        for entry in entries:
            skill_md = entry / "SKILL.md"
            if not await async_exists(skill_md):
                continue
            try:
                meta = await _loader.load_from_file(skill_md)
                raw = meta.raw_metadata or {}
                results.append({
                    "dir_name": entry.name,
                    "local_path": entry,
                    "name": meta.name or entry.name,
                    "description": meta.description or raw.get("description-cn") or "",
                    "name_cn": raw.get("name-cn") or "",
                    "description_cn": raw.get("description-cn") or "",
                })
            except Exception as e:
                logger.warning(f"[system_skills] 读取 {skill_md} 失败: {e}")

        return results

    async def _load_all(self) -> list[dict]:
        """扫描 agents/skills/ 和所有 crew skills 目录，返回完整 skill 元数据列表"""
        results = await self._scan_dir(self._get_skills_root())

        crew_roots = await asyncio.to_thread(self._get_crew_skills_roots)
        for crew_root in crew_roots:
            crew_results = await self._scan_dir(crew_root)
            results.extend(crew_results)

        return results

    def _matches(self, skill: dict, keyword: str) -> bool:
        """keyword 为空时全量返回；否则多字段联合匹配"""
        if not keyword:
            return True
        kw = keyword.lower()
        return any(
            kw in str(skill.get(f, "")).lower()
            for f in ("name", "description", "name_cn", "description_cn", "dir_name")
        )

    async def search(self, keyword: str, limit: int = 10) -> list[SkillCandidate]:
        all_skills = await self._load_all()
        matched = [s for s in all_skills if self._matches(s, keyword)]
        return [
            SkillCandidate(
                provider=self.id,
                id=s["dir_name"],
                name=s["name"],
                description=s["description"],
                version=None,
                extra={
                    "local_path": str(s["local_path"]),
                    "name_cn": s["name_cn"],
                    "description_cn": s["description_cn"],
                },
            )
            for s in matched[:limit]
        ]

    async def fetch(
        self,
        ref: SkillCandidate | str,
        *,
        version: str | None = None,
    ) -> FetchedSkill:
        """系统 skill 已在本地，直接返回本地路径"""
        skill_id = self._get_id(ref)

        # 优先从 candidate extra 中取精确路径
        if isinstance(ref, SkillCandidate) and ref.extra.get("local_path"):
            local_path = Path(ref.extra["local_path"])
            if await async_exists(local_path):
                return FetchedSkill(
                    local_path=local_path,
                    version="system",
                    source_url=f"system://{skill_id}",
                )

        # 先查 agents/skills/
        local_path = self._get_skills_root() / skill_id
        if await async_exists(local_path):
            return FetchedSkill(
                local_path=local_path,
                version="system",
                source_url=f"system://{skill_id}",
            )

        # 再查 crew skills 目录
        crew_roots = await asyncio.to_thread(self._get_crew_skills_roots)
        for crew_root in crew_roots:
            candidate = crew_root / skill_id
            if await async_exists(candidate):
                return FetchedSkill(
                    local_path=candidate,
                    version="system",
                    source_url=f"system://{skill_id}",
                )

        raise FileNotFoundError(
            f"[system_skills] skill '{skill_id}' 不存在于 agents/skills/ 或任何 crew skills 目录"
        )

    async def resolve_latest(self, ref: SkillCandidate | str) -> str | None:
        return None
