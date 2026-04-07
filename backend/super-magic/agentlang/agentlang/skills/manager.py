"""Skills 管理器核心实现"""

from pathlib import Path
from typing import List, Dict, Optional, Any, Union
import logging
import asyncio
import aiofiles

from agentlang.utils.annotation_remover import remove_developer_annotations
from .models import SkillMetadata
from .loader import SkillLoader
from .exceptions import SkillNotFoundError, SkillResourceError

_SKILL_MD_FILENAME = "SKILL.md"
_MAX_NEST_DEPTH = 3


def _find_skill_md_sync(root: Path, max_depth: int = _MAX_NEST_DEPTH) -> Optional[Path]:
    """BFS to find the first SKILL.md under *root*, bounded by *max_depth*.

    Platform skill packages may have extra nesting layers, e.g.
      himalaya/himalaya/SKILL.md   or
      todo-mgmt/SKILL-hash/todo-mgmt/SKILL.md
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


class SkillManager:
    """Skills 管理器，提供 Skill 的发现、加载、查询和管理功能

    提供完整的 Skill 生命周期管理，包括加载、查询、搜索、
    重新加载等功能。所有操作均实时扫描磁盘，不使用缓存。
    """

    def __init__(
        self,
        skills_dirs: Optional[Union[str, Path, List[Union[str, Path]]]] = None,
    ):
        """初始化 SkillManager

        Args:
            skills_dirs: Skills 根目录，支持单个或多个目录，可以为 None
                        - 单个：字符串或 Path 对象
                        - 多个：字符串或 Path 对象的列表
                        - None/空列表：不加载任何目录
        """
        self.logger = logging.getLogger(__name__)

        # 创建 loader
        self.loader = SkillLoader()

        # 设置 skills 目录（支持多个目录）
        if skills_dirs is None:
            self.skills_dirs = []
        elif isinstance(skills_dirs, (str, Path)):
            self.skills_dirs = [Path(skills_dirs) if isinstance(skills_dirs, str) else skills_dirs]
        else:
            self.skills_dirs = [
                Path(d) if isinstance(d, str) else d
                for d in skills_dirs
            ]

    async def _resolve_skill_file(self, skill_dir: Path) -> Optional[Path]:
        """Resolve the SKILL.md path for a skill directory.

        Checks ``skill_dir/SKILL.md`` first; if absent, searches nested
        subdirectories (platform packages may add extra nesting layers).
        """
        direct = skill_dir / _SKILL_MD_FILENAME
        if await asyncio.to_thread(direct.exists):
            return direct
        found = await asyncio.to_thread(_find_skill_md_sync, skill_dir)
        return found

    async def _scan_all_skills(self) -> List[SkillMetadata]:
        """实时扫描所有 skills 目录，返回所有 SkillMetadata 列表"""
        skills: Dict[str, SkillMetadata] = {}

        for skills_dir in self.skills_dirs:
            if not await asyncio.to_thread(skills_dir.exists):
                self.logger.debug(f"Skills directory not found: {skills_dir}")
                continue

            self.logger.debug(f"Scanning skills from: {skills_dir}")
            entries = await asyncio.to_thread(lambda: list(skills_dir.iterdir()))

            for skill_dir in entries:
                if not await asyncio.to_thread(skill_dir.is_dir):
                    continue
                skill_file = await self._resolve_skill_file(skill_dir)
                if skill_file is None:
                    continue
                try:
                    skill = await self.loader.load_from_file(skill_file)
                    if skill.name in skills:
                        self.logger.debug(f"Skill {skill.name} overridden by {skills_dir}")
                    skills[skill.name] = skill
                    self.logger.info(f"Loaded skill: {skill.name} from {skills_dir}")
                except Exception as e:
                    self.logger.error(f"Failed to load skill from {skill_dir}: {e}")

        return list(skills.values())

    async def load_all_skills(self, force_reload: bool = False) -> None:
        """保留接口兼容性，实际不做任何事（已无缓存）"""
        pass

    async def get_skill(self, name: str, search_path: Optional[Path] = None) -> Optional[SkillMetadata]:
        """获取指定名称的 Skill（实时扫描磁盘，大小写不敏感）

        查找策略：
        1. 若指定 search_path，仅在该目录下做一次 iterdir() 查找，跳过 skills_dirs 遍历
        2. 否则依次扫描 skills_dirs 中的每个目录
        3. 若 SKILL.md 不在第一层，递归向下查找（兼容平台 skill 包嵌套结构）

        Args:
            name: Skill 名称或 slug（大小写不敏感）
            search_path: 可选，指定在哪个目录下查找，传入时不再遍历 skills_dirs

        Returns:
            SkillMetadata 实例，如果不存在返回 None
        """
        name_lower = name.lower()
        dirs_to_search = [search_path] if search_path is not None else self.skills_dirs

        for skills_dir in dirs_to_search:
            if not await asyncio.to_thread(skills_dir.exists):
                continue
            entries = await asyncio.to_thread(lambda: list(skills_dir.iterdir()))
            for entry in entries:
                if not await asyncio.to_thread(entry.is_dir) or entry.name.lower() != name_lower:
                    continue
                skill_file = await self._resolve_skill_file(entry)
                if skill_file is None:
                    continue
                try:
                    return await self.loader.load_from_file(skill_file)
                except Exception as e:
                    self.logger.warning(f"加载 skill 文件失败 {skill_file}: {e}")

        return None

    async def list_skills(
        self,
        enabled_only: bool = True,
        tags: Optional[List[str]] = None
    ) -> List[SkillMetadata]:
        """列出所有 Skills（实时扫描磁盘）

        Args:
            enabled_only: 是否只返回已启用的 Skills
            tags: 标签过滤器，如果指定则只返回包含这些标签的 Skills

        Returns:
            SkillMetadata 列表
        """
        skills = await self._scan_all_skills()

        if enabled_only:
            skills = [s for s in skills if s.enabled]

        if tags:
            skills = [
                s for s in skills
                if any(tag in s.tags for tag in tags)
            ]

        return skills

    async def search_skills(
        self,
        keyword: str,
        search_in: Optional[List[str]] = None
    ) -> List[SkillMetadata]:
        """搜索 Skills（实时扫描磁盘）

        Args:
            keyword: 搜索关键词
            search_in: 搜索范围，可选值：["name", "description", "tags", "content"]
                      如果为 None，则在所有字段中搜索

        Returns:
            匹配的 SkillMetadata 列表
        """
        if search_in is None:
            search_in = ["name", "description", "tags", "content"]

        keyword_lower = keyword.lower()
        results = []

        for skill in await self._scan_all_skills():
            matched = False

            if "name" in search_in and keyword_lower in skill.name.lower():
                matched = True

            if "description" in search_in and keyword_lower in skill.description.lower():
                matched = True

            if "tags" in search_in:
                if any(keyword_lower in tag.lower() for tag in skill.tags):
                    matched = True

            if "content" in search_in and keyword_lower in skill.content.lower():
                matched = True

            if matched:
                results.append(skill)

        return results

    async def reload_skill(self, name: str) -> Optional[SkillMetadata]:
        """重新加载指定的 Skill（异步）

        Args:
            name: Skill 名称

        Returns:
            更新后的 SkillMetadata 实例
        """
        return await self.get_skill(name)

    async def get_reference_content(self, skill_name: str, ref_file: str) -> str:
        """获取参考文档内容（异步）

        Args:
            skill_name: Skill 名称
            ref_file: 参考文档文件名

        Returns:
            文档内容

        Raises:
            SkillNotFoundError: Skill 不存在
            SkillResourceError: 参考文档不存在
        """
        skill = await self.get_skill(skill_name)
        if not skill:
            raise SkillNotFoundError(f"Skill not found: {skill_name}")

        ref_dir = await skill.get_reference_dir()
        if not ref_dir:
            raise SkillResourceError(f"Skill {skill_name} has no reference directory")

        ref_path = ref_dir / ref_file
        if not await asyncio.to_thread(ref_path.exists):
            raise SkillResourceError(f"Reference file not found: {ref_file}")

        async with aiofiles.open(ref_path, mode='r', encoding='utf-8') as f:
            content = await f.read()

        return remove_developer_annotations(content)

    async def get_resource_path(self, skill_name: str, resource_path: str) -> Path:
        """获取资源文件路径（异步）

        Args:
            skill_name: Skill 名称
            resource_path: 资源相对路径

        Returns:
            资源文件的绝对路径

        Raises:
            SkillNotFoundError: Skill 不存在
            SkillResourceError: 资源不存在
        """
        skill = await self.get_skill(skill_name)
        if not skill:
            raise SkillNotFoundError(f"Skill not found: {skill_name}")

        resources_dir = await skill.get_resources_dir()
        if not resources_dir:
            raise SkillResourceError(f"Skill {skill_name} has no resources directory")

        resource_full_path = resources_dir / resource_path
        if not await asyncio.to_thread(resource_full_path.exists):
            raise SkillResourceError(f"Resource not found: {resource_path}")

        return resource_full_path

    @property
    def loaded(self):
        return True

    @property
    def skills_cache(self):
        return {}
