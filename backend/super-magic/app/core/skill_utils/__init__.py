"""skill_utils 包公共 API 聚合导出"""
from app.core.skill_utils.constants import (
    SKILLHUB_LOCK_FILE,
    get_skillhub_install_dir,
)
from app.core.skill_utils.manager import (
    GlobalSkillManager,
    get_global_skill_manager,
    get_skills_dirs,
    find_skill,
)
from app.core.skill_utils.skillhub import (
    skillhub_remove,
    skillhub_install_github,
)
from app.core.skill_utils.skill_directory_scan import (
    discover_skills_in_directory,
    discover_skills_in_workspace,
)
from app.core.skill_utils.prompt import (
    generate_skills_prompt,
)
from app.core.skill_utils.skill_sources import (
    ALL_SKILL_SOURCE_KEYS,
    SKILL_SOURCE_SYSTEM_SKILLS,
    SKILL_SOURCE_CREW_SKILLS,
    SKILL_SOURCE_WORKSPACE_SKILLS,
)

__all__ = [
    # constants
    "SKILLHUB_LOCK_FILE",
    "get_skillhub_install_dir",
    # manager
    "GlobalSkillManager",
    "get_global_skill_manager",
    "get_skills_dirs",
    "find_skill",
    # skillhub
    "skillhub_remove",
    "skillhub_install_github",
    # skill_directory_scan
    "discover_skills_in_directory",
    "discover_skills_in_workspace",
    # prompt
    "generate_skills_prompt",
    # skill_sources
    "ALL_SKILL_SOURCE_KEYS",
    "SKILL_SOURCE_SYSTEM_SKILLS",
    "SKILL_SOURCE_CREW_SKILLS",
    "SKILL_SOURCE_WORKSPACE_SKILLS",
]
