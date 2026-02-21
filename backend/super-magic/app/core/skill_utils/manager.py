"""全局 Skill 管理器核心：GlobalSkillManager、查找与重装入口"""
from pathlib import Path
from typing import Optional, List

from agentlang.skills import SkillManager
from agentlang.skills.models import SkillMetadata
from agentlang.logger import get_logger

logger = get_logger(__name__)


class GlobalSkillManager:
    """全局 Skill 管理器（单例）"""

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
            from app.paths import PathManager
            cls._project_root = PathManager.get_project_root()
        return cls._project_root

    @classmethod
    def get_skills_dirs(cls) -> List[Path]:
        """获取 skills 目录列表"""
        if cls._skills_dirs is None:
            from app.paths import PathManager
            workspace_dir = PathManager.get_workspace_dir()
            skills_dirs = [
                PathManager.get_agents_dir() / "skills",  # 项目内置 skills（优先级最高，不可被覆盖）
            ]
            # 对 custom_agent，支持加载 agents/crew/{agent_code}/skills 下的私有 skills
            current_agent_type = (cls._current_agent_type or "").strip()
            if current_agent_type:
                try:
                    crew_skills_dir = PathManager.get_crew_skills_dir(current_agent_type)
                    if crew_skills_dir.exists():
                        skills_dirs.append(crew_skills_dir)
                except ValueError as e:
                    logger.warning(f"当前 agent 标识非法，跳过 crew skills 目录: {e}")
            skills_dirs.append(
                workspace_dir / "skills"  # workspace skills（skillhub 安装 + 用户创建，持久化）
            )
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
        """设置当前正在运行的 agent 类型（由 generate_skills_prompt 在初始化时调用）

        Args:
            agent_type: agent 类型名称，如 "skill"、"magic"、"slider" 等
        """
        normalized_agent_type = (agent_type or "").strip()
        if cls._current_agent_type == normalized_agent_type:
            return
        cls._current_agent_type = normalized_agent_type
        # 当前 agent 变化后，刷新目录与 manager，避免继续使用旧 crew skills 路径
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
