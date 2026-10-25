"""persona_chat：让 AI 人设以受访者身份回答主持人的问题。

访谈采用"主持人 + 受访者"双角色：主持人（persona-interviewer 子 Agent）决定问什么，
本工具对每个人设单独调用一次模型，以人设档案作为系统提示生成回答。两种角色由
独立的模型调用扮演，避免主持人"自问自答"导致回答同质化。

| persona_paths 数量 | 场景     | 行为                                         |
| 1                  | 一对一访谈 | 单个人设回答                                 |
| 2–6                | 焦点小组   | 按顺序回答，后回答的人能看到本轮前面人的发言 |

部分失败语义：例如 3 人小组中 2 人回答成功、1 人失败，保留 2 条回答并列出失败项；
ok 只在所有人设都成功回答时为 True。

| transcript_path | 行为                                                                 |
| 不传            | 只回答，不写文件（主 Agent 试探、一次性提问）                          |
| 传入            | 读取记录作为上下文，并把本轮主持人问题和成功的回答追加到记录里         |

一轮只问一件事：问题里有 2 个及以上问号，或「第一……第二……」式枚举，直接拒绝，不调用模型、
不计轮次。问号不超过一个但有 2 个提问分句时（「什么样的你不会买，如果解决了你会买吗？」，或把问号换成句号），
再用一次小模型判定是不是两件事；是则同样拒绝，判定失败则放行（semantic_checks.py）。
真实研究里提纲 8 题塞进 5 轮，40 轮里有 37 轮一次问三五件事，受访者只能逐条简答，没有追问空间。例：「你最想弄清楚什么？哪条规则会让你觉得亏？」→ 拒绝，应拆成两轮。

记录由工具追加而不是由模型手写：模型手写时曾把 role 写成 speaker、自编 round_index、
整文件重写时写坏 JSON，引文的 round_index 也因此对不上。round_number 用来防止重复写入：
例：记录里已有 3 轮，再传 round_number=3 会被拒绝（多半是重试），应传 4。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.llms.factory import LLMFactory
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.token_estimator import truncate_text_by_token
from app.core.context.run_interruption import await_with_interruption
from app.core.entity.message.server_message import (
    DisplayType,
    PersonaChatAnswerContent,
    PersonaChatContent,
    PersonaChatFailureContent,
    ToolDetail,
)
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive
from app.tools.media_utils.constants import DISABLE_THINKING_BODY
from app.tools.persona_research.contracts import (
    DISCUSSIONS_DIR,
    INTERVIEWS_DIR,
    MAX_DISCUSSION_ROUNDS,
    MAX_DISCUSSIONS,
    MAX_INTERVIEW_ROUNDS,
    SCHEMA_VERSION,
    TranscriptStatus,
)
from app.tools.persona_research.semantic_checks import (
    JudgeUnavailable,
    asks_joined_questions,
    judge_joined_question,
    resolve_model_id,
)
from app.tools.persona_research.study_files import (
    StudyFilesError,
    compute_inferred_ratio,
    load_study,
    portrait_hint,
    read_json_file,
    transcript_lock,
    write_json_file,
)
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_read_json, async_realpath

logger = get_logger(__name__)

# 与 persona-research skill 中的成本上限保持一致（单次回答默认 400、最多 800 tokens）。
DEFAULT_MAX_TOKENS = 400
MAX_TOKENS_LIMIT = 800
MIN_MAX_TOKENS = 100
MAX_PERSONAS = 6
# 只把最近的对话轮次带给受访者：一对一自动访谈最多 20 轮，40 条保留完整问答；小组及额外手动追问保留最近对话。
MAX_TRANSCRIPT_TURNS = 40
MAX_TURN_CHARS = 1500
MAX_PROFILE_TOKENS = 4000


class PersonaChatFailureReason(StrEnum):
    """失败原因分类，只用于前端展示的脱敏文案；完整错误只写入给模型的 content。"""

    PROFILE_UNAVAILABLE = "profile_unavailable"
    MODEL_ERROR = "model_error"
    EMPTY_ANSWER = "empty_answer"


INVALID_REQUEST_REASON = "invalid_request"


class PersonaChatParams(BaseToolParams):
    persona_paths: List[str] = Field(
        ...,
        min_length=1,
        max_length=MAX_PERSONAS,
        description="""<!--zh: 1–6 个人设 JSON 的工作区路径（如 personas/p_xxx_1a2b.json）；多于 1 个时为焦点小组，按列表顺序发言-->
