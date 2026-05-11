"""Skill Provider 抽象层

各来源的 SkillProvider 实现。
"""

from app.core.skill_utils.providers.base import (
    SkillProviderId,
    SkillCandidate,
    FetchedSkill,
    SkillProvider,
)
from app.core.skill_utils.providers.system_skills import SystemSkillsProvider
from app.core.skill_utils.providers.my_library import MyLibraryProvider
from app.core.skill_utils.providers.magic_market import MagicMarketProvider
from app.core.skill_utils.providers.github import GitHubProvider
from app.core.skill_utils.providers.skillhub import SkillHubProvider
from app.core.skill_utils.providers.clawhub import ClawHubProvider
from app.core.skill_utils.providers.npx import NpxProvider

__all__ = [
    "SkillProviderId",
    "SkillCandidate",
    "FetchedSkill",
    "SkillProvider",
    "SystemSkillsProvider",
    "MyLibraryProvider",
    "MagicMarketProvider",
    "GitHubProvider",
    "SkillHubProvider",
    "ClawHubProvider",
    "NpxProvider",
]
