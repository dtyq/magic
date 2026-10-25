"""AI 人设研究（persona-research）的结构化文件工具。

模型负责判断和内容（问什么、选谁、主题怎么归纳、结论怎么判断），这些工具负责
ID、编号、引文定位、规则上限、契约校验和落盘。文件契约见
agents/skills/persona-research/reference/file-contracts.md，前端按同一契约解析。
"""

# Explicit exports: app.tools imports these so the PyInstaller image bundles the modules;
# the runtime only discovers tool classes dynamically.
from app.tools.persona_research.check_interviews import CheckInterviews
from app.tools.persona_research.finish_persona_transcript import FinishPersonaTranscript
from app.tools.persona_research.save_personas import SavePersonas
from app.tools.persona_research.persona_portraits import AttachPersonaPortrait
from app.tools.persona_research.assign_persona_portraits import AssignPersonaPortraits
from app.tools.persona_research.embed_persona_portraits import EmbedPersonaPortraits
from app.tools.persona_research.save_study_synthesis import SaveStudySynthesis
from app.tools.persona_research.save_validation_questionnaire import SaveValidationQuestionnaire
from app.tools.persona_research.update_study import UpdateStudy

__all__ = [
    "CheckInterviews",
    "FinishPersonaTranscript",
    "SavePersonas",
    "AttachPersonaPortrait",
    "AssignPersonaPortraits",
    "EmbedPersonaPortraits",
    "SaveStudySynthesis",
    "SaveValidationQuestionnaire",
    "UpdateStudy",
]
