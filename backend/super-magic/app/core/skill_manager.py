"""全局 Skill 管理器

对外唯一入口，所有外部模块均从此处 import。
内部实现委托给 app.core.skill_utils 子包。
"""
from typing import Optional, List

from agentlang.skills import SkillManager
from agentlang.skills.models import SkillMetadata
from app.core.skill_utils import manager as _mgr
from app.core.skill_utils import dynamic_config as _dyn
from app.core.skill_utils import skillhub as _hub
from app.core.skill_utils import prompt as _pmt


# ──────────────────────────────────────────────
# 全局管理器
# ──────────────────────────────────────────────

def get_global_skill_manager() -> SkillManager:
    return _mgr.get_global_skill_manager()


# ──────────────────────────────────────────────
# Skill 查找与重装
# ──────────────────────────────────────────────

async def get_skill_with_reinstall(skill_name: str) -> Optional[SkillMetadata]:
    return await _mgr.get_skill_with_reinstall(skill_name)


# ──────────────────────────────────────────────
# Dynamic config skills
# ──────────────────────────────────────────────

async def save_dynamic_config_skills(skills: List[dict], agent_type: str = "") -> None:
    await _dyn.save_dynamic_config_skills(skills, agent_type)


# ──────────────────────────────────────────────
# Skillhub 操作
# ──────────────────────────────────────────────

async def refresh_installed_skills_meta() -> None:
    await _hub.refresh_installed_skills_meta()


async def skillhub_remove(identifier: str) -> tuple[bool, str]:
    return await _hub.skillhub_remove(identifier)


async def skillhub_install_github(url: str) -> tuple[bool, str]:
    return await _hub.skillhub_install_github(url)


# ──────────────────────────────────────────────
# Prompt 生成
# ──────────────────────────────────────────────

def generate_skills_prompt(skills_list: List[str], agent_name: str = "") -> Optional[str]:
    return _pmt.generate_skills_prompt(skills_list, agent_name)
