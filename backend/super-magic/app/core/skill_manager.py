"""全局 Skill 管理器

对外唯一入口，所有外部模块均从此处 import。
内部实现委托给 app.core.skill_utils 子包。
"""
from app.core.skill_utils.manager import get_global_skill_manager, find_skill
from app.core.skill_utils.skillhub import skillhub_remove, skillhub_install_github, skillhub_install_platform_me, skillhub_install_platform_market
from app.core.skill_utils.prompt import generate_skills_prompt

__all__ = [
    "get_global_skill_manager",
    "find_skill",
    "skillhub_remove",
    "skillhub_install_github",
    "skillhub_install_platform_me",
    "skillhub_install_platform_market",
    "generate_skills_prompt",
]
