"""save_study_synthesis：写入 synthesis.json，并把假设结论写回 study.json。

模型使用说明：agents/skills/persona-research/reference/tools.md（code_mode_only，完整用法只维护在 Skill）。

模型只给判断：主题、各人设立场、引用哪句原话、结论和可信度。工具负责以前要靠模型
手算、又经常算错的部分（5 次研究里每次都在自检时删掉 1-9 条引文，再写 Python 返工）：

| 工作                      | 规则来源（methods.md）         | 工具行为                                              |
| 引文 file + round_index    | Quote Self-Check               | 只按原文在该人设自己的发言里查找；找不到就不保存并列出 |
| 主题、维度、分层 ID        | file-contracts.md              | 自动编号 T1、D1、seg_1                                |
| 立场补全                   | Theme Coding                   | 没写到的已访谈人设补成 not_mentioned                   |
| 饱和度                     | Saturation                     | 按 panel.json 顺序数每份完成访谈首次出现的主题数       |
| 可信度上限                 | Theme Confidence Rules         | 外部来源不够时下调，并在 confidence_reason 写明         |
| 结论上限                   | Hypothesis Verdict Rules       | 只有 AI 访谈支撑的 supported/refuted 改为 mixed；不足 3 人谈到且无来源 → insufficient |
| 降权访谈                   | Downweighting                  | inferred_ratio ≥ 0.4 的访谈不能单独撑起 high/medium     |
| 被问到才说                 | Prompted Answers               | 引文全是 prompted 的主题最高 low；引文旁记录所答的问题 |
| 支付意愿                   | Theme Confidence Rules         | about_willingness_to_pay 的主题未经真人验证 → to_validate |
| 来源要说同一件事           | Hypothesis Verdict Rules       | supported/refuted 需要至少 1 条 covers=core 的来源；关联假设都没有 core 来源的主题最高 medium |
| 核对记录                   | Quote Checks                   | 删掉的引文、忽略的来源、规则调整写进 synthesis.json checks，报告局限据此填写 |
| 同质化                     | Homogeneity                    | 全员一致的主题过半时警告，并把这些主题 high 降为 medium |

为什么加后四条（2026-10 对 6 项真实研究的复盘）：录音卡研究 12 个主题零反对、第一位受访者
就「贡献」了全部主题却记为已饱和；咖啡研究「规则比价格重要」只因提纲先问了规则；
「老板愿意为录音卡付费」的外部来源只说明老板会算回本账，并没有说他们会买。

「多数相关访谈是否支持」需要判断哪些访谈相关，仍由模型决定；工具只执行确定的上限。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.persona_research.contracts import (
    DOWNWEIGHT_INFERRED_RATIO,
    SCHEMA_VERSION,
    Agreement,
    Confidence,
    Level,
    Stance,
    Study,
    StudyPhase,
    TranscriptStatus,
    Verdict,
)
from app.tools.persona_research.study_files import (
    QuoteLocation,
    StudyFilesError,
    Transcript,
    compute_inferred_ratio,
    load_study,
    load_transcripts,
    locate_quote,
    read_json_file,
    read_source_ids,
    resolve_study_dir,
    save_study,
    write_json_file,
)
from app.tools.workspace_tool import WorkspaceTool

_CJK = re.compile(r"[぀-ヿ㐀-鿿가-힯]")
# 引文旁记录它回答的问题，供报告和研究页展示「这句话是被怎么问出来的」；截断避免 synthesis.json 膨胀。
MAX_QUESTION_CHARS = 300


class QuoteInput(BaseModel):
    persona_id: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1, description="The persona's exact words; the tool finds file and round_index.")
    prompted: bool = Field(
        default=False, description="True when the moderator's question already named this idea before the persona said it."
    )


class SegmentInput(BaseModel):
    name: str = Field(..., min_length=1, description="Equals a study.json quota segment.")
    persona_ids: List[str] = Field(default_factory=list)


class ThemeInput(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = ""
    stance_by_persona: Dict[str, Stance] = Field(default_factory=dict)
    quotes: List[QuoteInput] = Field(default_factory=list)
    source_refs: List[str] = Field(default_factory=list)
    hypothesis_ids: List[str] = Field(default_factory=list)
    confidence: Confidence
    confidence_reason: str = ""
    about_willingness_to_pay: bool = Field(
        default=False, description="True for themes about price acceptance or willingness to pay."
    )


class DimensionInput(BaseModel):
    name: str = Field(..., min_length=1)
    level_by_segment: Dict[str, Level] = Field(default_factory=dict, description="Keyed by segment name.")
    quotes: List[QuoteInput] = Field(default_factory=list)


class SourceCoverage(StrEnum):
    # 来源直接说明了假设的核心主张，例如「多数用户因自动续费放弃月卡」之于「规则比价格更阻碍办卡」。
    CORE = "core"
    # 来源只提供背景，例如「有人投诉自动续费」：说明问题存在，不说明它比价格更重要。
    CONTEXT = "context"


class HypothesisSourceInput(BaseModel):
    ref: str = Field(..., min_length=1, description="A desk-research source id such as S3.")
    claim: str = Field(..., min_length=1, description="What this source says about this hypothesis, in one sentence.")
    covers: SourceCoverage


class HypothesisVerdictInput(BaseModel):
    id: str = Field(..., pattern=r"^H\d+$")
    verdict: Verdict
    verdict_reason: str = Field(..., min_length=1)
    quotes: List[QuoteInput] = Field(default_factory=list)
    sources: List[HypothesisSourceInput] = Field(default_factory=list)
    # 旧写法：只有编号、没有说法，按 context 处理，不能单独撑起 supported/refuted。
    source_refs: List[str] = Field(default_factory=list)


class SaveStudySynthesisParams(BaseToolParams):
    study_dir: str = Field(..., description="studies/<slug>")
    segments: List[SegmentInput] = Field(..., min_length=1)
    themes: List[ThemeInput] = Field(..., min_length=1)
    dimensions: List[DimensionInput] = Field(default_factory=list)
    hypotheses: List[HypothesisVerdictInput] = Field(default_factory=list)


@dataclass
class _Outcome:
    """一次保存的结果汇总，供 content 和卡片使用。"""

    quotes_total: int = 0
    dropped_quotes: List[str] = field(default_factory=list)
    dropped_sources: List[str] = field(default_factory=list)
    dropped_stances: List[str] = field(default_factory=list)
    adjustments: List[str] = field(default_factory=list)
    downweighted: List[str] = field(default_factory=list)
    unanimous: List[str] = field(default_factory=list)
    homogeneity_warning: bool = False
    saturation: List[int] = field(default_factory=list)
    saturated: bool = False


# 模型使用说明：agents/skills/persona-research/reference/tools.md
@tool(name="save_study_synthesis", code_mode_only=True)
class SaveStudySynthesis(WorkspaceTool[SaveStudySynthesisParams]):
    """Save the study synthesis and hypothesis verdicts with verified quotes."""

    async def execute(self, tool_context: ToolContext, params: SaveStudySynthesisParams) -> ToolResult:
        try:
            study_path = await resolve_study_dir(self.base_dir, params.study_dir)
            study = await load_study(study_path)
            if StudyPhase(study.phase) not in (StudyPhase.REPORT, StudyPhase.VALIDATION, StudyPhase.DONE):
                raise StudyFilesError(f"synthesis is written in the report phase; the study is in {study.phase}")
            outcome = _Outcome()
            synthesis = await _build(study_path, study, params, outcome)
            await write_json_file(study_path / "synthesis.json", synthesis)
            await save_study(study_path, study)
        except StudyFilesError as exc:
            return ToolResult.error(f"Synthesis not saved: {exc}")

        located = outcome.quotes_total - len(outcome.dropped_quotes)
        lines = [
            f"Saved {params.study_dir}/synthesis.json with {len(synthesis['themes'])} themes and "
            f"{len(synthesis['dimensions'])} dimensions, and wrote {len(params.hypotheses)} hypothesis verdicts to study.json.",
            f"Quotes located: {located}/{outcome.quotes_total}.",
        ]
        if outcome.dropped_quotes:
            lines.append("Not saved because they are not that persona's exact words:")
            lines.extend(f"- {text}" for text in outcome.dropped_quotes)
        if outcome.dropped_sources:
            lines.append(f"Ignored source refs not found in desk-research.md: {', '.join(outcome.dropped_sources)}.")
        if outcome.dropped_stances:
            lines.append(f"Ignored stances for personas without a completed transcript: {', '.join(outcome.dropped_stances)}.")
        if outcome.adjustments:
            lines.append("Adjusted by the rules in methods.md:")
            lines.extend(f"- {item}" for item in outcome.adjustments)
        if outcome.downweighted:
            lines.append(f"Downweighted interviews (inferred_ratio >= 0.4): {', '.join(outcome.downweighted)}.")
        lines.append(
            f"Saturation: {outcome.saturation}, {'saturated' if outcome.saturated else 'not saturated; recommend a larger sample in the report'}."
        )
        if outcome.homogeneity_warning:
            lines.append(
                f"Homogeneity warning: {len(outcome.unanimous)} of {len(synthesis['themes'])} themes have unanimous AI "
                f"agreement ({', '.join(outcome.unanimous)}). State in the report limitations that the AI respondents "
                "answered alike, which signals model homogeneity rather than strong evidence, and do not present "
                "saturation as a strength."
            )
        if outcome.dropped_quotes:
            lines.append("Mention the removed quote count in the report limitations.")
        return ToolResult(
            content="\n".join(lines),
            data={
                "study_dir": params.study_dir,
                "themes": len(synthesis["themes"]),
                "quotes_total": outcome.quotes_total,
                "quotes_located": located,
                "adjustments": outcome.adjustments,
                "saturation": outcome.saturation,
                "saturated": outcome.saturated,
                "homogeneity_warning": outcome.homogeneity_warning,
                "unanimous": len(outcome.unanimous),
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
        # 例：「12 个主题，引文核对 31/32」
        if result.ok:
            remark = _translate(
                "save_study_synthesis.success",
                themes=result.data.get("themes", 0),
                located=result.data.get("quotes_located", 0),
                total=result.data.get("quotes_total", 0),
            )
        else:
            remark = _translate("save_study_synthesis.error")
        return {"tool_name": tool_name, "action": i18n.translate("save_study_synthesis", category="tool.actions"), "remark": remark}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        if not result.ok:
            return None
        data = result.data
        saturation = data.get("saturation") or []
        lines = [
            f"# {_translate('save_study_synthesis.detail_title')}",
            "",
            _translate(
                "save_study_synthesis.detail_summary",
                themes=data.get("themes", 0),
                located=data.get("quotes_located", 0),
                total=data.get("quotes_total", 0),
            ),
            "",
            _translate(
                "save_study_synthesis.detail_saturated" if data.get("saturated") else "save_study_synthesis.detail_not_saturated",
                series=" → ".join(str(n) for n in saturation),
            ),
        ]
        if data.get("homogeneity_warning"):
            lines.extend(["", _translate("save_study_synthesis.detail_homogeneity", count=data.get("unanimous", 0))])
        adjustments = data.get("adjustments") or []
        if adjustments:
            lines.extend(["", f"**{_translate('save_study_synthesis.detail_adjusted')}**", ""])
            lines.extend(f"- {item}" for item in adjustments)
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="synthesis_summary.md", content="\n".join(lines) + "\n"),
        )


@dataclass(frozen=True)
class _Located:
    """核对通过的引文：说话人、位置、是否被问到才说，以及它回答的主持人问题。"""

    persona_id: str
    location: QuoteLocation
    prompted: bool
    question: str


async def _build(study_path: Path, study: Study, params: SaveStudySynthesisParams, outcome: _Outcome) -> Dict[str, Any]:
    transcripts = [t for t in await load_transcripts(study_path) if t.status == TranscriptStatus.DONE]
    interviews = {t.persona_id: t for t in transcripts if not t.is_discussion}
    if not interviews and not any(t.is_discussion for t in transcripts):
        raise StudyFilesError("no completed transcript was found; synthesis needs at least one interview with status done")
    interviewed = set(interviews) | {
        pid for t in transcripts if t.is_discussion for pid in (t.data.get("participants") or [])
    }
    downweighted = {pid for pid, t in interviews.items() if _inferred_ratio(t) >= DOWNWEIGHT_INFERRED_RATIO}
    outcome.downweighted = sorted(downweighted)
    source_ids = await read_source_ids(study_path)
    by_file = {t.file: t for t in transcripts}

    def quotes(items: List[QuoteInput]) -> List[_Located]:
        found = []
        for item in items:
            outcome.quotes_total += 1
            location = locate_quote(transcripts, item.persona_id, item.text)
            if location is None:
                outcome.dropped_quotes.append(f"{item.persona_id}: {item.text[:60]}")
            else:
                question = _question_before(by_file[location.file], location.round_index)
                found.append(_Located(item.persona_id, location, item.prompted, question))
        return found

    def known_source(ref: str) -> bool:
        if ref.strip() in source_ids:
            return True
        outcome.dropped_sources.append(ref)
        return False

    def sources(refs: List[str]) -> List[str]:
        return [ref.strip() for ref in refs if known_source(ref)]

    # 有 covers=core 来源的假设；关联假设都不在其中的主题不能评 high（见 _cap_confidence）。
    core_hypotheses = {
        item.id for item in params.hypotheses
        if any(s.covers == SourceCoverage.CORE and s.ref.strip() in source_ids for s in item.sources)
    }
    segments = _segments(study, params.segments)
    segment_ids = {segment["name"]: segment["id"] for segment in segments}
    validated = {h.id for h in study.hypotheses if h.validation and h.validation.verdict == Agreement.AGREE}

    themes = []
    for index, theme in enumerate(params.themes, start=1):
        theme_id = f"T{index}"
        stance = {pid: Stance.NOT_MENTIONED.value for pid in sorted(interviewed)}
        for pid, value in theme.stance_by_persona.items():
            if pid in interviewed:
                stance[pid] = value.value
            else:
                outcome.dropped_stances.append(pid)
        located = quotes(theme.quotes)
        refs = sources(theme.source_refs)
        confidence, reason = _cap_confidence(
            theme, theme_id, refs, located, downweighted, bool(validated & set(theme.hypothesis_ids)),
            bool(core_hypotheses & set(theme.hypothesis_ids)), outcome,
        )
        themes.append({
            "id": theme_id,
            "name": theme.name.strip(),
            "description": theme.description.strip(),
            "stance_by_persona": stance,
            "quote_refs": [_quote_ref(item) for item in located],
            "source_refs": refs,
            "hypothesis_ids": theme.hypothesis_ids,
            "confidence": confidence,
            "confidence_reason": reason,
        })
    _apply_homogeneity(themes, len(interviewed), outcome)

    dimensions = []
    for index, dimension in enumerate(params.dimensions, start=1):
        unknown = [name for name in dimension.level_by_segment if name not in segment_ids]
        if unknown:
            raise StudyFilesError(f"dimension {dimension.name!r} uses unknown segments: {', '.join(unknown)}")
        dimensions.append({
            "id": f"D{index}",
            "name": dimension.name.strip(),
            "level_by_segment": {segment_ids[name]: level.value for name, level in dimension.level_by_segment.items()},
            "quote_refs": [_quote_ref(item) for item in quotes(dimension.quotes)],
        })

    _apply_verdicts(study, params.hypotheses, themes, quotes, known_source, outcome)
    outcome.saturation, outcome.saturated = await _saturation(study_path, interviews, params.themes)
    return {
        "schema_version": SCHEMA_VERSION,
        "segments": segments,
        "themes": themes,
        "dimensions": dimensions,
        "saturation": {"new_themes_per_interview": outcome.saturation, "saturated": outcome.saturated},
        "homogeneity": {"unanimous_theme_ids": outcome.unanimous, "warning": outcome.homogeneity_warning},
        # 只在工具返回里出现的核对结果，写报告时往往已不在上下文里；落盘后局限一节能照实填写。
        "checks": {
            "quotes_total": outcome.quotes_total,
            "removed_quotes": outcome.dropped_quotes,
            "ignored_source_refs": outcome.dropped_sources,
            "adjustments": outcome.adjustments,
            "downweighted_interviews": outcome.downweighted,
        },
    }


def _question_before(transcript: Transcript, round_index: int) -> str:
    """引文所在发言之前最近的一条主持人发言，即受访者回答的那个问题。"""
    question = ""
    for index, speaker, text in transcript.utterances():
        if index >= round_index:
            break
        if speaker == "moderator":
            question = text
    return question[:MAX_QUESTION_CHARS]


def _segments(study: Study, items: List[SegmentInput]) -> List[Dict[str, Any]]:
    quota_names = [item.segment for item in study.quota]
    unknown = [item.name for item in items if quota_names and item.name not in quota_names]
    if unknown:
        raise StudyFilesError(
            f"segments must use the quota segment names in study.json ({', '.join(quota_names)}); unknown: {', '.join(unknown)}"
        )
    return [
        {"id": f"seg_{index}", "name": item.name, "persona_ids": item.persona_ids}
        for index, item in enumerate(items, start=1)
    ]


def _cap_confidence(
    theme: ThemeInput,
    theme_id: str,
    refs: List[str],
    located: List[_Located],
    downweighted: set[str],
    validated: bool,
    core_covered: bool,
    outcome: _Outcome,
) -> tuple[str, str]:
    """按 methods.md 的可信度规则给出上限；只下调，不上调。规则按下表顺序取第一条命中的。

    | 条件                                   | 上限        |
    | 引文全部来自降权访谈                   | low         |
    | 引文全部是被问到才说（prompted）       | low         |
    | 关于支付意愿，且未经真人验证           | to_validate |
    | 没有外部来源，且未经真人验证           | to_validate |
    | 要 high 但只有 1 个外部来源            | medium      |
    | 要 high，关联的假设都没有 core 来源    | medium      |

    最后一条的例子：主题「换工具先问要不要多一步」挂了 2 个来源，但它关联的 H3 没有任何来源
    直接说明换工具时最先担心什么，2 个来源只是背景 → 最高 medium。
    """
    requested = theme.confidence
    allowed = requested
    rule_zh, rule_en = "", ""
    if requested in (Confidence.HIGH, Confidence.MEDIUM):
        if located and all(item.location.source == "interview" and item.persona_id in downweighted for item in located):
            allowed, rule_zh, rule_en = Confidence.LOW, "主要依据是降权访谈", "the support rests on downweighted interviews"
        elif located and all(item.prompted for item in located):
            allowed, rule_zh, rule_en = Confidence.LOW, "受访者只在被问到时才提到", "participants raised it only when asked about it"
        elif theme.about_willingness_to_pay and not validated:
            allowed, rule_zh, rule_en = (
                Confidence.TO_VALIDATE, "AI 受访者的支付意愿必须由真人验证", "AI willingness to pay needs real-person validation"
            )
        elif not refs and not validated:
            allowed, rule_zh, rule_en = Confidence.TO_VALIDATE, "只有 AI 访谈支持，没有外部来源", "supported by AI interviews only"
        elif requested == Confidence.HIGH and len(refs) < 2 and not validated:
            allowed, rule_zh, rule_en = Confidence.MEDIUM, "只有 1 个外部来源", "only one external source agrees"
        elif requested == Confidence.HIGH and theme.hypothesis_ids and not core_covered and not validated:
            allowed, rule_zh, rule_en = (
                Confidence.MEDIUM, "关联的假设没有来源直接说明核心主张", "no source states the core claim of its hypotheses"
            )
    reason = theme.confidence_reason.strip()
    if allowed != requested:
        outcome.adjustments.append(f"{theme_id} confidence {requested.value} -> {allowed.value}: {rule_en}")
        reason = _with_note(reason, theme.name + reason, rule_zh, rule_en)
    return allowed.value, reason


def _with_note(reason: str, sample: str, rule_zh: str, rule_en: str) -> str:
    note = f"（按规则调整：{rule_zh}）" if _CJK.search(sample) else f"(Adjusted by rule: {rule_en}.)"
    return f"{reason} {note}".strip()


def _apply_homogeneity(themes: List[Dict[str, Any]], interviewed: int, outcome: _Outcome) -> None:
    """全员一致的主题过半时，把这些主题的 high 降为 medium，并要求报告写明同质化。

    「全员一致」：至少 3 人支持，没有 oppose/mixed，未提及的最多 1 人。
    例：8 人研究里 12 个主题有 7 个是 8 人全部 support → 警告，这 7 个主题最高 medium。
    真人样本几乎不会这样一致；AI 受访者这样一致，更可能是同一个模型的「平均答案」。
    """
    unanimous = []
    for theme in themes:
        stances = list(theme["stance_by_persona"].values())
        support = stances.count(Stance.SUPPORT.value)
        dissent = stances.count(Stance.OPPOSE.value) + stances.count(Stance.MIXED.value)
        silent = stances.count(Stance.NOT_MENTIONED.value)
        if interviewed >= 3 and support >= 3 and dissent == 0 and silent <= 1:
            unanimous.append(theme)
    outcome.unanimous = [theme["id"] for theme in unanimous]
    outcome.homogeneity_warning = len(unanimous) * 2 > len(themes)
    if not outcome.homogeneity_warning:
        return
    for theme in unanimous:
        if theme["confidence"] == Confidence.HIGH.value:
            theme["confidence"] = Confidence.MEDIUM.value
            outcome.adjustments.append(f"{theme['id']} confidence high -> medium: unanimous AI agreement")
            theme["confidence_reason"] = _with_note(
                theme["confidence_reason"], theme["name"], "AI 受访者全员一致，可能是同质化", "AI respondents agreed unanimously"
            )


def _apply_verdicts(
    study: Study, items: List[HypothesisVerdictInput], themes: List[Dict[str, Any]], quotes, known_source, outcome: _Outcome
) -> None:
    """写入假设结论，按 methods.md 的结论规则只下调、不上调。

    | 情况                                         | 结论上限     | 原因前缀       |
    | 谈到它的受访者不足 3 人，且没有任何外部来源  | insufficient | 无             |
    | supported/refuted 但没有 covers=core 的来源  | mixed        | 待真人验证     |
    | 模型直接给 mixed，也没有 covers=core 的来源  | mixed        | 待真人验证     |

    「谈到它的受访者」= 该结论引文的说话人 ∪ 关联此假设的主题里立场不是 not_mentioned 的人。
    例：H「规则比价格更阻碍办卡」，来源 S1 只记录了自动续费投诉（context）→ mixed，
    原因前加「待真人验证：」；若 S7 的调查直接显示多数人因规则放弃（core）→ 保留 supported。
    """
    by_id = {hypothesis.id: hypothesis for hypothesis in study.hypotheses}
    unknown = [item.id for item in items if item.id not in by_id]
    if unknown:
        raise StudyFilesError(f"unknown hypothesis ids: {', '.join(unknown)} (study.json has {', '.join(by_id) or 'none'})")
    for item in items:
        hypothesis = by_id[item.id]
        located = quotes(item.quotes)
        cited = [source for source in item.sources if known_source(source.ref)]
        legacy = [ref.strip() for ref in item.source_refs if known_source(ref)]
        has_core = any(s.covers == SourceCoverage.CORE for s in cited)
        addressed = {entry.persona_id for entry in located} | {
            pid
            for theme in themes if item.id in theme["hypothesis_ids"]
            for pid, stance in theme["stance_by_persona"].items() if stance != Stance.NOT_MENTIONED.value
        }
        verdict, reason = item.verdict, item.verdict_reason.strip()
        if verdict not in (Verdict.PENDING, Verdict.INSUFFICIENT) and len(addressed) < 3 and not cited and not legacy:
            outcome.adjustments.append(
                f"{item.id} verdict {verdict.value} -> insufficient: {len(addressed)} interviewees address it and no source covers it"
            )
            verdict = Verdict.INSUFFICIENT
        elif verdict in (Verdict.SUPPORTED, Verdict.REFUTED) and not has_core:
            rule = "supported by AI interviews only" if not cited and not legacy else "no source states the core claim"
            outcome.adjustments.append(f"{item.id} verdict {verdict.value} -> mixed: {rule}")
            verdict = Verdict.MIXED
        if verdict == Verdict.MIXED and not has_core:
            prefix = "待真人验证：" if _CJK.search(reason) else "Pending real-person validation: "
            if not reason.startswith(prefix.strip(": ：")):
                reason = prefix + reason
        hypothesis.verdict = verdict
        hypothesis.verdict_reason = reason
        hypothesis.evidence_refs = (
            [_evidence_ref(entry) for entry in located]
            + [{"kind": "source", "ref": s.ref.strip(), "claim": s.claim.strip(), "covers": s.covers.value} for s in cited]
            + [{"kind": "source", "ref": ref} for ref in legacy]
        )


async def _saturation(study_path: Path, interviews: Dict[str, Transcript], themes: List[ThemeInput]) -> tuple[List[int], bool]:
    """按 panel.json 顺序，数每份完成的一对一访谈里首次出现的主题数；最后两项都是 0 才算饱和。

    例：3 份访谈，T1 第一次出现在第 1 份、T2 在第 1 份、T3 在第 2 份 → [2, 1, 0]，未饱和。
    """
    panel = await read_json_file(study_path / "panel.json") or {}
    order = [pid for pid in panel.get("persona_ids") or [] if pid in interviews]
    order += sorted(pid for pid in interviews if pid not in order)
    counts = [0] * len(order)
    for theme in themes:
        for position, pid in enumerate(order):
            if theme.stance_by_persona.get(pid, Stance.NOT_MENTIONED) != Stance.NOT_MENTIONED:
                counts[position] += 1
                break
    return counts, len(counts) >= 2 and counts[-1] == 0 and counts[-2] == 0


def _inferred_ratio(transcript: Transcript) -> float:
    ratio = transcript.inferred_ratio
    return ratio if ratio is not None else compute_inferred_ratio(transcript.persona_texts())


def _quote_ref(item: _Located) -> Dict[str, Any]:
    return {
        "persona_id": item.persona_id,
        "source": item.location.source,
        "file": item.location.file,
        "round_index": item.location.round_index,
        "text": item.location.text,
        "prompted": item.prompted,
        "question": item.question,
    }


def _evidence_ref(item: _Located) -> Dict[str, Any]:
    ref: Dict[str, Any] = {
        "kind": "quote",
        "persona_id": item.persona_id,
        "round_index": item.location.round_index,
        "text": item.location.text,
        "prompted": item.prompted,
    }
    if item.location.source == "discussion":
        ref["file"] = item.location.file
    return ref


def _translate(key: str, **kwargs: Any) -> str:
    return i18n.translate(key, category="tool.messages", **kwargs)