Workspace paths of 1-6 persona JSON files (for example personas/p_xxx_1a2b.json). One path runs a one-on-one interview; 2-6 paths run a focus group where participants answer in list order.""",
    )
    question: str = Field(
        ...,
        min_length=1,
        description="""<!--zh: 主持人这一轮要说的话：只问一个开放式问题或一个追问。多个问号或「第一…第二…」枚举会被拒绝-->
What the moderator says in this round: exactly one open question or follow-up probe. A message with several question marks or a numbered list of questions is rejected.""",
    )
    transcript_path: str = Field(
        default="",
        description="""<!--zh: 可选：本次访谈的记录文件，studies/<slug>/interviews/<persona_id>.json（一对一，文件名必须是该人设 ID）或 studies/<slug>/discussions/<discussion_id>.json（焦点小组）。传入后工具读取已有记录作为上下文，并自动把本轮问题和回答追加进去；文件不存在时自动创建。不传则只回答、不记录-->
Optional transcript file for this session: studies/<slug>/interviews/<persona_id>.json for a one-on-one interview (the file name must be that persona's ID) or studies/<slug>/discussions/<discussion_id>.json for a focus group. When set, the tool uses the existing transcript as context and appends this round's question and answers to it, creating the file on the first round. Leave empty to get answers without recording them.""",
    )
    round_number: int = Field(
        default=0,
        description="""<!--zh: 使用 transcript_path 时必填：本轮是第几轮，从 1 开始（一轮 = 一个主持人问题 + 回答）。必须等于记录里已有轮数加 1，否则不调用模型并返回当前轮数-->
Required with transcript_path: the number of this round, starting at 1 (one round = one moderator message plus the answers). It must equal the rounds already recorded plus one; otherwise no answer is generated and the tool reports the current round count.""",
    )
    topic: str = Field(
        default="",
        max_length=80,
        description="""<!--zh: 焦点小组的讨论主题（一句话，用户语言），首轮传入，写进讨论记录供界面展示；一对一访谈不用-->
Focus groups only: the discussion topic in one short line, in the user's language. Pass it on the first round; it is saved in the discussion transcript and shown in the UI. Ignored for one-on-one interviews.""",
    )
    max_tokens: int = Field(
        default=DEFAULT_MAX_TOKENS,
        description="""<!--zh: 每个人设回答的 token 上限，默认 400，最大 800-->
Token limit for each persona's answer. Default 400, maximum 800.""",
    )
    follow_up_request_id: str = Field(
        default="",
        max_length=100,
        description="User-initiated interview chat only: copy the request ID from the user's interview follow-up context. Requires one persona and an existing transcript. Records exactly this user message, outside the automatic interview round budget. Reuse the same ID on retries; never invent one for automatic interviews.",
    )

    @field_validator("max_tokens", mode="before")
    @classmethod
    def clamp_max_tokens(cls, value: Any) -> int:
        # 超出范围时收紧到合法区间，而不是拒绝调用：上限是成本保护，不是调用错误。
        try:
            number = int(value)
        except (TypeError, ValueError):
            return DEFAULT_MAX_TOKENS
        return max(MIN_MAX_TOKENS, min(MAX_TOKENS_LIMIT, number))


@dataclass(frozen=True)
class _Persona:
    persona_id: str
    name: str
    path: str
    profile: Dict[str, Any]


@dataclass(frozen=True)
class _Answer:
    persona_id: str
    name: str
    text: str


@dataclass(frozen=True)
class _Failure:
    persona_id: str
    path: str
    reason: PersonaChatFailureReason
    error: str


class _InvalidRequest(ValueError):
    """路径越界、重复等调用参数问题，整次调用直接失败。"""


@dataclass
class _Record:
    """本次调用要追加的访谈或焦点小组记录。"""

    path: Path
    raw_path: str
    is_discussion: bool
    data: Dict[str, Any]
    round_number: int
    round_limit: int


