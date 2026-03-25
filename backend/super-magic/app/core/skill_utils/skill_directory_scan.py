"""本地磁盘 skill 包发现：遍历目录解析 SKILL.md 元数据。

与 skillhub（从互联网检索/安装 skill 的 CLI 能力）无关，仅做 workspace / agents 等路径下的目录扫描。
"""
import asyncio
from pathlib import Path
from typing import List

from agentlang.skills.models import SkillMetadata
from agentlang.logger import get_logger
from app.utils.async_file_utils import async_read_text, async_exists
from app.core.skill_utils.constants import get_skillhub_install_dir

logger = get_logger(__name__)


async def discover_skills_in_directory(skills_root: Path) -> List[SkillMetadata]:
    """遍历给定根目录下一层子目录，收集含 SKILL.md 的 skill 元数据。

    每次调用均实时读盘，无缓存。
    """
    import os

    if not await async_exists(skills_root):
        return []

    results: List[SkillMetadata] = []

    try:
        entries = await asyncio.to_thread(lambda: list(os.scandir(skills_root)))
        for entry in entries:
            if not entry.is_dir() or entry.name.startswith("."):
                continue
            skill_file = Path(entry.path) / "SKILL.md"
            if not await async_exists(skill_file):
                continue

            name = entry.name
            description = ""
            try:
                content = await async_read_text(skill_file)
                if content.startswith("---"):
                    end_idx = content.find("\n---", 3)
                    if end_idx > 0:
                        for line in content[3:end_idx].splitlines():
                            if line.startswith("name:"):
                                name = line.split(":", 1)[1].strip().strip("\"'")
                            elif line.startswith("description:"):
                                description = line.split(":", 1)[1].strip().strip("\"'")
            except Exception:
                pass

            results.append(SkillMetadata(name=name, description=description, skill_dir=Path(entry.path)))
            logger.info(f"发现 skill: {name} (目录 {skills_root})")

    except Exception as e:
        logger.warning(f"遍历 skills 目录失败 ({skills_root}): {e}")

    return results


async def discover_skills_in_workspace() -> List[SkillMetadata]:
    """遍历 workspace 下持久化 skills 目录（路径同 get_skillhub_install_dir，即 .workspace/.magic/skills）。"""
    return await discover_skills_in_directory(get_skillhub_install_dir())
