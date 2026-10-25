/**
 * File contracts written by the persona-research agent and read by the AI research pages.
 * Keep in sync with backend/super-magic/agents/skills/persona-research/reference/file-contracts.md.
 *
 * Project layout (one special project per user, one topic per study):
 * personas/<persona_id>.json            persona library, reused across studies
 * panels/<panel_id>.json                saved persona groups
 * studies/<slug>/study.json             study state that drives the stepper
 * studies/<slug>/panel.json             personas used by this study
 * studies/<slug>/interviews/<id>.json   one-on-one transcripts
 * studies/<slug>/discussions/<id>.json  focus-group transcripts
 * studies/<slug>/synthesis.json        theme coding, dimensions and saturation (analysis board)
 * studies/<slug>/validation-results.json  real-person answers compared with AI verdicts
 * studies/<slug>/report.html, plan.md, desk-research.md, validation-questionnaire.md(.csv)
 *
 * Fields added after the first release are optional; older study files simply lack them.
 */

export const STUDY_PHASE_KEYS = [
	"clarify",
	"plan",
	"desk_research",
	"interview",
	"report",
	"validation",
] as const

export type StudyPhaseKey = (typeof STUDY_PHASE_KEYS)[number]
export type StudyPhase = StudyPhaseKey | "done"
export type StudyPhaseStatus = "done" | "running" | "pending" | "skipped" | "failed"

export type StudyType =
	| "user_research"
	| "product_rnd"
	| "concept_test"
	| "fast_insight"
	| "panel_only"
	/** Persona building only: the agent saves personas and the study ends, no interviews. */
	| "persona_build"

export interface StudyPhaseState {
	key: StudyPhaseKey
	status: StudyPhaseStatus
}

export type HypothesisVerdict = "pending" | "supported" | "refuted" | "mixed" | "insufficient"
export type AgreementLevel = "agree" | "partial" | "disagree"

/** Points to one transcript round or one desk-research source ("S3"). */
export type EvidenceRef =
	| {
			kind: "quote"
			persona_id: string
			round_index?: number
			text: string
			file?: string
			/** The moderator's question already named this idea before the persona said it. */
			prompted?: boolean
	  }
	| {
			kind: "source"
			ref: string
			/** What the source says about this hypothesis, in one sentence. */
			claim?: string
			/** core: states the hypothesis' core claim; context: background only. */
			covers?: "core" | "context"
	  }

export interface StudyHypothesis {
	id: string
	statement: string
	support_criteria?: string
	refute_criteria?: string
	verdict: HypothesisVerdict
	verdict_reason?: string
	evidence_refs?: EvidenceRef[]
	validation?: { verdict: AgreementLevel; summary?: string }
}

export interface StudyQuota {
	segment: string
	criteria?: string
	count: number
}

export type GuideIssue =
	"leading" | "double_barreled" | "hypothesis_reveal" | "jargon" | "sequence_priming"

export interface StudyFile {
	schema_version: 1
	/** Topic that runs this study; the workspace finds a topic's study directory by it. */
	topic_id?: string
	title: string
	question: string
	study_type?: StudyType
	framework?: string[]
	phase: StudyPhase
	phases: StudyPhaseState[]
	limits?: { personas?: number; interview_rounds?: number }
	outputs?: { plan?: string; report?: string; validation?: string }
	/** The business decision this study informs. */
	decision?: string
	hypotheses?: StudyHypothesis[]
	quota?: StudyQuota[]
	guide_review?: { items: { issue: GuideIssue; before: string; after: string }[] }
	/** Real respondents compared so far; drives the "validated N people" stepper label. */
	validated_count?: number
	/** Whether desk research sampled social platforms directly (methods.md "Real Voices"). */
	social_sampling?: {
		status: "sampled" | "unavailable" | "not_relevant"
		platforms: string[]
		posts: number
		comments: number
		note?: string
	}
}

/** "manual": written by the user in the persona library, never re-tiered by the agent. */
export type PersonaTier = "generated" | "evidence_based" | "imported" | "manual"
export type QualitativeLevel = "high" | "medium" | "low"

export interface DecisionWeight {
	factor: string
	level: QualitativeLevel
}

export interface PersonaEvidence {
	id: string
	type: "web" | "social" | "upload" | "interview"
	/** Social platform for type "social", e.g. "xiaohongshu". */
	platform?: string
	title?: string
	url?: string
	file?: string
	quote?: string
}

/** A library persona chosen for the next study, as the home composer shows and sends it. */
export interface StudyPersonaPick {
	id: string
	name: string
	/** Project-relative persona file, sent in the settings line as "指定人设: <paths>". */
	path: string
	demographics?: Record<string, unknown>
}

