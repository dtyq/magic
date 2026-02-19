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
from app.core.skill_utils.registry import (
    load_skill_registry,
    update_skill_registry,
    SKILL_META_FILENAME,
)
from app.core.skill_utils.dynamic_config import (
    save_dynamic_config_skills,
    load_dynamic_config_skills,
)
from app.core.skill_utils.downloader import (
    download_and_install_dynamic_skill,
)
from app.core.skill_utils.skillhub import (
    skillhub_remove,
    skillhub_install_github,
)
from app.core.skill_utils.prompt import (
    generate_skills_prompt,
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
    # registry
    "SKILL_META_FILENAME",
    "load_skill_registry",
    "update_skill_registry",
    # dynamic_config
    "save_dynamic_config_skills",
    "load_dynamic_config_skills",
    # downloader
    "download_and_install_dynamic_skill",
    # skillhub
    "skillhub_remove",
    "skillhub_install_github",
    # prompt
    "generate_skills_prompt",
]
