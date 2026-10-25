"""finish_persona_transcript：访谈或焦点小组结束时写入总结、引文和质量指标。

直接挂载给 persona-interviewer 子 Agent（它关闭了 Code Mode，见 agents/persona-interviewer.agent）。
轮次由 persona_chat 追加；本工具只做收尾：

| 由模型给出                                    | 由工具完成                                   |
| summary、key_findings、quotes（原文 + 主题）   | 逐字核对 quotes 都出自受访者的发言            |
| concrete_stories、agreement_flags、notes      | 按 "(inferred)" 句子数算 inferred_ratio      |
| status（done / failed）和失败原因              | 写回记录文件，保留全部轮次                     |

例：quotes 里有一句受访者没说过的话 → 整次收尾不写入，返回找不到的引文，模型改正后重试。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.persona_research.contracts import (
    DISCUSSIONS_DIR,
    DOWNWEIGHT_INFERRED_RATIO,
    INTERVIEWS_DIR,
    TranscriptStatus,
)
from app.tools.persona_research.study_files import (
    StudyFilesError,
    Transcript,
    clean_quote,
    compute_inferred_ratio,
    read_json_file,
    resolve_in_workspace,
    transcript_lock,
    write_json_file,
)
from app.tools.workspace_tool import WorkspaceTool


class TranscriptQuote(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        description="""<!--zh: 受访者的原话，必须逐字出现在某条受访者回答里-->
The participant's exact words; they must appear verbatim in one participant answer.""",
    )
    theme: str = Field(
        default="",
        description="""<!--zh: 这句话对应的简短主题-->
A short theme for this quote.""",
    )


class FinishPersonaTranscriptParams(BaseToolParams):
    transcript_path: str = Field(
        ...,
        description="""<!--zh: persona_chat 写入的记录文件：studies/<slug>/interviews/<persona_id>.json 或 studies/<slug>/discussions/<discussion_id>.json-->
The transcript written by persona_chat: studies/<slug>/interviews/<persona_id>.json or studies/<slug>/discussions/<discussion_id>.json.""",
    )
    status: TranscriptStatus = Field(
        ...,
        description="""<!--zh: done 表示访谈正常结束；failed 表示无法继续（如 persona_chat 重试后仍失败），已完成的轮次会保留-->
done when the session ended normally; failed when it cannot continue (for example persona_chat still fails after one retry). Completed rounds are kept either way.""",
    )
    error: str = Field(
        default="",
        description="""<!--zh: status 为 failed 时必填：失败原因-->
Required when status is failed: why the session could not continue.""",
    )
    summary: str = Field(
        default="",
        description="""<!--zh: 一两句话总结这次访谈，使用访谈语言-->
One or two sentences summarizing the session, in the interview language.""",
    )
    key_findings: List[str] = Field(
        default_factory=list,
        description="""<!--zh: 3-5 条关键发现；焦点小组要写明分歧-->
3-5 key findings. For a focus group, state disagreements explicitly.""",
    )
    quotes: List[TranscriptQuote] = Field(
        default_factory=list,
        description="""<!--zh: 2-5 条受访者原话-->
2-5 quotes in the participants' exact words.""",
    )
    concrete_stories: int = Field(
        default=0,
        ge=0,
        description="""<!--zh: 描述了某次具体过往经历（何时、和谁、发生了什么）的受访者回答数-->
Number of participant answers that describe a specific past event (when, who, what happened).""",
    )
    agreement_flags: int = Field(
        default=0,
        ge=0,
        description="""<!--zh: 只是附和主持人说法、没有补充自身经历的回答数-->
Number of answers that merely agree with the moderator's framing without adding the participant's own experience.""",
    )
    notes: str = Field(
        default="",
        description="""<!--zh: 一句话说明削弱这份记录可信度的问题，没有则留空-->
One sentence on anything that weakens this transcript, or empty.""",
    )


