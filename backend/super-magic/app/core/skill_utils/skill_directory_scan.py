"""本地磁盘 skill 包发现：遍历目录解析 SKILL.md 元数据。

与 skillhub（从互联网检索/安装 skill 的 CLI 能力）无关，仅做 workspace / agents 等路径下的目录扫描。
"""
import asyncio
import os
from pathlib import Path
from typing import List, Optional

from agentlang.skills.models import SkillMetadata
from agentlang.logger import get_logger
from app.utils.async_file_utils import async_read_text, async_exists
from app.core.skill_utils.constants import get_skillhub_install_dir

logger = get_logger(__name__)

_SKILL_MD_FILENAME = "SKILL.md"
_MAX_NEST_DEPTH = 3


def _find_skill_md_sync(root: Path, max_depth: int = _MAX_NEST_DEPTH) -> Optional[Path]:
    """BFS to find the first SKILL.md under *root*, bounded by *max_depth*.

    Platform skill packages may have extra nesting layers, e.g.
      himalaya/himalaya/SKILL.md   or
      todo-mgmt/SKILL-hash/todo-mgmt/SKILL.md
    This helper locates the actual SKILL.md regardless of nesting depth.
    """
    queue: list[tuple[Path, int]] = [(root, 0)]
    while queue:
        current, depth = queue.pop(0)
        if depth > max_depth:
            continue
        candidate = current / _SKILL_MD_FILENAME
        if candidate.is_file():
            return candidate
        if depth < max_depth:
            try:
                for child in current.iterdir():
                    if child.is_dir() and not child.name.startswith("."):
                        queue.append((child, depth + 1))
            except PermissionError:
                pass
    return None


async def discover_skills_in_directory(skills_root: Path) -> List[SkillMetadata]:
    """遍历给定根目录下子目录，收集含 SKILL.md 的 skill 元数据。

    先检查 ``{entry}/SKILL.md``（常规单层结构）；若不存在则向下递归查找
    （平台 skill 包可能有多层嵌套）。每次调用均实时读盘，无缓存。
    """
    if not await async_exists(skills_root):
        return []

    results: List[SkillMetadata] = []

    try:
        entries = await asyncio.to_thread(lambda: list(os.scandir(skills_root)))
        for entry in entries:
            if not entry.is_dir() or entry.name.startswith("."):
                continue

            entry_path = Path(entry.path)
            skill_file = entry_path / _SKILL_MD_FILENAME

            if not await async_exists(skill_file):
                found = await asyncio.to_thread(_find_skill_md_sync, entry_path)
                if found is None:
                    continue
                skill_file = found

            skill_dir = skill_file.parent

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

            results.append(SkillMetadata(name=name, description=description, skill_dir=skill_dir))
            logger.info(f"发现 skill: {name} (目录 {skills_root})")

    except Exception as e:
        logger.warning(f"遍历 skills 目录失败 ({skills_root}): {e}")

    return results


async def discover_skills_in_workspace() -> List[SkillMetadata]:
    """遍历 workspace 下持久化 skills 目录（路径同 get_skillhub_install_dir，即 .workspace/.magic/skills）。"""
    return await discover_skills_in_directory(get_skillhub_install_dir())
