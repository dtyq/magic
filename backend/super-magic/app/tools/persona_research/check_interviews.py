"""check_interviews：只读检查访谈进度，告诉主 Agent 谁做完了、谁卡住、还差几轮。

模型使用说明：agents/skills/persona-research/reference/tools.md（code_mode_only，完整用法只维护在 Skill）。

替代此前每次中断后临时写 Python「检查访谈落盘状态」。例：子 Agent 被中断时，
5 份记录停在 running、只有 3-4 轮 → 本工具列出这 5 位和各自下一轮，主 Agent 派续跑子 Agent。

| 记录状态          | 判定       | 建议                                     |
| 不存在            | 未开始     | 续跑，从第 1 轮开始                       |
| running           | 进行中     | 续跑，从「已记录轮数 + 1」开始            |
| done              | 已完成     | 计入有效样本                              |
| failed            | 失败       | 保留失败原因；只有原因已排除时才重跑      |

疑似连问（只提醒，不拦截）：persona_chat 拒绝多个问号，并对「问号不超过一个、两个提问分句」做语义判定；
判定放行或判定不可用的轮次仍在这里标出，作为综合前的复核清单（初筛偏宽，标出的不一定都是连问）。
例：「什么样的会员你不会买，如果这条解决了你会买吗？」→ 标出来，综合时把第二问的回答当作被问到才说。
「那次从头到尾怎么回事？比如几点、和谁」这类细节提示不算（以「比如、具体、讲讲」等开头的分句不计）。
初筛规则和回测见 semantic_checks.asks_joined_questions；误标成本只是一行提醒。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.persona_research.contracts import MAX_INTERVIEW_ROUNDS, PERSONAS_DIR, TranscriptStatus
from app.tools.persona_research.semantic_checks import asks_joined_questions
from app.tools.persona_research.study_files import (
    StudyFilesError,
    load_study,
    load_transcripts,
    read_json_file,
    resolve_study_dir,
)
from app.tools.workspace_tool import WorkspaceTool

NOT_STARTED = "not_started"


class CheckInterviewsParams(BaseToolParams):
    study_dir: str = Field(..., description="studies/<slug>")


# 模型使用说明：agents/skills/persona-research/reference/tools.md
@tool(name="check_interviews", code_mode_only=True)
class CheckInterviews(WorkspaceTool[CheckInterviewsParams]):
    """Report interview and focus-group progress for a study and which personas need to continue."""

    async def execute(self, tool_context: ToolContext, params: CheckInterviewsParams) -> ToolResult:
        try:
            study_path = await resolve_study_dir(self.base_dir, params.study_dir)
            study = await load_study(study_path)
            panel = await read_json_file(study_path / "panel.json")
        except StudyFilesError as exc:
            return ToolResult.error(f"Interviews not checked: {exc}")
        if panel is None:
            return ToolResult.error("Interviews not checked: panel.json does not exist yet; save the personas with save_personas first.")

        limit = study.limits.interview_rounds if study.limits else MAX_INTERVIEW_ROUNDS
        transcripts = await load_transcripts(study_path)
        interviews = {t.persona_id: t for t in transcripts if not t.is_discussion}
        rows: List[Dict[str, Any]] = []
        for pid in panel.get("persona_ids") or []:
            transcript = interviews.get(pid)
            rows.append({
                "persona_id": pid,
                "name": await _persona_name(self.base_dir, pid),
                "file": f"interviews/{pid}.json",
                "status": transcript.status if transcript else NOT_STARTED,
                "rounds": transcript.moderator_turns if transcript else 0,
                "limit": limit,
                "error": str(transcript.data.get("error") or "") if transcript else "",
            })
        discussions = [
            {"file": t.file, "status": t.status, "rounds": t.moderator_turns, "participants": t.data.get("participants") or []}
            for t in transcripts
            if t.is_discussion
        ]
        joined = [
            {"file": t.file, "round": index, "text": text}
            for t in transcripts
            for index, text in enumerate(t.moderator_texts(), start=1)
            if asks_joined_questions(text)
        ]
        done = [row for row in rows if row["status"] == TranscriptStatus.DONE]
        unfinished = [row for row in rows if row["status"] in (TranscriptStatus.RUNNING, NOT_STARTED)]
        failed = [row for row in rows if row["status"] == TranscriptStatus.FAILED]

        lines = [f"Interviews in {params.study_dir}: {len(done)} done, {len(unfinished)} unfinished, {len(failed)} failed (round limit {limit})."]
        lines.extend(
            f"- {row['persona_id']}: {row['status']}, {row['rounds']}/{limit} rounds" + (f", error: {row['error']}" if row["error"] else "")
            for row in rows
        )
        lines.extend(f"- discussion {d['file']}: {d['status']}, {d['rounds']} rounds" for d in discussions)
        if joined:
            lines.append(
                "Possible two questions under one question mark (review; in synthesis, mark answers to the second "
                "part as prompted, and ask one question per round in any continuation):"
            )
            lines.extend(f"- {item['file']} round {item['round']}: {item['text'][:80]}" for item in joined)
        if unfinished:
            lines.append(
                "Next: dispatch interviewer sub-agents to continue these transcripts with persona_chat, starting at round "
                + "; ".join(f"{row['persona_id']} round {row['rounds'] + 1}" for row in unfinished)
                + ". Tell them the transcript already holds the earlier rounds."
            )
        elif any(d["status"] == TranscriptStatus.RUNNING for d in discussions):
            lines.append("Next: finish the running focus group before moving on.")
        else:
            lines.append(
                f"Next: all interviews have ended; the effective sample is {len(done)}. "
                "Call update_study with event=interviews_finished."
            )
        return ToolResult(
            content="\n".join(lines),
            data={
                "study_dir": params.study_dir,
                "limit": limit,
                "interviews": rows,
                "discussions": discussions,
                "effective_sample": len(done),
                "joined_questions": joined,
            },
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        # 例：「访谈进度：6/8 位已完成」
        if result.ok:
            rows = result.data.get("interviews") or []
            remark = _translate("check_interviews.success", done=result.data.get("effective_sample", 0), total=len(rows))
        else:
            remark = _translate("check_interviews.error")
        return {"tool_name": tool_name, "action": i18n.translate("check_interviews", category="tool.actions"), "remark": remark}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        if not result.ok:
            return None
        lines = [
            f"# {_translate('check_interviews.detail_title')}",
            "",
            f"| {_translate('check_interviews.col_persona')} | {_translate('check_interviews.col_status')} | {_translate('check_interviews.col_rounds')} |",
            "| --- | --- | --- |",
        ]
        for row in result.data.get("interviews") or []:
            status = _translate(f"check_interviews.status.{row['status']}")
            lines.append(f"| {row['name']} | {status} | {row['rounds']}/{row['limit']} |")
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="interview_progress.md", content="\n".join(lines) + "\n"),
        )


async def _persona_name(base_dir, persona_id: str) -> str:
    """卡片给用户看人设名字；档案读不到时退回 ID。"""
    try:
        profile = await read_json_file(base_dir / PERSONAS_DIR / f"{persona_id}.json")
    except StudyFilesError:
        profile = None
    return str((profile or {}).get("name") or persona_id)


def _translate(key: str, **kwargs: Any) -> str:
    return i18n.translate(key, category="tool.messages", **kwargs)