@tool()
class PersonaChat(WorkspaceTool[PersonaChatParams]):
    """<!--zh
    让 AI 人设以受访者身份回答主持人的一个问题，用于消费者研究的一对一访谈和焦点小组。
    每个人设由一次独立的模型调用扮演，回答保留人设自己的语言和口吻。传入 transcript_path 和 round_number 时，工具把本轮问题和回答逐字追加到记录文件，调用方不要再手写记录。
    -->
    Have AI personas answer one moderator question as research participants, for one-on-one consumer interviews and focus groups.
    Each persona is played by a separate model call and answers in its own voice. With transcript_path and round_number, the tool appends this round's question and the verbatim answers to the transcript file; do not write transcripts yourself.
    """

    async def execute(self, tool_context: ToolContext, params: PersonaChatParams) -> ToolResult:
        # 自动主持人必须逐题提问；用户手动聊天保留原话，不替用户改写或拆分问题。
        if not params.follow_up_request_id and _asks_several_things(params.question):
            return ToolResult.error(
                "Nothing was asked or recorded: the moderator message asks more than one thing (several question "
                "marks or a numbered list). Ask one open question per round and keep the rest for later rounds; "
                "when you restate the participant's words, end that part with a period, not a question mark.",
                extra_info={"user_error_reason": INVALID_REQUEST_REASON},
            )
        joined_reason = "" if params.follow_up_request_id else await _joined_question_reason(tool_context, params.question)
        if joined_reason:
            return ToolResult.error(
                f"Nothing was asked or recorded: the moderator message asks two different things under one question "
                f"mark ({joined_reason}). Ask one of them now and the other in the next round.",
                extra_info={"user_error_reason": INVALID_REQUEST_REASON},
            )
        try:
            if params.follow_up_request_id and (len(params.persona_paths) != 1 or not params.transcript_path):
                raise _InvalidRequest("user-initiated chat requires one persona and an existing interview transcript")
            persona_files = [await self._resolve_workspace_path(path) for path in params.persona_paths]
            transcript_file = (
                await self._resolve_workspace_path(params.transcript_path)
                if params.transcript_path.strip()
                else None
            )
            if len(set(persona_files)) != len(persona_files):
                raise _InvalidRequest("persona_paths contains the same persona more than once")
        except _InvalidRequest as exc:
            return ToolResult.error(
                f"Invalid persona_chat request: {exc}. Use workspace-relative paths such as personas/<persona_id>.json.",
                extra_info={"user_error_reason": INVALID_REQUEST_REASON},
            )

        personas: List[_Persona] = []
        failures: List[_Failure] = []
        for raw_path, file_path in zip(params.persona_paths, persona_files):
            loaded = await self._load_persona(raw_path, file_path)
            if isinstance(loaded, _Failure):
                failures.append(loaded)
            else:
                personas.append(loaded)

        if transcript_file is None:
            answers = await self._collect_answers(tool_context, params, personas, failures, transcript_text="")
            return self._build_result(params, personas, answers, failures, record=None, recorded_indexes=[])

        async with transcript_lock(transcript_file):
            try:
                if params.follow_up_request_id:
                    replay = await self._read_follow_up(params, transcript_file, personas)
                    if replay is not None:
                        return replay
                record = await self._open_record(params, transcript_file, personas, failures)
            except (_InvalidRequest, StudyFilesError) as exc:
                return ToolResult.error(
                    f"Nothing was asked or recorded: {exc}",
                    extra_info={"user_error_reason": INVALID_REQUEST_REASON},
                )
            transcript_text = _format_transcript(record.data, {p.persona_id: p.name for p in personas})
            answers = await self._collect_answers(tool_context, params, personas, failures, transcript_text)
            recorded_indexes = await self._append_round(record, params.question, answers, params.follow_up_request_id) if answers else []
        return self._build_result(
            params, personas, answers, failures, record=record, recorded_indexes=recorded_indexes
        )

    async def _read_follow_up(
        self, params: PersonaChatParams, transcript_file: Path, personas: List[_Persona]
    ) -> Optional[ToolResult]:
        """同一记录锁下校验手动追问并返回已完成的回答；不重放有副作用的模型调用。"""
        existing = await read_json_file(transcript_file)
        if (
            not existing
            or transcript_file.parent.name != INTERVIEWS_DIR
            or transcript_file.parent.parent.parent.name != "studies"
            or transcript_file.suffix != ".json"
        ):
            raise _InvalidRequest("user-initiated chat requires an existing interview transcript")
        if (
            len(personas) != 1
            or existing.get("persona_id") != personas[0].persona_id
            or transcript_file.stem != personas[0].persona_id
        ):
            raise _InvalidRequest("the follow-up persona must match the existing interview")
        turns = existing.get("rounds")
        if not isinstance(turns, list):
            raise _InvalidRequest("the interview has no rounds array")
        for index, turn in enumerate(turns):
            if turn.get("request_id") != params.follow_up_request_id or _speaker(turn) != "moderator":
                continue
            if turn.get("text") != params.question:
                raise _InvalidRequest("this follow-up request ID was already used for a different message")
            answer = turns[index + 1] if index + 1 < len(turns) else None
            if not answer or answer.get("request_id") != params.follow_up_request_id or _speaker(answer) != "persona":
                raise _InvalidRequest("the recorded follow-up is incomplete; inspect the transcript before retrying")
            round_number = sum(1 for item in turns[:index + 1] if _speaker(item) == "moderator")
            record = _Record(transcript_file, params.transcript_path, False, existing, round_number,
                             await self._round_limit(transcript_file, False))
            result = self._build_result(
                params, personas, [_Answer(personas[0].persona_id, personas[0].name, answer["text"])], [],
                record=record, recorded_indexes=[index, index + 1],
            )
            result.content = "This user follow-up was already recorded; no model was called.\n" + result.content
            return result
        return None

    async def _collect_answers(
        self,
        tool_context: ToolContext,
        params: PersonaChatParams,
        personas: List[_Persona],
        failures: List[_Failure],
        transcript_text: str,
    ) -> List[_Answer]:
        agent_context = tool_context.get_extension("agent_context") if tool_context else None
        model_id = resolve_model_id(agent_context)
        interruption_event = agent_context.get_interruption_event() if agent_context else None

        answers: List[_Answer] = []
        # 小组讨论多人顺序调用可能超过 60 秒，统一续期沙盒活跃时间。
        keep_alive_task = start_tool_keep_alive(tool_context)
        try:
            for persona in personas:
                try:
                    text = await await_with_interruption(
                        self._ask_persona(
                            model_id=model_id,
                            persona=persona,
                            others=[p.name for p in personas if p is not persona],
                            question=params.question,
                            transcript_text=transcript_text,
                            earlier_answers=answers,
                            max_tokens=params.max_tokens,
                        ),
                        interruption_event,
                    )
                except Exception as exc:  # CancelledError 是 BaseException，不会在这里被吞掉
                    logger.warning(f"persona_chat 人设回答失败 persona={persona.persona_id}: {exc}")
                    failures.append(
                        _Failure(persona.persona_id, persona.path, PersonaChatFailureReason.MODEL_ERROR, str(exc))
                    )
                    continue
                if not text:
                    failures.append(
                        _Failure(
                            persona.persona_id,
                            persona.path,
                            PersonaChatFailureReason.EMPTY_ANSWER,
                            "the model returned an empty answer",
                        )
                    )
                    continue
                answers.append(_Answer(persona.persona_id, persona.name, text))
        finally:
            stop_tool_keep_alive(keep_alive_task)
        return answers

    async def _open_record(
        self,
        params: PersonaChatParams,
        transcript_file: Path,
        personas: List[_Persona],
        failures: List[_Failure],
    ) -> _Record:
        """校验记录路径、参与者和轮次，在调用模型前拒绝会写错的请求。"""
        sub_dir = transcript_file.parent.name
        if (
            transcript_file.suffix != ".json"
            or sub_dir not in (INTERVIEWS_DIR, DISCUSSIONS_DIR)
            or transcript_file.parent.parent.parent.name != "studies"
        ):
            raise _InvalidRequest(
                "transcript_path must be studies/<slug>/interviews/<persona_id>.json "
                "or studies/<slug>/discussions/<discussion_id>.json"
            )
        if params.round_number < 1:
            raise _InvalidRequest("round_number is required with transcript_path and starts at 1")

        is_discussion = sub_dir == DISCUSSIONS_DIR
        # 按 persona_paths 的顺序取 ID；读不到档案的人设用文件名兜底。
        id_by_path = {p.path: p.persona_id for p in personas} | {f.path: f.persona_id for f in failures}
        persona_ids = [id_by_path[path] for path in params.persona_paths]
        data = await read_json_file(transcript_file)
        if is_discussion:
            if len(params.persona_paths) < 2:
                raise _InvalidRequest("a discussion transcript needs 2-6 personas in persona_paths")
            participants = data.get("participants") if data else persona_ids
            outsiders = [pid for pid in persona_ids if pid not in (participants or [])]
            if outsiders:
                raise _InvalidRequest(f"{', '.join(outsiders)} is not a participant of this discussion")
        else:
            if len(params.persona_paths) != 1:
                raise _InvalidRequest("an interview transcript takes exactly one persona; use discussions/ for a group")
            if persona_ids[0] != transcript_file.stem:
                raise _InvalidRequest(
                    f"interview file name must be the persona ID: interviews/{persona_ids[0]}.json"
                )

        if data is None:
            if is_discussion:
                existing = [f for f in transcript_file.parent.glob("*.json") if f != transcript_file]
                if len(existing) >= MAX_DISCUSSIONS:
                    raise _InvalidRequest(
                        f"this study already has {len(existing)} focus groups, the maximum is {MAX_DISCUSSIONS}; "
                        "continue an existing discussion or start a new study"
                    )
            data = _new_transcript(transcript_file.stem, is_discussion, persona_ids)
        if is_discussion and params.topic.strip() and not _text(data.get("topic")):
            data["topic"] = params.topic.strip()
        elif not isinstance(data.get("rounds"), list):
            raise _InvalidRequest(f"{params.transcript_path} has no rounds array; it was not written by persona_chat")

        recorded = sum(1 for turn in data["rounds"] if _speaker(turn) == "moderator")
        if params.round_number != recorded + 1:
            raise _InvalidRequest(
                f"{params.transcript_path} already has {recorded} recorded rounds, so this round is "
                f"{recorded + 1}, not {params.round_number}. If you were retrying, the earlier attempt "
                "was already recorded; read the transcript instead of asking again. Never change round_number "
                "to get past this check"
            )
        limit = await self._round_limit(transcript_file, is_discussion)
        automatic_rounds = sum(1 for turn in data["rounds"] if _speaker(turn) == "moderator" and not turn.get("request_id"))
        if not params.follow_up_request_id and automatic_rounds >= limit:
            raise _InvalidRequest(
                f"the round limit for this study is {limit} and this transcript has used it. Do not call persona_chat "
                "for this transcript again with any round_number; close it with finish_persona_transcript and report "
                "any guide question that was not asked as a coverage gap"
            )
        return _Record(transcript_file, params.transcript_path, is_discussion, data, params.round_number, limit)

    @staticmethod
    async def _round_limit(transcript_file: Path, is_discussion: bool) -> int:
        """一对一沿用研究保存的上限，新研究默认 20；焦点小组保持 7 轮。"""
        if is_discussion:
            return MAX_DISCUSSION_ROUNDS
        try:
            study = await load_study(transcript_file.parent.parent)
        except StudyFilesError:
            return MAX_INTERVIEW_ROUNDS
        return study.limits.interview_rounds if study.limits else MAX_INTERVIEW_ROUNDS

    @staticmethod
    async def _append_round(record: _Record, question: str, answers: List[_Answer], request_id: str = "") -> List[int]:
        """追加主持人问题和成功的回答，返回每条新内容的 round_index。

        自动访谈追加后标为 running，需再次收尾；用户手动聊天一问一答后即为 done。
        """
        rounds: List[Dict[str, Any]] = record.data["rounds"]
        start = len(rounds)
        if record.is_discussion:
            rounds.append({"speaker": "moderator", "text": question})
            rounds.extend({"speaker": answer.persona_id, "text": answer.text} for answer in answers)
        else:
            rounds.append({"role": "moderator", "text": question})
            rounds.extend({"role": "persona", "text": answer.text} for answer in answers)
        if request_id:
            for turn in rounds[start:]:
                turn["request_id"] = request_id
            rounds[start]["source"] = "user"
            # 单条聊天即完成；摘要与报告仍对应原研究，不让 Agent 为一次追问重跑研究。
            record.data["insights_outdated"] = True
            if isinstance(record.data.get("quality"), dict):
                record.data["quality"]["inferred_ratio"] = compute_inferred_ratio(
                    [turn["text"] for turn in rounds if _speaker(turn) == "persona"]
                )
        record.data["status"] = TranscriptStatus.DONE.value if request_id else TranscriptStatus.RUNNING.value
        record.data["error"] = ""
        await write_json_file(record.path, record.data)
        return list(range(start, len(rounds)))

    async def _resolve_workspace_path(self, raw_path: str) -> Path:
        """解析为工作区内的真实路径；越出工作区（含 .. 和软链接）一律拒绝。"""
        path_text = raw_path.strip()
        if not path_text:
            raise _InvalidRequest("path must not be empty")
        workspace = await async_realpath(self.base_dir)
        resolved = await async_realpath(self.resolve_path(path_text))
        if not resolved.is_relative_to(workspace):
            raise _InvalidRequest(f"path is outside the workspace: {raw_path}")
        return resolved

    async def _load_persona(self, raw_path: str, file_path: Path) -> _Persona | _Failure:
        fallback_id = file_path.stem
        try:
            profile = await async_read_json(file_path)
        except FileNotFoundError:
            return _Failure(fallback_id, raw_path, PersonaChatFailureReason.PROFILE_UNAVAILABLE, "persona file not found")
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            return _Failure(
                fallback_id, raw_path, PersonaChatFailureReason.PROFILE_UNAVAILABLE, f"persona file is not valid JSON: {exc}"
            )
        except Exception as exc:
            return _Failure(
                fallback_id, raw_path, PersonaChatFailureReason.PROFILE_UNAVAILABLE, f"persona file could not be read: {exc}"
            )
        if not isinstance(profile, dict):
            return _Failure(
                fallback_id, raw_path, PersonaChatFailureReason.PROFILE_UNAVAILABLE, "persona file must contain a JSON object"
            )
        # 读取侧宽兼容：id、name 缺失时用文件名兜底，不因缺字段拒绝回答。
        persona_id = _text(profile.get("id")) or fallback_id
        name = _text(profile.get("name")) or persona_id
        return _Persona(persona_id=persona_id, name=name, path=raw_path, profile=profile)

    async def _ask_persona(
        self,
        *,
        model_id: str,
        persona: _Persona,
        others: List[str],
        question: str,
        transcript_text: str,
        earlier_answers: List[_Answer],
        max_tokens: int,
    ) -> str:
        llm_config = LLMFactory.get_model_config(model_id).model_copy(deep=True)
        llm_config.max_output_tokens = max_tokens
        messages = [
            {"role": "system", "content": _build_system_prompt(persona, others, max_tokens)},
            {"role": "user", "content": _build_user_prompt(persona, question, transcript_text, earlier_answers)},
        ]
        response = await LLMFactory.call_with_tool_support(
            model_id=model_id,
            messages=messages,
            tools=None,
            stop=None,
            extra_body=DISABLE_THINKING_BODY,
            llm_config=llm_config,
        )
        if not response or not response.choices:
            return ""
        return _text(response.choices[0].message.content)

    @staticmethod
    def _build_result(
        params: PersonaChatParams,
        personas: List[_Persona],
        answers: List[_Answer],
        failures: List[_Failure],
        *,
        record: Optional[_Record],
        recorded_indexes: List[int],
    ) -> ToolResult:
        total = len(params.persona_paths)
        lines = [f"Persona answers: {len(answers)} of {total} succeeded.", f"Moderator question: {params.question}"]
        for answer in answers:
            lines.extend(["", f"[{answer.persona_id}] {answer.name}:", answer.text])
        if failures:
            lines.extend(["", "Failed personas:"])
            lines.extend(f"- {failure.persona_id} ({failure.path}): {failure.error}" for failure in failures)

        lines.append("")
        if record is None:
            lines.append(
                "These answers were not recorded. To record an interview round, pass transcript_path and round_number."
            )
        elif recorded_indexes:
            lines.append(
                f"Recorded round {record.round_number} in {record.raw_path}: moderator at round_index "
                f"{recorded_indexes[0]}, answers at round_index "
                f"{', '.join(str(i) for i in recorded_indexes[1:])}. Do not write this transcript yourself."
            )
            if params.follow_up_request_id:
                lines.append("This user chat turn is complete. Do not ask another question, finish the transcript, or update the report or study. Reply briefly in the user's language.")
            else:
                lines.append(
                    f"Next: ask round {record.round_number + 1} with round_number={record.round_number + 1}, "
                    "or call finish_persona_transcript when the session ends."
                )
        else:
            lines.append(
                f"Nothing was recorded for round {record.round_number}. Retry once with the same round_number; "
                "if it fails again, call finish_persona_transcript with status=failed and the reason."
            )
        if failures and recorded_indexes:
            lines.append("Failed participants are not in the transcript for this round.")

        # 头像提示只给卡片用；读不到档案的人设没有名字和头像提示，用 ID 兜底。
        by_id = {p.persona_id: p for p in personas}

        def hint(persona_id: str) -> Dict[str, str]:
            persona = by_id.get(persona_id)
            return portrait_hint(persona.profile) if persona else {"gender": "", "age": ""}

        data: Dict[str, Any] = {
            "answers": [
                {"persona_id": a.persona_id, "name": a.name, "text": a.text, **hint(a.persona_id)} for a in answers
            ],
            "failed": [
                {
                    "persona_id": f.persona_id,
                    "name": by_id[f.persona_id].name if f.persona_id in by_id else f.persona_id,
                    "path": f.path,
                    "reason": f.reason.value,
                    **hint(f.persona_id),
                }
                for f in failures
            ],
        }
        if record is not None:
            data["transcript_path"] = record.raw_path
            data["round_number"] = record.round_number
            data["round_limit"] = record.round_limit
            data["round_indexes"] = recorded_indexes
        return ToolResult(content="\n".join(lines), ok=not failures and bool(answers), data=data)

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        count = len((arguments or {}).get("persona_paths") or [])
        remark = (
            _translate("persona_chat.before_group", count=count)
            if count > 1
            else _translate("persona_chat.before_interview")
        )
        return {"tool_name": tool_name, "action": _action(), "remark": remark}

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        answered = len(result.data.get("answers") or [])
        failed = len(result.data.get("failed") or [])
        if result.ok:
            remark = _translate("persona_chat.success", count=answered)
        elif answered:
            remark = _translate("persona_chat.partial", ok=answered, failed=failed)
        else:
            remark = _translate("persona_chat.error")
        return {"tool_name": tool_name, "action": _action(), "remark": remark}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        data = result.data or {}
        failed = data.get("failed") or []
        error, error_reason = "", ""
        if not data.get("answers") and not failed:
            # 整次调用被拒（如路径越界、轮次不对、连问）：只展示脱敏后的原因，不展示给模型的原始错误。
            error_reason = _reason_code((result.extra_info or {}).get("user_error_reason"))
            error = _reason_text(error_reason)
        # 只有真正写进记录的一轮才显示轮次；整轮失败时没有写入，不显示「第 N 轮」。
        recorded = bool(data.get("round_indexes"))
        return ToolDetail(
            type=DisplayType.PERSONA_CHAT,
            data=PersonaChatContent(
                question=_text((arguments or {}).get("question")),
                round_number=data.get("round_number") if recorded and not (arguments or {}).get("follow_up_request_id") else None,
                round_limit=data.get("round_limit") if recorded and not (arguments or {}).get("follow_up_request_id") else None,
                answers=[
                    PersonaChatAnswerContent(**{k: item[k] for k in ("persona_id", "name", "text", "gender", "age")})
                    for item in data.get("answers") or []
                ],
                failed=[
                    PersonaChatFailureContent(
                        persona_id=item["persona_id"],
                        name=item["name"],
                        reason=_reason_text(item["reason"]),
                        gender=item["gender"],
                        age=item["age"],
                    )
                    for item in failed
                ],
                error=error,
                error_reason=error_reason,
            ),
        )


