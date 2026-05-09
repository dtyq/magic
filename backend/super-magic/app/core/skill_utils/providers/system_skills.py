"""SystemSkillsProvider：从 agents/skills/ 目录加载内置系统 skill

系统 skill 已内置于项目中，无需安装，最高优先级。
搜索时联合匹配 name / description / name-cn / description-cn / 目录名。
"""
from __future__ import annotations

import asyncio
from pathlib import Path

from agentlang.logger import get_logger
from agentlang.skills.loader import SkillLoader
from app.core.skill_utils.providers.base import (
    FetchedSkill,
    SkillCandidate,
    SkillProvider,
    SkillProviderId,
)

logger = get_logger(__name__)

_loader = SkillLoader()


class SystemSkillsProvider(SkillProvider):
    """内置系统 skill 来源（agents/skills/ 目录）"""

    id = SkillProviderId.SYSTEM

    def _get_skills_root(self) -> Path:
        from app.path_manager import PathManager
        return PathManager.get_agents_dir() / "skills"

    async def _load_all(self) -> list[dict]:
        """扫描 agents/skills/，返回所有 skill 元数据列表"""
        skills_root = self._get_skills_root()

        exists = await asyncio.to_thread(skills_root.exists)
        if not exists:
            return []

        try:
            entries: list[Path] = await asyncio.to_thread(
                lambda: [e for e in skills_root.iterdir() if e.is_dir() and not e.name.startswith(".")]
            )
        except Exception as e:
            logger.warning(f"[system_skills] 遍历目录失败: {e}")
            return []

        results: list[dict] = []
        for entry in entries:
            skill_md = entry / "SKILL.md"
            md_exists = await asyncio.to_thread(skill_md.exists)
            if not md_exists:
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
        local_path = self._get_skills_root() / skill_id
        exists = await asyncio.to_thread(local_path.exists)
        if not exists:
            raise FileNotFoundError(f"[system_skills] skill '{skill_id}' 不存在于 agents/skills/")
        return FetchedSkill(
            local_path=local_path,
            version="system",
            source_url=f"system://{skill_id}",
        )

    async def resolve_latest(self, ref: SkillCandidate | str) -> str | None:
        return None
