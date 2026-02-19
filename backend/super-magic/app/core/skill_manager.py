"""全局 Skill 管理器

对外唯一入口，所有外部模块均从此处 import。
内部实现委托给 app.core.skill_utils 子包。
"""
from app.core.skill_utils.manager import get_global_skill_manager, find_skill
from app.core.skill_utils.dynamic_config import save_dynamic_config_skills
from app.core.skill_utils.skillhub import skillhub_remove, skillhub_install_github
from app.core.skill_utils.prompt import generate_skills_prompt

__all__ = [
    "get_global_skill_manager",
    "find_skill",
    "save_dynamic_config_skills",
    "skillhub_remove",
    "skillhub_install_github",
    "generate_skills_prompt",
]
