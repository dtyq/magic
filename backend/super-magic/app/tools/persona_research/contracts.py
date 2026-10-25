"""persona-research 文件契约的枚举、常量和 study.json 模型。

与 agents/skills/persona-research/reference/file-contracts.md 一一对应；前端
（frontend/magic-web/src/pages/superMagic/pages/PersonaResearch/services/researchFiles.ts）
按同一契约解析，字段名或枚举不一致时研究界面会显示「未就绪」。

读取时允许多余字段（旧文件或模型额外写入的字段不报错），写入只产出契约字段。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

SCHEMA_VERSION = 1

# 成本上限，与 SKILL.md「Cost Limits」一致。
MAX_PERSONAS = 12
# 「只构建人设」的对话每次最多保存的人设数（SKILL.md「Persona Building Requests」）。
MAX_BUILD_PERSONAS = 6
MAX_INTERVIEW_ROUNDS = 20
MAX_DISCUSSION_ROUNDS = 7
# 每个研究最多的焦点小组场数：只防止失控重复开场，正常追加讨论碰不到。
MAX_DISCUSSIONS = 10
DEFAULT_INTERVIEW_ROUNDS = MAX_INTERVIEW_ROUNDS

# 访谈质量降权阈值，与 methods.md「Downweighting」一致。
DOWNWEIGHT_INFERRED_RATIO = 0.4

INTERVIEWS_DIR = "interviews"
DISCUSSIONS_DIR = "discussions"
STUDIES_DIR = "studies"
PERSONAS_DIR = "personas"
PANELS_DIR = "panels"
# 报告模板库：一个 HTML 一个模板；没有任何模板时放入内置模板，未指定模板的研究用它。
TEMPLATES_DIR = "templates"
DEFAULT_REPORT_TEMPLATE = "voices.html"


class StudyPhase(StrEnum):
    CLARIFY = "clarify"
    PLAN = "plan"
    DESK_RESEARCH = "desk_research"
    INTERVIEW = "interview"
    REPORT = "report"
    VALIDATION = "validation"
    DONE = "done"


PHASE_ORDER: List[StudyPhase] = [
    StudyPhase.CLARIFY,
    StudyPhase.PLAN,
    StudyPhase.DESK_RESEARCH,
    StudyPhase.INTERVIEW,
    StudyPhase.REPORT,
    StudyPhase.VALIDATION,
]


class PhaseStatus(StrEnum):
    DONE = "done"
    RUNNING = "running"
    PENDING = "pending"
    SKIPPED = "skipped"
    FAILED = "failed"


class StudyType(StrEnum):
    USER_RESEARCH = "user_research"
    PRODUCT_RND = "product_rnd"
    CONCEPT_TEST = "concept_test"
    FAST_INSIGHT = "fast_insight"
    PANEL_ONLY = "panel_only"
    # 只构建人设、不做研究：人设保存后研究直接结束，不经过计划、访谈和报告。
    PERSONA_BUILD = "persona_build"


class Verdict(StrEnum):
    PENDING = "pending"
    SUPPORTED = "supported"
    REFUTED = "refuted"
    MIXED = "mixed"
    INSUFFICIENT = "insufficient"


class Confidence(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    TO_VALIDATE = "to_validate"


class Stance(StrEnum):
    SUPPORT = "support"
    OPPOSE = "oppose"
    MIXED = "mixed"
    NOT_MENTIONED = "not_mentioned"


class Level(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Agreement(StrEnum):
    AGREE = "agree"
    PARTIAL = "partial"
    DISAGREE = "disagree"


class GuideIssue(StrEnum):
    LEADING = "leading"
    DOUBLE_BARRELED = "double_barreled"
    HYPOTHESIS_REVEAL = "hypothesis_reveal"
    JARGON = "jargon"
    # 单句没问题，但前一题的措辞把后一题引向某个答案。
    # 例：先问「最想弄清楚什么」，紧接着问「哪条规则会让你觉得亏」，受访者自然都先谈规则。
    SEQUENCE_PRIMING = "sequence_priming"


class PersonaTier(StrEnum):
    GENERATED = "generated"
    EVIDENCE_BASED = "evidence_based"
    IMPORTED = "imported"
    # 用户在人设库手动填写；Agent 复用时不重算、不改写 tier。
    MANUAL = "manual"


class SocialSampling(StrEnum):
    """桌面研究阶段是否从社媒平台直接采样（methods.md「Real Voices」）。"""

    SAMPLED = "sampled"
    # 部署里没有平台数据技能，或调用失败（余额、权限、限流）。
    UNAVAILABLE = "unavailable"
    # 研究对象在社媒上没有可用的公开讨论，例如企业内部流程。
    NOT_RELEVANT = "not_relevant"


class EvidenceType(StrEnum):
    WEB = "web"
    SOCIAL = "social"
    UPLOAD = "upload"
    INTERVIEW = "interview"


# 能让人设升级为 evidence_based 的证据类型；AI 访谈不算外部证据。
EXTERNAL_EVIDENCE_TYPES = {EvidenceType.WEB, EvidenceType.SOCIAL, EvidenceType.UPLOAD}

PERSONA_DIMENSIONS = (
    "demographics",
    "geography",
    "psychographics",
    "behavior",
    "needs_pains",
    "tech_adoption",
    "social",
)
PERSONA_LAYERS = ("expression", "story", "cognition", "behavior")

# 前端已有显示名的字段 key（personaResearch.json 的 persona.field.*）。人设里出现其它 key 时，
# 新人设必须在 field_labels 里给出用户语言的显示名，否则研究页会直接露出 monthly_allowance_cny 这类英文 key。
STANDARD_FIELD_KEYS = frozenset({
    "age", "city", "city_tier", "device", "education", "gender", "income", "lifestyle",
    "occupation", "purchase_channel", "region", "risk_attitude", "values", "decision_weights",
})


class TranscriptStatus(StrEnum):
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class QuestionType(StrEnum):
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    OPEN = "open"


class _Lenient(BaseModel):
    model_config = ConfigDict(extra="allow", use_enum_values=True)


class PhaseState(_Lenient):
    key: StudyPhase
    status: PhaseStatus


class QuotaItem(_Lenient):
    segment: str = Field(..., min_length=1)
    criteria: str = ""
    count: int = Field(..., ge=1)


class StudyLimits(_Lenient):
    personas: int = Field(..., ge=1, le=MAX_PERSONAS)
    interview_rounds: int = Field(..., ge=1, le=MAX_INTERVIEW_ROUNDS)


class SocialSamplingRecord(_Lenient):
    status: SocialSampling
    platforms: List[str] = Field(default_factory=list)
    posts: int = Field(default=0, ge=0)
    comments: int = Field(default=0, ge=0)
    note: str = ""


class HypothesisValidation(_Lenient):
    verdict: Agreement
    summary: str = ""


class Hypothesis(_Lenient):
    id: str = Field(..., pattern=r"^H\d+$")
    statement: str = Field(..., min_length=1)
    support_criteria: str = Field(..., min_length=1)
    refute_criteria: str = Field(..., min_length=1)
    # 被测结果的关键词，save_personas 用它拦截「人设里预先写好结论」。旧研究没有这个字段，不做拦截。
    outcome_terms: List[str] = Field(default_factory=list)
    verdict: Verdict = Verdict.PENDING
    verdict_reason: str = ""
    evidence_refs: List[Dict[str, Any]] = Field(default_factory=list)
    validation: Optional[HypothesisValidation] = None


class Study(_Lenient):
    """study.json。phases 必须是 6 个阶段按顺序排列的数组。"""

    schema_version: Literal[1]
    topic_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)
    study_type: Optional[StudyType] = None
    framework: Optional[List[str]] = None
    phase: StudyPhase
    phases: List[PhaseState]
    limits: Optional[StudyLimits] = None
    outputs: Optional[Dict[str, str]] = None
    decision: Optional[str] = None
    hypotheses: List[Hypothesis] = Field(default_factory=list)
    quota: List[QuotaItem] = Field(default_factory=list)
    guide_review: Optional[Dict[str, Any]] = None
    social_sampling: Optional[SocialSamplingRecord] = None
    validated_count: Optional[int] = None

    @field_validator("topic_id", mode="before")
    @classmethod
    def _topic_id_as_text(cls, value: Any) -> Any:
        # 话题 ID 是大整数，模型偶尔写成数字；按字符串保存，避免前端精度丢失。
        return str(value) if isinstance(value, int) else value

    @field_validator("phases")
    @classmethod
    def _phases_in_order(cls, value: List[PhaseState]) -> List[PhaseState]:
        keys = [StudyPhase(item.key) for item in value]
        if keys != PHASE_ORDER:
            raise ValueError("phases must list " + ", ".join(PHASE_ORDER) + " in this order")
        return value

    def phase_status(self, phase: StudyPhase) -> PhaseStatus:
        return PhaseStatus(next(item.status for item in self.phases if item.key == phase))

    def set_phase_status(self, phase: StudyPhase, status: PhaseStatus) -> None:
        for item in self.phases:
            if item.key == phase:
                item.status = status

    def to_file(self) -> Dict[str, Any]:
        return self.model_dump(mode="json", exclude_none=True)


def initial_phases() -> List[PhaseState]:
    return [
        PhaseState(key=phase, status=PhaseStatus.RUNNING if phase == StudyPhase.CLARIFY else PhaseStatus.PENDING)
        for phase in PHASE_ORDER
    ]
