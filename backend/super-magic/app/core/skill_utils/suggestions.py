"""Skill 阅读建议的共享契约，不负责触发事件或读取正文。"""

from pydantic import BaseModel, ConfigDict, Field


SKILL_SUGGESTION_NOTIFICATION_SOURCE = "skill_suggestions"


class SkillSuggestion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, frozen=True)

    name: str = Field(min_length=1, description="Name of an available Skill.")
    reason: str = Field(
        min_length=1,
        description="Brief reason this Skill may help with the remaining work.",
    )
