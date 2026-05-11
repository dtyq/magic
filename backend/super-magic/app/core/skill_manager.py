"""全局 Skill 管理器

对外唯一入口，所有外部模块均从此处 import。
内部实现委托给 app.core.skill_utils 子包。

新 API（推荐使用）：
- InstallService / SkillRef / InstallResult：统一安装接口
- SearchAggregator / SearchResult：多来源检索
- ProviderRegistry / get_registry：Provider 注册中心
- SkillProviderId / SkillCandidate：Provider 数据类型

旧 API（Deprecated，仅保留向后兼容）：
- skillhub_remove / skillhub_install_github / skillhub_install_platform_me / skillhub_install_platform_market
"""
from app.core.skill_utils.manager import get_global_skill_manager, find_skill
from app.core.skill_utils.skillhub import (
    skillhub_remove,
    skillhub_install_github,
    skillhub_install_platform_me,
    skillhub_install_platform_market,
)
from app.core.skill_utils.prompt import generate_skills_prompt

# ── 新 API ────────────────────────────────────────────────────────────────────
from app.core.skill_utils.installer import InstallService, SkillRef, InstallResult, InstallBatchResult
from app.core.skill_utils.search_service import SearchAggregator, SearchResult
from app.core.skill_utils.providers.registry import get_registry, ProviderRegistry
from app.core.skill_utils.providers.base import SkillProviderId, SkillCandidate, FetchedSkill
from app.core.skill_utils.manifest import SkillManifest, read_manifest, write_manifest
from app.core.skill_utils.version import version_gt, version_eq, compare as version_compare

__all__ = [
    # 核心管理器
    "get_global_skill_manager",
    "find_skill",
    "generate_skills_prompt",
    # 安装服务（新）
    "InstallService",
    "SkillRef",
    "InstallResult",
    "InstallBatchResult",
    # 检索服务（新）
    "SearchAggregator",
    "SearchResult",
    # Provider 注册中心（新）
    "get_registry",
    "ProviderRegistry",
    "SkillProviderId",
    "SkillCandidate",
    "FetchedSkill",
    # Manifest（新）
    "SkillManifest",
    "read_manifest",
    "write_manifest",
    # 版本比较（新）
    "version_gt",
    "version_eq",
    "version_compare",
    # Deprecated
    "skillhub_remove",
    "skillhub_install_github",
    "skillhub_install_platform_me",
    "skillhub_install_platform_market",
]