@tool(name="finish_persona_transcript")
class FinishPersonaTranscript(WorkspaceTool[FinishPersonaTranscriptParams]):
    """<!--zh
    结束一份人设访谈或焦点小组记录：写入总结、关键发现、原话引文和质量指标，并把状态设为 done 或 failed。
    工具会逐字核对引文、自动计算 inferred_ratio；访谈轮次由 persona_chat 追加，不要手写记录文件。
    -->
    Close a persona interview or focus-group transcript: write the summary, key findings, verbatim quotes, and quality, and set status to done or failed.
    The tool checks every quote word for word and computes inferred_ratio itself. Rounds are appended by persona_chat; never write the transcript file yourself.
    """

    async def execute(self, tool_context: ToolContext, params: FinishPersonaTranscriptParams) -> ToolResult:
        try:
            path = await resolve_in_workspace(self.base_dir, params.transcript_path)
            if path.parent.name not in (INTERVIEWS_DIR, DISCUSSIONS_DIR):
                raise StudyFilesError(
                    "transcript_path must be under studies/<slug>/interviews/ or studies/<slug>/discussions/"
                )
            if params.status == TranscriptStatus.RUNNING:
                raise StudyFilesError("status must be done or failed; running transcripts are updated by persona_chat")
            if params.status == TranscriptStatus.FAILED and not params.error.strip():
                raise StudyFilesError("error is required when status is failed")
            async with transcript_lock(path):
                return await self._finish(path, params)
        except StudyFilesError as exc:
            return ToolResult.error(f"Transcript not finished: {exc}")

    async def _finish(self, path, params: FinishPersonaTranscriptParams) -> ToolResult:
        data = await read_json_file(path)
        if data is None:
            raise StudyFilesError(f"{params.transcript_path} does not exist; run persona_chat with this transcript_path first")
        kind = "discussion" if path.parent.name == DISCUSSIONS_DIR else "interview"
        transcript = Transcript(file=f"{path.parent.name}/{path.name}", kind=kind, data=data)
        answers = transcript.persona_texts()
        if params.status == TranscriptStatus.DONE and not answers:
            raise StudyFilesError("a done transcript needs at least one recorded answer; use status=failed with the reason")

        missing = [q.text for q in params.quotes if not any(clean_quote(q.text) in text for text in answers)]
        if missing:
            listed = "\n".join(f"- {text[:80]}" for text in missing)
            raise StudyFilesError(
                "these quotes are not the participants' exact words in this transcript; copy them verbatim "
                f"from the answers or remove them:\n{listed}"
            )

        ratio = compute_inferred_ratio(answers)
        data["status"] = params.status.value
        data["error"] = params.error.strip() if params.status == TranscriptStatus.FAILED else ""
        data["summary"] = params.summary.strip()
        data["key_findings"] = [item.strip() for item in params.key_findings if item.strip()]
        data["quotes"] = [{"text": clean_quote(q.text), "theme": q.theme.strip()} for q in params.quotes]
        data["quality"] = {
            "concrete_stories": params.concrete_stories,
            "inferred_ratio": ratio,
            "agreement_flags": params.agreement_flags,
            "notes": params.notes.strip(),
        }
        await write_json_file(path, data)

        lines = [
            f"Finished {params.transcript_path}: status {params.status.value}, "
            f"{transcript.moderator_turns} rounds, {len(answers)} recorded answers, "
            f"{len(params.quotes)} quotes verified, inferred_ratio {ratio:.2f} (computed from the answers).",
        ]
        if ratio >= DOWNWEIGHT_INFERRED_RATIO:
            lines.append("This transcript will be downweighted in synthesis because inferred_ratio is 0.4 or more.")
        return ToolResult(
            content="\n".join(lines),
            data={
                "transcript_path": params.transcript_path,
                "status": params.status.value,
                "rounds": transcript.moderator_turns,
                "inferred_ratio": ratio,
                "key_findings": data["key_findings"],
                "quotes": data["quotes"],
                "error": data["error"],
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
        if not result.ok:
            remark = _translate("finish_persona_transcript.error")
        elif result.data.get("status") == TranscriptStatus.FAILED:
            remark = _translate("finish_persona_transcript.failed", rounds=result.data.get("rounds", 0))
        else:
            remark = _translate("finish_persona_transcript.success", rounds=result.data.get("rounds", 0))
        return {"tool_name": tool_name, "action": _action(), "remark": remark}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        if not result.ok:
            return None
        data = result.data
        lines = [f"# {_translate('finish_persona_transcript.detail_title')}", ""]
        if data.get("error"):
            lines.extend([f"> {data['error']}", ""])
        findings: List[str] = data.get("key_findings") or []
        if findings:
            lines.extend([f"**{_translate('finish_persona_transcript.detail_findings')}**", ""])
            lines.extend(f"- {item}" for item in findings)
            lines.append("")
        quotes: List[Dict[str, str]] = data.get("quotes") or []
        if quotes:
            lines.extend([f"**{_translate('finish_persona_transcript.detail_quotes')}**", ""])
            for quote in quotes:
                lines.extend([f"> {quote['text']}", ""])
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="transcript_summary.md", content="\n".join(lines).rstrip() + "\n"),
        )


def _translate(key: str, **kwargs: Any) -> str:
    return i18n.translate(key, category="tool.messages", **kwargs)


def _action() -> str:
    return i18n.translate("finish_persona_transcript", category="tool.actions")
