"""Skill 物理来源键常量及目录解析

映射关系（逻辑名 -> 实际目录）：
- system_skills    -> agents/skills/
- workspace_skills -> .workspace/.magic/skills/  （skillhub 安装目录）
                     .workspace/.agents/skills/  （用户/外部扩展目录，按需扫描）
                     ~/.agents/skills/            （用户 home 全局 skills，按需扫描）
- crew_skills      -> agents/crew/{agent_code}/skills/
"""
from __future__ import annotations

from pathlib import Path
from typing import FrozenSet

SKILL_SOURCE_SYSTEM_SKILLS = "system_skills"
SKILL_SOURCE_WORKSPACE_SKILLS = "workspace_skills"
SKILL_SOURCE_CREW_SKILLS = "crew_skills"

ALL_SKILL_SOURCE_KEYS: FrozenSet[str] = frozenset(
    {
        SKILL_SOURCE_SYSTEM_SKILLS,
        SKILL_SOURCE_WORKSPACE_SKILLS,
        SKILL_SOURCE_CREW_SKILLS,
    }
)


def get_agents_dir() -> Path:
    """返回 agents 根目录路径（agents/）"""
    from app.path_manager import PathManager
    return PathManager.get_agents_dir()


def get_system_skills_dir() -> Path:
    """返回 system skills 目录路径（agents/skills/）"""
    from app.path_manager import PathManager
    return PathManager.get_agents_dir() / "skills"


def get_workspace_skills_dir() -> Path:
    """返回 workspace skills 目录路径（.workspace/.magic/skills/）"""
    from app.path_manager import PathManager
    return PathManager.get_magic_dir() / "skills"


def get_agents_workspace_skills_dir() -> Path:
    """返回外部扩展 skills 目录路径（.workspace/.agents/skills/）"""
    from app.path_manager import PathManager
    return PathManager.get_agents_skills_dir()


def get_home_skills_dir() -> Path:
    """返回用户 home 全局 skills 目录路径（~/.agents/skills/）"""
    return Path.home() / ".agents" / "skills"


def get_crew_skills_dir(agent_code: str) -> Path:
    """返回指定 crew agent 的 skills 目录路径（agents/crew/{agent_code}/skills/）"""
    from app.path_manager import PathManager
    return PathManager.get_crew_skills_dir(agent_code)


def get_skills_instructions_prompt_file() -> Path:
    """返回 skills_instructions.prompt 模板文件路径（agents/prompts/skills_instructions.prompt）"""
    from app.path_manager import PathManager
    return PathManager.get_agents_dir() / "prompts" / "skills_instructions.prompt"