export interface PersonaFile {
	schema_version: 1
	id: string
	name: string
	/** Bound project image identity; no expiring URL is persisted. Absent in older personas. */
	portrait?: { file: string; file_id?: string; updated_at: string }
	tagline?: string
	tags?: string[]
	tier: PersonaTier
	dimensions?: {
		demographics?: Record<string, unknown>
		geography?: Record<string, unknown>
		psychographics?: Record<string, unknown>
		behavior?: Record<string, unknown>
		needs_pains?: unknown[]
		tech_adoption?: string
		social?: string
	}
	layers?: {
		expression?: unknown[]
		story?: string
		/**
		 * Qualitative ranking [{factor, level}]. Early files used numeric weights
		 * ({factor: 0.3}); the UI maps those to levels and never shows decimals.
		 */
		cognition?: { decision_weights?: DecisionWeight[] | Record<string, unknown> }
		behavior?: unknown[]
	}
	evidence?: PersonaEvidence[]
	/** Evidence ids backing each dimension, "inferred" when nothing backs it, "user" when the user wrote it. */
	field_sources?: Record<string, PersonaFieldSource>
	/**
	 * Display names, in the user's language, for keys the agent made up inside dimensions and
	 * layers (e.g. {"monthly_allowance_cny": "月生活费（元）"}); standard keys have built-in names.
	 */
	field_labels?: Record<string, string>
	/** Cross-layer contradictions kept on purpose, e.g. says X but does Y. */
	consistency_notes?: string[]
	created_in?: string
	updated_at?: string
	/** Last edit made by the user in the persona library. */
	edited_at?: string
}

export type PersonaFieldSource = string[] | "inferred" | "user"
export type PersonaDimensionKey = keyof NonNullable<PersonaFile["dimensions"]>

export interface PanelSelection {
	persona_id: string
	reason?: string
	reused?: boolean
	segment?: string
}

export interface PanelFile {
	schema_version: 1
	id: string
	name: string
	persona_ids: string[]
	criteria?: string
	/** Study panel only: why each persona was chosen. */
	selection?: PanelSelection[]
}

export interface TranscriptRound {
	/** Present only on explicit user chat turns; older automatic interview files omit these. */
	request_id?: string
	source?: "user"
	/** "moderator", "persona" (interviews) or a persona_id (discussions). */
	role?: string
	speaker?: string
	text: string
}

export interface TranscriptQuote {
	text: string
	theme?: string
}

export interface InterviewFile {
	/** Additional chat answers have not been incorporated into the original summary/report. */
	insights_outdated?: boolean
	schema_version: 1
	persona_id: string
	status: "done" | "running" | "failed"
	error?: string
	rounds: TranscriptRound[]
	summary?: string
	key_findings?: string[]
	quotes?: TranscriptQuote[]
	quality?: TranscriptQuality
}

export interface TranscriptQuality {
	concrete_stories?: number
	/** 0–1 share of persona sentences marked "(inferred)". */
	inferred_ratio?: number
	agreement_flags?: number
	notes?: string
}

export interface DiscussionFile extends Omit<InterviewFile, "persona_id"> {
	id?: string
	participants: string[]
	/** One line in the user's language, e.g. "家里有洗衣机，为什么还会下楼洗"; older files lack it. */
	topic?: string
}

export type ThemeStance = "support" | "oppose" | "mixed" | "not_mentioned"
export type ThemeConfidence = "high" | "medium" | "low" | "to_validate"

export interface QuoteRef {
	persona_id: string
	source?: "interview" | "discussion"
	/** Path relative to the study directory, e.g. "interviews/p_x.json". */
	file?: string
	round_index?: number
	text: string
	/** The moderator's question already named this idea before the persona said it. */
	prompted?: boolean
	/** The moderator question this quote answered. */
	question?: string
}

export interface SynthesisTheme {
	id: string
	name: string
	description?: string
	stance_by_persona: Record<string, ThemeStance>
	quote_refs?: QuoteRef[]
	source_refs?: string[]
	hypothesis_ids?: string[]
	confidence: ThemeConfidence
	confidence_reason?: string
}

export interface SynthesisDimension {
	id: string
	name: string
	level_by_segment: Record<string, QualitativeLevel>
	quote_refs?: QuoteRef[]
}

export interface SynthesisFile {
	schema_version: 1
	segments: { id: string; name: string; persona_ids: string[] }[]
	themes: SynthesisTheme[]
	dimensions?: SynthesisDimension[]
	saturation?: { new_themes_per_interview: number[]; saturated: boolean }
	/** Themes every interviewee agreed on; warning means the panel may be answering alike. */
	homogeneity?: { unanimous_theme_ids: string[]; warning: boolean }
}

export interface ValidationResultsFile {
	schema_version: 1
	respondent_count: number
	source_files?: string[]
	by_hypothesis: {
		hypothesis_id: string
		ai_verdict?: HypothesisVerdict
		human_verdict?: HypothesisVerdict
		agreement: AgreementLevel
		summary?: string
		human_quotes?: string[]
	}[]
	by_question?: {
		question_id: string
		hypothesis_id?: string
		ai_summary?: string
		human_summary?: string
		agreement: AgreementLevel
	}[]
	summary?: string
}

/** A parsed research file together with the attachment it was read from. */
export interface ResearchFileRef<T> {
	fileId: string
	path: string
	data: T
}

/** Result of reading one contract file; invalid files are surfaced as "not ready" instead of errors. */
export type ParsedResearchFile<T> = { ok: true; data: T } | { ok: false; reason: string }