# ── 提问检查 ───────────────────────────────────────────────────────────────

_QUESTION_MARKS = re.compile(r"[?？]")
# 「第一……第二」「首先……其次」「first… second」这类枚举，一轮里塞了多个问题。
_ENUMERATIONS = (("第一", "第二"), ("首先", "其次"), ("first", "second"))


async def _joined_question_reason(tool_context: ToolContext, question: str) -> str:
    """规则初筛命中时请小模型判定；判定不可用时放行（返回空字符串）。"""
    if not asks_joined_questions(question):
        return ""
    try:
        return await judge_joined_question(tool_context, question)
    except JudgeUnavailable as exc:
        logger.info(f"persona_chat 连问判定未执行，放行: {exc}")
        return ""


def _asks_several_things(question: str) -> bool:
    if len(_QUESTION_MARKS.findall(question)) >= 2:
        return True
    lowered = question.lower()
    return any(a in lowered and b in lowered for a, b in _ENUMERATIONS)


# ── prompt 构建 ────────────────────────────────────────────────────────────


# "默认谨慎"基线用于抵消模型扮演受访者时的讨好倾向：AI 受访者普遍比真人更积极，
# 在购买意愿和价格上尤其偏乐观。例：问"299 元一年你会买吗"，"先不买、看看别人用"应是常见回答，
# 而不是礼貌地夸这个想法。
_PERSONA_SYSTEM_PROMPT = """\
You are taking part in a qualitative consumer research {session_kind} as the person described in the profile below. Stay in character for the whole conversation.

How to answer:
- Speak in the first person the way this person really talks: their vocabulary, tone, attitudes, habits, and life circumstances. Do not sound like an assistant, a consultant, or a marketer.
- The profile's "expression" lines only show how this person talks. Do not repeat them or treat them as your answer; answer the actual question from your situation and past behavior.
- Base the answer on the profile and on common sense about people like this. When the profile does not cover something, answer in a way that stays consistent with the persona and put "(inferred)" right after each made-up detail.
- Be true to the persona rather than agreeable: disagree, hesitate, admit you do not know, or say something does not fit you when that is what this person would do.
- Start from a cautious baseline toward new products and services: like most real people, you are skeptical by default. Not buying, not switching, or not caring is a normal answer. Do not praise an idea to be polite.
- Prefer concrete stories, recent situations, numbers, and trade-offs over general opinions.
- Answer only the moderator's latest message. Do not interview the moderator, narrate actions, or mention being an AI, a profile, or a simulation.
- Keep it to a natural spoken answer of at most about {word_budget} words (or Chinese characters), with no headings or bullet lists.
- Reply in the same language as the moderator's latest message.
{group_rules}
Persona profile (JSON):
{profile}"""

