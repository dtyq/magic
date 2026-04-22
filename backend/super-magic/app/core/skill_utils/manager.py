"""全局 Skill 管理器核心：GlobalSkillManager、查找与重装入口"""
from pathlib import Path
from typing import List, Optional

from agentlang.skills import SkillManager
from agentlang.skills.models import SkillMetadata
from agentlang.logger import get_logger

logger = get_logger(__name__)


class GlobalSkillManager:
    """全局 Skill 管理器（单例）

    负责维护所有 skill 目录（system、crew、workspace）并创建 SkillManager 实例。
    skills_dir_allowlist 属于 prompt 生成层的运行时过滤策略，不在此处存储。
    """

    _instance: Optional['GlobalSkillManager'] = None
    _skill_manager: Optional[SkillManager] = None
    _skills_dirs: Optional[List[Path]] = None
    _project_root: Optional[Path] = None
    _current_agent_type: Optional[str] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """初始化时不创建 SkillManager，延迟到首次使用时"""
        pass

    @classmethod
    def get_project_root(cls) -> Path:
        """获取项目根目录（缓存）"""
        if cls._project_root is None:
            from app.path_manager import PathManager
            cls._project_root = PathManager.get_project_root()
        return cls._project_root

    @classmethod
    def get_skills_dirs(cls) -> List[Path]:
        """获取 skills 目录列表（供 SkillManager / skill_read / find_skill 全量解析）。

        与系统提示中的「展示哪些 skill」无关：`agents/skills` 下仅 `<!-- skills: ... -->` 列出的名称会进入
        skills prompt；`skills_dir` 只影响 prompt 内是否额外合并 workspace 扫描结果，见 generate_skills_prompt。
        """
        if cls._skills_dirs is None:
            from app.core.skill_utils.skill_sources import (
                get_system_skills_dir,
                get_crew_skills_dir,
                get_workspace_skills_dir,
                get_agents_workspace_skills_dir,
                get_home_skills_dir,
            )

            skills_dirs = [get_system_skills_dir()]
            current_agent_type = (cls._current_agent_type or "").strip()
            if current_agent_type:
                try:
                    crew_skills_dir = get_crew_skills_dir(current_agent_type)
                    if crew_skills_dir.exists():
                        skills_dirs.append(crew_skills_dir)
                except ValueError as e:
                    logger.warning(f"当前 agent 标识非法，跳过 crew skills 目录: {e}")
            skills_dirs.append(get_workspace_skills_dir())
            skills_dirs.append(get_agents_workspace_skills_dir())
            skills_dirs.append(get_home_skills_dir())
            cls._skills_dirs = skills_dirs
            logger.info(f"初始化 skills 目录: {[str(d) for d in cls._skills_dirs]}")
        return cls._skills_dirs

    @classmethod
    def get_skill_manager(cls) -> SkillManager:
        """获取 SkillManager 实例（单例）"""
        if cls._skill_manager is None:
            skills_dirs = cls.get_skills_dirs()
            cls._skill_manager = SkillManager(skills_dirs=skills_dirs)
            logger.info("全局 SkillManager 实例已创建")
        return cls._skill_manager

    @classmethod
    def set_current_agent_type(cls, agent_type: str) -> None:
        """设置当前 agent 类型，用于解析 crew skills 目录路径并重建 SkillManager。

        由 generate_skills_prompt 在 Agent 初始化时调用。skills_dir_allowlist 属于 prompt 生成层的
        过滤策略，不在此处存储——调用方直接将其作为参数传递即可。

        Args:
            agent_type: agent 类型名称（如 "magic"、"skill"），用于定位 crew skills 目录
        """
        normalized_agent_type = (agent_type or "").strip()
        if cls._current_agent_type == normalized_agent_type:
            return
        cls._current_agent_type = normalized_agent_type
        cls._skills_dirs = None
        cls._skill_manager = None
        logger.debug(f"当前 agent 类型已设置为: {normalized_agent_type}")

    @classmethod
    def get_current_agent_type(cls) -> str:
        """获取当前运行的 agent 类型

        Returns:
            str: agent 类型名称，未设置时返回空字符串
        """
        return cls._current_agent_type or ""

    @classmethod
    def reset(cls):
        """重置全局管理器（主要用于测试）"""
        cls._skill_manager = None
        cls._skills_dirs = None
        cls._project_root = None
        cls._current_agent_type = None
        logger.info("全局 SkillManager 已重置")


# 便捷函数
def get_global_skill_manager() -> SkillManager:
    """获取全局 SkillManager 实例"""
    return GlobalSkillManager.get_skill_manager()


def get_skills_dirs() -> List[Path]:
    """获取 skills 目录列表"""
    return GlobalSkillManager.get_skills_dirs()


async def find_skill(skill_name: str) -> Optional[SkillMetadata]:
    """大小写不敏感地查找 skill

    直接委托给 SkillManager.get_skill，后者已内置大小写不敏感匹配和按需单文件加载。
    """
    skill_manager = get_global_skill_manager()
    return await skill_manager.get_skill(skill_name)
