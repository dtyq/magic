"""save_personas：写入本次研究的人设和 studies/<slug>/panel.json。

模型使用说明：agents/skills/persona-research/reference/tools.md（code_mode_only，完整用法只维护在 Skill）。

| 由模型给出                                  | 由工具完成                                          |
| 人设内容（7 个维度、4 个层次、证据、出处）   | 生成 persona ID、补 schema_version/created_in/updated_at |
| 是否复用已有人设、入选理由、所属分层         | 校验结构完整、出处引用的证据存在、分层在配额里       |
| 是否来自用户上传的真人资料                  | 按规则计算 tier（不再由模型自己判断）                |

tier 规则（SKILL.md）：来自上传的真人资料 → imported；否则至少 3 条 web/social/upload 证据，
且 needs_pains 和 behavior 两项都引用了其中的证据 → evidence_based；其余 → generated。
例：3 条网页证据，但 behavior 写的是 "inferred" → generated。

盲写检查（methods.md「Personas Describe Situations, Not Verdicts」）：人设只写处境和行为，
不写被测结论。工具用 study.json 假设里的 outcome_terms 检查「立场性」字段：
| 检查的字段                                   | 不检查                     |
| tagline、tags、expression、needs_pains、     | demographics、geography、  |
| tech_adoption、decision_weights 的 factor    | behavior、story 等事实字段 |
例：假设 H2 的 outcome_terms 含「用不完」，人设 tagline 写「认定月卡是赌你用不完」→ 拒绝保存。
复用人设命中同样拒绝（它已经替本研究说出了结论，不应入选）。旧研究没有 outcome_terms，不做检查。

语义检查：关键词过关后，再用一次小模型判定改写式泄漏（如「怕再办一张又剩着」之于「用不完」），
命中则拒绝。研究负责人认为误判时，用 leak_overrides 写明理由放行，理由记进 panel.json 的
leak_check.overrides，报告局限里要写出。判定调用失败时放行，leak_check.status 记为 skipped。

社媒锚定：study.social_sampling 为 sampled 时，每位新人设至少引用 1 条 social 证据，
让人设的处境来自真实用户原话，而不是研究者的想象。

复用的人设只追加证据、补齐缺少的出处、追加 consistency_notes，不改身份和内容字段。
imported 和 manual（用户手动填写）人设复用时保持原 tier。

| 研究类型       | 允许的阶段     | 分层校验 | 保存后                                           |
| 普通研究       | interview      | 按配额   | 阶段不变，等待访谈                               |
| persona_build  | clarify、done  | 不校验   | phase=done；clarify=done，其余阶段 skipped        |
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import (
    DisplayType,
    StudyPersonaItemContent,
    StudyPersonasContent,
    ToolDetail,
)
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.persona_research.contracts import (
    EXTERNAL_EVIDENCE_TYPES,
    MAX_PERSONAS,
    PANELS_DIR,
    PERSONA_DIMENSIONS,
    PERSONA_LAYERS,
    PERSONAS_DIR,
    SCHEMA_VERSION,
    STANDARD_FIELD_KEYS,
    EvidenceType,
    Level,
    PersonaTier,
    PhaseStatus,
    SocialSampling,
    StudyPhase,
    StudyType,
)
from app.tools.persona_research.semantic_checks import STANCE_FIELDS, JudgeUnavailable, judge_persona_leaks
from app.tools.persona_research.study_files import (
    StudyFilesError,
    ascii_slug,
    load_study,
    now_iso,
    portrait_hint,
    random_hex,
    read_json_file,
    resolve_study_dir,
    save_study,
    transcript_lock,
    workspace_relative,
    write_json_file,
)
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists, async_realpath


class EvidenceInput(BaseModel):
    id: str = Field(..., min_length=1, description="Evidence id within this persona, for example e1.")
    type: EvidenceType
    platform: str = ""
    title: str = ""
    url: str = ""
    file: str = ""
    quote: str = ""


class PersonaInput(BaseModel):
    id: str = Field(default="", description="Existing persona id to reuse; empty for a new persona.")
    id_hint: str = Field(default="", description="New persona: short ASCII slug for the id, for example zhangwei.")
    segment: str = Field(..., min_length=1, description="The study.json quota segment this persona fills.")
    reason: str = Field(..., min_length=1, description="Why this persona was selected.")
    from_uploaded_people: bool = False
    name: str = ""
    tagline: str = ""
    tags: List[str] = Field(default_factory=list)
    dimensions: Dict[str, Any] = Field(default_factory=dict)
    layers: Dict[str, Any] = Field(default_factory=dict)
    evidence: List[EvidenceInput] = Field(default_factory=list)
    field_sources: Dict[str, Union[List[str], Literal["inferred"]]] = Field(default_factory=dict)
    consistency_notes: List[str] = Field(default_factory=list)
    field_labels: Dict[str, str] = Field(
        default_factory=dict,
        description="Display name in the user's language for every non-standard key in dimensions and layers.",
    )


class LeakOverride(BaseModel):
    persona: str = Field(..., min_length=1, description="Persona name or id the leak check flagged.")
    field: str = Field(..., min_length=1, description="The flagged field, for example needs_pains.")
    hypothesis_id: str = Field(..., pattern=r"^H\d+$")
    reason: str = Field(..., min_length=1, description="Why this is a situation fact rather than the tested outcome.")


class SavePersonasParams(BaseToolParams):
    study_dir: str = Field(..., description="studies/<slug>")
    personas: List[PersonaInput] = Field(..., min_length=1, description="In interview order.")
    panel_name: str = Field(..., min_length=1)
    criteria: str = ""
    library_panel_name: str = Field(default="", description="Also save the group to panels/ under this name.")
    leak_overrides: List[LeakOverride] = Field(
        default_factory=list, description="Keep fields the semantic leak check flagged, each with the reason."
    )
    append: bool = Field(
        default=False,
        description="Add these personas to the study's existing panel instead of replacing it, for example to bring "
        "new people into a follow-up focus group after the interviews. Allowed from the interview phase on; the panel "
        f"may hold at most {MAX_PERSONAS} personas in total.",
    )


# 模型使用说明：agents/skills/persona-research/reference/tools.md
@tool(name="save_personas", code_mode_only=True)
class SavePersonas(WorkspaceTool[SavePersonasParams]):
    """Save the personas of a study and its panel.json, assigning ids and tiers by rule."""

    async def execute(self, tool_context: ToolContext, params: SavePersonasParams) -> ToolResult:
        try:
            base = await async_realpath(self.base_dir)
            study_path = await resolve_study_dir(base, params.study_dir)
            study = await load_study(study_path)
            building = study.study_type == StudyType.PERSONA_BUILD
            if building:
                if study.phase not in (StudyPhase.CLARIFY, StudyPhase.DONE):
                    raise StudyFilesError(f"a persona_build study cannot save personas in phase {study.phase}")
            elif params.append:
                if study.phase in (StudyPhase.CLARIFY, StudyPhase.PLAN, StudyPhase.DESK_RESEARCH):
                    raise StudyFilesError(f"personas can be appended from the interview phase on; the study is in {study.phase}")
            elif study.phase != StudyPhase.INTERVIEW:
                raise StudyFilesError(
                    f"personas are saved in the interview phase; the study is in {study.phase}. "
                    "Send update_study desk_research_done or desk_research_skipped first. "
                    "To add people after the interviews, call save_personas with append=true"
                )
            existing_panel = await _existing_panel(study_path) if params.append and not building else None
            if existing_panel is not None:
                # 追加时人数按整个研究算，上限是硬上限而不是计划人数：计划之外加人本来就是追加的用途。
                total = len(existing_panel["persona_ids"]) + len(params.personas)
                if total > MAX_PERSONAS:
                    raise StudyFilesError(
                        f"the panel would have {total} personas; a study holds at most {MAX_PERSONAS}. Reuse panel members instead"
                    )
            else:
                limit = study.limits.personas if study.limits else MAX_PERSONAS
                if len(params.personas) > limit:
                    raise StudyFilesError(f"{len(params.personas)} personas exceed this study's limit of {limit}")
            # persona_build 没有配额，segment 只是展示用的人群标签。
            quota = set() if building else {item.segment for item in study.quota}
            unknown = sorted({p.segment for p in params.personas if quota and p.segment not in quota})
            if unknown:
                raise StudyFilesError(f"segments must be quota segments ({', '.join(sorted(quota))}); unknown: {', '.join(unknown)}")

            outcome_terms = [] if building else [
                (h.id, term) for h in study.hypotheses for term in h.outcome_terms
            ]
            needs_social = (
                not building
                and study.social_sampling is not None
                and study.social_sampling.status == SocialSampling.SAMPLED
            )
            created_in = workspace_relative(base, study_path)
            files: List[tuple[str, Dict[str, Any]]] = []
            summary: List[Dict[str, Any]] = []
            for item in params.personas:
                persona, reused = await self._prepare(base, item, created_in)
                _check_no_outcome(persona, outcome_terms, reused)
                if needs_social and not reused and not any(
                    e.get("type") == EvidenceType.SOCIAL for e in persona["evidence"]
                ):
                    raise StudyFilesError(
                        f"{persona['name']} cites no social evidence; this study sampled social platforms, "
                        "so anchor each new persona's situation in at least one real voice from desk-research.md"
                    )
                files.append((persona["id"], persona))
                summary.append({
                    "persona_id": persona["id"],
                    "name": persona["name"],
                    "tagline": persona.get("tagline", ""),
                    "tier": persona["tier"],
                    "segment": item.segment,
                    "reused": reused,
                    **portrait_hint(persona),
                })
            ids = [pid for pid, _ in files]
            if len(set(ids)) != len(ids):
                raise StudyFilesError("the same persona appears more than once")
            if existing_panel is not None:
                already = sorted(set(ids) & set(existing_panel["persona_ids"]))
                if already:
                    raise StudyFilesError(f"{', '.join(already)} is already on this study's panel; invite them directly")
            leak_check = (
                await _semantic_leak_check(tool_context, str(study_path), study, files, params.leak_overrides)
                if outcome_terms
                else None
            )

            for pid, persona in files:
                path = base / PERSONAS_DIR / f"{pid}.json"
                async with transcript_lock(path):
                    # 另一话题可能刚完成生图绑定；保存研究内容不得写回较早的头像快照。
                    current = await read_json_file(path)
                    if current and "portrait" in current:
                        persona["portrait"] = current["portrait"]
                    await write_json_file(path, persona)
            selection = [
                {"persona_id": row["persona_id"], "reason": item.reason.strip(), "reused": row["reused"], "segment": item.segment}
                for row, item in zip(summary, params.personas)
            ]
            if existing_panel is not None:
                panel = existing_panel
                panel["persona_ids"] = [*panel["persona_ids"], *ids]
                panel["selection"] = [*(panel.get("selection") or []), *({**row, "added_later": True} for row in selection)]
                if leak_check is not None:
                    panel.setdefault("leak_checks_added", []).append(leak_check)
            else:
                panel = {
                    "schema_version": SCHEMA_VERSION,
                    "id": f"panel_{study_path.name}",
                    "name": params.panel_name.strip(),
                    "persona_ids": ids,
                    "criteria": params.criteria.strip(),
                    "selection": selection,
                }
                if leak_check is not None:
                    panel["leak_check"] = leak_check
            await write_json_file(study_path / "panel.json", panel)
            library_note = ""
            if params.library_panel_name.strip():
                panel_id = f"panel_{ascii_slug(params.library_panel_name) or 'group'}_{random_hex()}"
                await write_json_file(base / PANELS_DIR / f"{panel_id}.json", {
                    "schema_version": SCHEMA_VERSION,
                    "id": panel_id,
                    "name": params.library_panel_name.strip(),
                    "persona_ids": ids,
                    "criteria": params.criteria.strip(),
                })
                library_note = f" Also saved the group as {PANELS_DIR}/{panel_id}.json."
            if building:
                _finish_persona_build(study)
                await save_study(study_path, study)
        except StudyFilesError as exc:
            return ToolResult.error(f"Personas not saved: {exc}")

        verb = "Added" if existing_panel is not None else "Saved"
        lines = [f"{verb} {len(ids)} personas and {params.study_dir}/panel.json (interview order as listed).{library_note}"]
        lines.extend(
            f"- {row['persona_id']} {row['name']}: tier {row['tier']}, {'reused' if row['reused'] else 'new'}, segment {row['segment']}"
            for row in summary
        )
        if leak_check is not None and leak_check["status"] == "skipped":
            lines.append(f"The semantic leak check did not run ({leak_check['note']}); only the keyword check was applied.")
        if leak_check is not None and leak_check["status"] == "flagged":
            lines.append(
                f"The semantic leak check still flagged {len(leak_check['flagged'])} fields and was not blocking this time; "
                "state them in the report limitations."
            )
        if leak_check is not None and leak_check["overrides"]:
            lines.append(
                f"Kept {len(leak_check['overrides'])} flagged fields by override; state them in the report limitations."
            )
        lines.append("Use these persona file paths (personas/<persona_id>.json) in the interviewer briefs.")
        return ToolResult(
            content="\n".join(lines),
            data={"study_dir": params.study_dir, "panel_name": params.panel_name.strip(), "personas": summary},
        )

    async def _prepare(self, base, item: PersonaInput, created_in: str) -> tuple[Dict[str, Any], bool]:
        if item.id:
            path = base / PERSONAS_DIR / f"{item.id}.json"
            existing = await read_json_file(path)
            if existing is None:
                raise StudyFilesError(f"persona {item.id} does not exist; leave id empty to create a new persona")
            return _merge_reused(existing, item), True
        return await self._new_persona(base, item, created_in), False

    async def _new_persona(self, base, item: PersonaInput, created_in: str) -> Dict[str, Any]:
        label = item.name or item.id_hint or "persona"
        if not item.name.strip():
            raise StudyFilesError(f"a new persona needs a name ({label})")
        missing_dims = [key for key in PERSONA_DIMENSIONS if _empty(item.dimensions.get(key))]
        missing_layers = [key for key in PERSONA_LAYERS if _empty(item.layers.get(key))]
        missing_sources = [key for key in PERSONA_DIMENSIONS if key not in item.field_sources]
        if missing_dims or missing_layers or missing_sources:
            raise StudyFilesError(
                f"{label} is incomplete: missing dimensions {missing_dims or 'none'}, layers {missing_layers or 'none'}, "
                f"field_sources {missing_sources or 'none'}"
            )
        _check_decision_weights(label, item.layers)
        _check_evidence(label, item.evidence, item.field_sources)
        field_labels = _field_labels(label, item.dimensions, item.layers, item.field_labels)

        slug = ascii_slug(item.id_hint or item.name, max_length=20) or "persona"
        for _ in range(5):
            persona_id = f"p_{slug}_{random_hex()}"
            if not await async_exists(base / PERSONAS_DIR / f"{persona_id}.json"):
                break
        else:
            raise StudyFilesError(f"could not find a free id for {label}; use a different id_hint")
        evidence = [e.model_dump(mode="json") for e in item.evidence]
        persona = {
            "schema_version": SCHEMA_VERSION,
            "id": persona_id,
            "name": item.name.strip(),
            "tagline": item.tagline.strip(),
            "tags": item.tags,
            "tier": _tier(item.from_uploaded_people, evidence, item.field_sources).value,
            "dimensions": {key: item.dimensions[key] for key in PERSONA_DIMENSIONS},
            "layers": {key: item.layers[key] for key in PERSONA_LAYERS},
            "evidence": evidence,
            "field_sources": item.field_sources,
            "consistency_notes": item.consistency_notes,
            **({"field_labels": field_labels} if field_labels else {}),
            "created_in": created_in,
            "updated_at": now_iso(),
        }
        return persona

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        # 例：「8 位人设：新建 5 位，复用 3 位」
        if result.ok:
            rows = result.data.get("personas") or []
            reused = sum(1 for row in rows if row.get("reused"))
            remark = _translate("save_personas.success", count=len(rows), new=len(rows) - reused, reused=reused)
        else:
            remark = _translate("save_personas.error")
        return {"tool_name": tool_name, "action": i18n.translate("save_personas", category="tool.actions"), "remark": remark}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        if not result.ok:
            return None
        rows = result.data.get("personas") or []
        reused = sum(1 for row in rows if row["reused"])
        return ToolDetail(
            type=DisplayType.STUDY_PERSONAS,
            data=StudyPersonasContent(
                panel_name=result.data.get("panel_name", ""),
                new_count=len(rows) - reused,
                reused_count=reused,
                personas=[
                    StudyPersonaItemContent(
                        persona_id=row["persona_id"],
                        name=row["name"],
                        tagline=row.get("tagline", ""),
                        segment=row["segment"],
                        reused=row["reused"],
                        gender=row.get("gender", ""),
                        age=row.get("age", ""),
                    )
                    for row in rows
                ],
            ),
        )


def _merge_reused(existing: Dict[str, Any], item: PersonaInput) -> Dict[str, Any]:
    """复用：只追加证据、补齐缺少的出处、追加矛盾记录，tier 按合并后的证据重算。"""
    persona = dict(existing)
    label = str(persona.get("name") or item.id)
    evidence = list(persona.get("evidence") or [])
    known = {str(e.get("id")) for e in evidence if isinstance(e, dict)}
    clashes = [e.id for e in item.evidence if e.id in known]
    if clashes:
        raise StudyFilesError(f"{label} already has evidence ids {', '.join(clashes)}; use new ids for added evidence")
    evidence.extend(e.model_dump(mode="json") for e in item.evidence)
    field_sources = dict(persona.get("field_sources") or {})
    for key, value in item.field_sources.items():
        field_sources.setdefault(key, value)
    _check_evidence(label, item.evidence, field_sources, known_ids=known)
    persona["schema_version"] = SCHEMA_VERSION
    persona["evidence"] = evidence
    persona["field_sources"] = field_sources
    persona["consistency_notes"] = list(persona.get("consistency_notes") or []) + item.consistency_notes
    # 复用人设内容不变，但允许补上缺少的显示名（旧人设里的自造 key 也能显示成中文）。
    labels = dict(persona.get("field_labels") or {})
    for key, text in item.field_labels.items():
        if text.strip():
            labels.setdefault(key, text.strip())
    if labels:
        persona["field_labels"] = labels
    if persona.get("tier") not in (PersonaTier.IMPORTED, PersonaTier.MANUAL):
        persona["tier"] = _tier(False, evidence, field_sources).value
    persona["updated_at"] = now_iso()
    return persona


def _finish_persona_build(study) -> None:
    """只构建人设的研究在人设入库后结束；计划、访谈等阶段没有发生，记为 skipped。"""
    study.phase = StudyPhase.DONE
    for phase in study.phases:
        phase.status = PhaseStatus.DONE if phase.key == StudyPhase.CLARIFY else PhaseStatus.SKIPPED


def _tier(from_uploaded_people: bool, evidence: List[Dict[str, Any]], field_sources: Dict[str, Any]) -> PersonaTier:
    if from_uploaded_people:
        if not any(e.get("type") == EvidenceType.UPLOAD for e in evidence):
            raise StudyFilesError("a persona built from uploaded people needs at least one upload evidence item")
        return PersonaTier.IMPORTED
    external = {str(e.get("id")) for e in evidence if e.get("type") in EXTERNAL_EVIDENCE_TYPES}
    cited = all(
        isinstance(field_sources.get(key), list) and external & set(field_sources[key])
        for key in ("needs_pains", "behavior")
    )
    return PersonaTier.EVIDENCE_BASED if len(external) >= 3 and cited else PersonaTier.GENERATED


def _check_evidence(
    label: str, evidence: List[EvidenceInput], field_sources: Dict[str, Any], known_ids: Optional[set[str]] = None
) -> None:
    """检查新证据的 id 不重复、社交证据有平台、field_sources 只引用存在的证据（含复用人设已有的证据）。"""
    new_ids = [e.id for e in evidence]
    ids = set(new_ids) | (known_ids or set())
    if len(set(new_ids)) != len(new_ids):
        raise StudyFilesError(f"{label} has duplicate evidence ids")
    missing_platform = [e.id for e in evidence if e.type == EvidenceType.SOCIAL and not e.platform]
    if missing_platform:
        raise StudyFilesError(f"{label}: social evidence needs platform ({', '.join(missing_platform)})")
    for key, value in field_sources.items():
        if key not in PERSONA_DIMENSIONS:
            raise StudyFilesError(f"{label}: field_sources key {key!r} is not one of {', '.join(PERSONA_DIMENSIONS)}")
        if isinstance(value, list):
            unknown = [ref for ref in value if ref not in ids]
            if unknown:
                raise StudyFilesError(f"{label}: field_sources.{key} cites unknown evidence {', '.join(unknown)}")


def _stance_texts(persona: Dict[str, Any]) -> Dict[str, List[str]]:
    """立场性字段（semantic_checks.STANCE_FIELDS）的文本：写进这些地方的被测结论，会被受访者当作自己的观点复述。"""
    dimensions = persona.get("dimensions") or {}
    layers = persona.get("layers") or {}
    cognition = layers.get("cognition") if isinstance(layers.get("cognition"), dict) else {}
    weights = cognition.get("decision_weights") or []
    raw = {
        "tagline": [persona.get("tagline")],
        "tags": persona.get("tags") or [],
        "expression": layers.get("expression") or [],
        "needs_pains": dimensions.get("needs_pains") or [],
        "tech_adoption": dimensions.get("tech_adoption") or [],
        "decision_weights": [w.get("factor") for w in weights if isinstance(w, dict)],
    }
    return {key: [str(v) for v in (raw[key] if isinstance(raw[key], list) else [raw[key]]) if v] for key in STANCE_FIELDS}


def _check_no_outcome(persona: Dict[str, Any], outcome_terms: List[tuple[str, str]], reused: bool) -> None:
    """人设立场性字段里出现被测结论的关键词时拒绝保存，并指出字段和假设。"""
    if not outcome_terms:
        return
    hits = []
    for field_name, texts in _stance_texts(persona).items():
        lowered = [text.lower() for text in texts]
        for hypothesis_id, term in outcome_terms:
            if any(term.lower() in text for text in lowered):
                hits.append(f"{field_name} contains {term!r} ({hypothesis_id})")
    if not hits:
        return
    label = persona.get("name") or persona.get("id")
    action = (
        "do not select this reused persona for this study"
        if reused
        else "rewrite those fields as past facts (what happened, when, at what cost) and drop the attitude, "
        "for example 'afraid the card goes unused' becomes 'last year's 10-session card: used 6, the rest expired'"
    )
    raise StudyFilesError(
        f"{label} already states the outcome being tested: {'; '.join(hits)}. "
        f"Personas describe situations, not verdicts; {action}"
    )


# 同一研究里语义检查只拦截一次：模型判定会随改写波动，反复拦截会让 agent 陷入「改写 → 再被拦」循环。
# 第一次拦截后同一研究的后续保存只提醒，命中项记入 panel.json 并要求写进报告局限。进程内记录即可，
# 拦截发生在写任何文件之前，没有持久状态要同步。
_leak_blocked_studies: set[str] = set()


async def _semantic_leak_check(
    tool_context: ToolContext,
    study_key: str,
    study,
    files: List[tuple[str, Dict[str, Any]]],
    overrides: List[LeakOverride],
) -> Dict[str, Any]:
    """一次调用判全部人设的改写式泄漏；命中且未被 override 时抛 StudyFilesError。

    例：H1 测「低频者用不完」，人设 needs_pains 写「怕再办一张又剩着」→ 拒绝，提示改写成事实
    或写 leak_overrides。判定不可用时返回 status=skipped，不拦截。
    同一研究第二次起命中项不再拦截：status=flagged，flagged 记录未覆盖的命中项。
    """
    labels = {f"P{index}": persona for index, (_, persona) in enumerate(files, start=1)}
    hypotheses = [
        {"id": h.id, "statement": h.statement, "support_criteria": h.support_criteria, "refute_criteria": h.refute_criteria}
        for h in study.hypotheses
    ]
    fields = {
        label: {"name": [str(persona.get("name") or "")], **{k: v for k, v in _stance_texts(persona).items() if v}}
        for label, persona in labels.items()
    }
    applied = [o.model_dump() for o in overrides]
    try:
        leaks = await judge_persona_leaks(tool_context, hypotheses, fields)
    except JudgeUnavailable as exc:
        return {"status": "skipped", "note": str(exc)[:200], "overrides": applied}

    def overridden(leak) -> bool:
        persona = labels[leak.persona]
        names = {str(persona.get("name") or ""), str(persona.get("id") or "")}
        return any(
            o.persona in names and o.field == leak.field and o.hypothesis_id == leak.hypothesis_id for o in overrides
        )

    blocking = [leak for leak in leaks if not overridden(leak)]
    if blocking and study_key in _leak_blocked_studies:
        flagged = [
            {"persona": labels[leak.persona].get("name"), "field": leak.field, "hypothesis_id": leak.hypothesis_id, "why": leak.why}
            for leak in blocking
        ]
        return {"status": "flagged", "note": "", "overrides": applied, "flagged": flagged}
    if blocking:
        _leak_blocked_studies.add(study_key)
        details = "; ".join(
            f"{labels[leak.persona].get('name')} {leak.field} ({leak.hypothesis_id}): \"{leak.text[:60]}\" - {leak.why}"
            for leak in blocking
        )
        raise StudyFilesError(
            f"the semantic leak check found stance fields that predict a hypothesis answer: {details}. "
            "Fix everything in one retry. If a flagged text is already a dated, concrete event, keep it by passing "
            "leak_overrides with persona, field, hypothesis_id, and the reason; otherwise rewrite it as a past fact "
            "(what happened, when, at what cost). This check blocks a study only once; a later save is recorded "
            "with the remaining flags instead of rejected"
        )
    return {"status": "passed", "note": "", "overrides": applied}


def _custom_keys(value: Any) -> set[str]:
    """dimensions / layers 里所有层级的对象 key（列表里的对象除外，如 decision_weights 的 factor/level）。"""
    keys: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            keys.add(str(key))
            keys |= _custom_keys(child)
    return keys


def _field_labels(label: str, dimensions: Dict[str, Any], layers: Dict[str, Any], given: Dict[str, str]) -> Dict[str, str]:
    """新人设的自造字段 key 必须有显示名；返回只含实际出现 key 的显示名。

    例：demographics 里写了 monthly_allowance_cny，就要给 {"monthly_allowance_cny": "月生活费（元）"}。
    age、city_tier 等前端已有显示名的 key 不需要。
    """
    present = (_custom_keys(dimensions) | _custom_keys(layers)) - set(PERSONA_DIMENSIONS) - set(PERSONA_LAYERS)
    custom = sorted(present - STANDARD_FIELD_KEYS)
    labels = {key: text.strip() for key, text in given.items() if key in present and text.strip()}
    missing = [key for key in custom if key not in labels]
    if missing:
        raise StudyFilesError(
            f"{label}: give field_labels with a display name in the user's language for {', '.join(missing)} "
            '(for example {"monthly_allowance_cny": "月生活费（元）"}); standard keys such as age or city_tier need none'
        )
    return labels


def _check_decision_weights(label: str, layers: Dict[str, Any]) -> None:
    cognition = layers.get("cognition")
    weights = cognition.get("decision_weights") if isinstance(cognition, dict) else None
    levels = {level.value for level in Level}
    if not isinstance(weights, list) or not weights or not all(
        isinstance(w, dict) and w.get("factor") and w.get("level") in levels for w in weights
    ):
        raise StudyFilesError(
            f'{label}: layers.cognition.decision_weights must be a list of {{"factor", "level": "high" | "medium" | "low"}}'
        )


def _empty(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def _translate(key: str, **kwargs: Any) -> str:
    return i18n.translate(key, category="tool.messages", **kwargs)


async def _existing_panel(study_path: Path) -> Dict[str, Any]:
    """追加模式读取已有 panel.json；没有时说明应先正常保存人设。"""
    data = await read_json_file(study_path / "panel.json")
    if not isinstance(data, dict) or not isinstance(data.get("persona_ids"), list):
        raise StudyFilesError("this study has no panel.json yet; save its panel without append first")
    return data