_GROUP_RULES = """\
- This is a focus group. Other participants: {others}. When relevant, react to what they said in this discussion: agree, push back, or add a different experience. Speak only for yourself.
"""


def _build_system_prompt(persona: _Persona, others: List[str], max_tokens: int) -> str:
    profile_text, _ = truncate_text_by_token(
        json.dumps(persona.profile, ensure_ascii=False, indent=1), MAX_PROFILE_TOKENS
    )
    return _PERSONA_SYSTEM_PROMPT.format(
        session_kind="focus group" if others else "one-on-one interview",
        word_budget=max(60, int(max_tokens * 0.6)),
        group_rules=_GROUP_RULES.format(others=", ".join(others)) if others else "",
        profile=profile_text,
    )


def _build_user_prompt(
    persona: _Persona, question: str, transcript_text: str, earlier_answers: List[_Answer]
) -> str:
    parts = [
        "Conversation so far:",
        transcript_text or "(This is the first question.)",
    ]
    if earlier_answers:
        parts.extend(["", "Answers already given to this question:"])
        parts.extend(f"{answer.name}: {answer.text}" for answer in earlier_answers)
    parts.extend(["", f"Moderator: {question}", "", f"Now answer as {persona.name}."])
    return "\n".join(parts)


def _format_transcript(transcript: Dict[str, Any], names: Dict[str, str]) -> str:
    """把访谈或讨论记录转成"说话人: 内容"文本。

    访谈记录用 rounds[].role（moderator | persona），讨论记录用 rounds[].speaker
    （moderator | persona_id），两种都兼容。
    """
    rounds = transcript.get("rounds")
    if not isinstance(rounds, list):
        return ""
    interviewee = names.get(_text(transcript.get("persona_id"))) or _text(transcript.get("persona_id")) or "Participant"
    lines = []
    for turn in rounds[-MAX_TRANSCRIPT_TURNS:]:
        if not isinstance(turn, dict):
            continue
        text = _text(turn.get("text"))
        if not text:
            continue
        speaker = _text(turn.get("speaker")) or _text(turn.get("role"))
        if speaker == "moderator":
            label = "Moderator"
        elif speaker == "persona":
            label = interviewee
        else:
            label = names.get(speaker) or speaker or "Participant"
        lines.append(f"{label}: {text[:MAX_TURN_CHARS]}")
    return "\n".join(lines)


