"""save_validation_questionnaire：写出可导入问卷工具的 validation-questionnaire.csv。

模型使用说明：agents/skills/persona-research/reference/tools.md（code_mode_only，完整用法只维护在 Skill）。

此前 5 次研究都靠临时 Python 写 CSV，界面上是一张代码卡片。工具负责：
- 列固定为 question_id, question, type, options, hypothesis_id；options 用 | 连接；
- UTF-8 带 BOM，Excel 直接打开不乱码；
- 校验题号不重复、选择题至少 2 个选项、开放题没有选项、hypothesis_id 在 study.json 里存在。
validation-questionnaire.md 是给人读的说明（招募、邀请话术等），仍由模型撰写。
"""

from __future__ import annotations

import csv
import io
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.persona_research.contracts import QuestionType
from app.tools.persona_research.study_files import StudyFilesError, load_study, resolve_study_dir, write_text_file
from app.tools.workspace_tool import WorkspaceTool

CSV_NAME = "validation-questionnaire.csv"


class QuestionInput(BaseModel):
    id: str = Field(..., pattern=r"^[A-Z]{1,3}\d+$", description="Q1, Q2, ... for guide questions; S1, S2, ... for screening.")
    question: str = Field(..., min_length=1)
    type: QuestionType
    options: List[str] = Field(default_factory=list)
    hypothesis_id: str = Field(default="", description="Empty for screening questions.")


class SaveValidationQuestionnaireParams(BaseToolParams):
    study_dir: str = Field(..., description="studies/<slug>")
    questions: List[QuestionInput] = Field(..., min_length=1, description="Screening questions first, then guide questions.")


# 模型使用说明：agents/skills/persona-research/reference/tools.md
@tool(name="save_validation_questionnaire", code_mode_only=True)
class SaveValidationQuestionnaire(WorkspaceTool[SaveValidationQuestionnaireParams]):
    """Write the real-person validation questionnaire as a survey-import CSV."""

    async def execute(self, tool_context: ToolContext, params: SaveValidationQuestionnaireParams) -> ToolResult:
        try:
            study_path = await resolve_study_dir(self.base_dir, params.study_dir)
            study = await load_study(study_path)
            _check(params.questions, {h.id for h in study.hypotheses})
            buffer = io.StringIO()
            writer = csv.writer(buffer)
            writer.writerow(["question_id", "question", "type", "options", "hypothesis_id"])
            for q in params.questions:
                writer.writerow([q.id, q.question.strip(), q.type.value, "|".join(o.strip() for o in q.options), q.hypothesis_id])
            await write_text_file(study_path / CSV_NAME, buffer.getvalue(), encoding="utf-8-sig")
        except StudyFilesError as exc:
            return ToolResult.error(f"Questionnaire CSV not saved: {exc}")

        linked = sum(1 for q in params.questions if q.hypothesis_id)
        return ToolResult(
            content=(
                f"Saved {params.study_dir}/{CSV_NAME}: {len(params.questions)} questions, "
                f"{linked} linked to hypotheses, {len(params.questions) - linked} screening or general."
            ),
            data={"file": f"{params.study_dir}/{CSV_NAME}", "questions": len(params.questions), "linked": linked},
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        if result.ok:
            remark = _translate("save_validation_questionnaire.success", count=result.data.get("questions", 0))
        else:
            remark = _translate("save_validation_questionnaire.error")
        action = i18n.translate("save_validation_questionnaire", category="tool.actions")
        return {"tool_name": tool_name, "action": action, "remark": remark}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        if not result.ok:
            return None
        lines = [f"# {_translate('save_validation_questionnaire.detail_title')}", ""]
        for q in (arguments or {}).get("questions") or []:
            tag = f" [{q.get('hypothesis_id')}]" if q.get("hypothesis_id") else ""
            lines.append(f"- **{q.get('id')}**{tag} {q.get('question')}")
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="validation_questionnaire.md", content="\n".join(lines) + "\n"),
        )


def _check(questions: List[QuestionInput], hypothesis_ids: set[str]) -> None:
    ids = [q.id for q in questions]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        raise StudyFilesError(f"duplicate question ids: {', '.join(duplicates)}")
    for q in questions:
        if q.type == QuestionType.OPEN and q.options:
            raise StudyFilesError(f"{q.id} is open but has options; remove them or use a choice type")
        if q.type != QuestionType.OPEN and len([o for o in q.options if o.strip()]) < 2:
            raise StudyFilesError(f"{q.id} is a choice question and needs at least 2 options")
        if any("|" in option for option in q.options):
            raise StudyFilesError(f"{q.id} has an option containing '|', which separates options in the CSV")
        if q.hypothesis_id and q.hypothesis_id not in hypothesis_ids:
            raise StudyFilesError(f"{q.id} cites {q.hypothesis_id}, which is not in study.json")


def _translate(key: str, **kwargs: Any) -> str:
    return i18n.translate(key, category="tool.messages", **kwargs)
