"""前台执行与后台捕获共用的压缩结果。"""

from dataclasses import dataclass

from app.core.skill_utils.suggestions import SkillSuggestion


@dataclass(frozen=True)
class CompactResult:
    # 摘要已经恢复所选用户原文；建议只随成功应用的摘要进入父上下文，不自动读取 Skill。
    summary: str
    skill_suggestions: tuple[SkillSuggestion, ...]