def _speaker(turn: Any) -> str:
    if not isinstance(turn, dict):
        return ""
    return _text(turn.get("speaker")) or _text(turn.get("role"))


def _new_transcript(file_id: str, is_discussion: bool, persona_ids: List[str]) -> Dict[str, Any]:
    """按文件契约新建记录；summary、quotes、quality 由 finish_persona_transcript 收尾时写入。"""
    head: Dict[str, Any] = {"schema_version": SCHEMA_VERSION}
    if is_discussion:
        head.update({"id": file_id, "participants": persona_ids})
    else:
        head["persona_id"] = file_id
    head.update({"status": TranscriptStatus.RUNNING.value, "error": "", "rounds": [], "summary": "", "key_findings": [], "quotes": []})
    return head


# ── 展示辅助 ───────────────────────────────────────────────────────────────


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _translate(key: str, **kwargs: Any) -> str:
    return i18n.translate(key, category="tool.messages", **kwargs)


def _action() -> str:
    return i18n.translate("persona_chat", category="tool.actions")


def _reason_code(reason: Any) -> str:
    """未知或缺失的原因按 model_error 处理，与展示文案口径一致。"""
    known = {item.value for item in PersonaChatFailureReason} | {INVALID_REQUEST_REASON}
    return reason if reason in known else PersonaChatFailureReason.MODEL_ERROR.value


def _reason_text(reason: Any) -> str:
    return _translate(f"persona_chat.reason.{_reason_code(reason)}")


__all__ = ["PersonaChat", "PersonaChatParams"]
