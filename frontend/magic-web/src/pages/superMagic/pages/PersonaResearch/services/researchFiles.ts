import { z } from "zod"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { STUDY_PHASE_KEYS } from "../types"
import type {
	DiscussionFile,
	InterviewFile,
	PanelFile,
	ParsedResearchFile,
	PersonaFile,
	StudyFile,
	SynthesisFile,
	ValidationResultsFile,
} from "../types"

/**
 * Locates and validates the research contract files inside the project attachment list.
 *
 * The agent owns these files; the page only reads them. A file that is missing, half-written
 * or from an unknown schema version is reported as "not ready" so the conversation keeps
 * working while the side panel shows a waiting state.
 */

export const PERSONAS_DIR = "personas/"
export const PANELS_DIR = "panels/"
export const STUDIES_DIR = "studies/"
export const STUDY_FILE_NAME = "study.json"
/** Report templates: one HTML file each; the agent seeds voices.html into an empty library. */
export const TEMPLATES_DIR = "templates/"
export const DEFAULT_REPORT_TEMPLATE_PATH = `${TEMPLATES_DIR}voices.html`

/** Attachment paths may or may not start with "/"; compare without it. */
export function normalizeResearchPath(path: string | undefined | null): string {
	return (path ?? "").replace(/^\/+/, "")
}

function attachmentPath(item: AttachmentItem): string {
	return normalizeResearchPath(item.relative_file_path ?? item.path)
}

function isFile(item: AttachmentItem): boolean {
	return !item.is_directory && Boolean(item.file_id)
}

/** Cache key that changes whenever the agent rewrites the file. */
export function attachmentVersionKey(item: AttachmentItem): string {
	return `${item.file_id ?? ""}:${item.updated_at ?? ""}:${item.file_size ?? ""}`
}

/** Every study state file, e.g. "studies/ai-recorder-7f3a/study.json". */
export function listStudyFiles(list: AttachmentItem[]): AttachmentItem[] {
	return list.filter((item) => {
		if (!isFile(item)) return false
		const path = attachmentPath(item)
		return (
			path.startsWith(STUDIES_DIR) &&
			path.endsWith(`/${STUDY_FILE_NAME}`) &&
			path.split("/").length === 3
		)
	})
}

/**
 * Finds the study directory that belongs to one topic.
 * The agent records the topic in study.json `topic_id`, read through `studyTopicIdOf`; the
 * attachment's own topic_id is only a fallback because agent-written files may carry 0.
 * Example: study.json of "studies/ai-recorder-7f3a/" has topic_id "123" → "studies/ai-recorder-7f3a/".
 * When several study files match (a renamed study), the most recently updated wins.
 */
export function findStudyDir(
	list: AttachmentItem[],
	topicId: string | undefined,
	studyTopicIdOf?: (item: AttachmentItem) => string | undefined,
): string | null {
	if (!topicId) return null
	return indexStudyDirs(list, studyTopicIdOf).get(String(topicId)) ?? null
}

/**
 * Study directory of every topic in one pass over the attachment list, with the same matching
 * rules as `findStudyDir`. List rows look up their study here instead of scanning the whole
 * list per row, which grows as studies × files.
 * Example: two study.json files recording topic "t1" → { "t1" → the more recently updated dir }.
 */
export function indexStudyDirs(
	list: AttachmentItem[],
	studyTopicIdOf?: (item: AttachmentItem) => string | undefined,
): Map<string, string> {
	const latest = new Map<string, AttachmentItem>()
	const claim = (topicId: string | undefined, item: AttachmentItem) => {
		if (!topicId) return
		const current = latest.get(topicId)
		// Ties keep the earlier file, as the stable sort in the per-topic lookup did.
		if (
			!current ||
			String(item.updated_at ?? "").localeCompare(String(current.updated_at ?? "")) > 0
		) {
			latest.set(topicId, item)
		}
	}
	for (const item of listStudyFiles(list)) {
		const recorded = studyTopicIdOf?.(item)
		claim(recorded, item)
		const own = String(item.topic_id ?? "")
		if (own !== recorded) claim(own, item)
	}
	const dirs = new Map<string, string>()
	for (const [topicId, item] of latest) {
		const path = attachmentPath(item)
		dirs.set(topicId, path.slice(0, path.length - STUDY_FILE_NAME.length))
	}
	return dirs
}

/** Library path of a persona, e.g. "p_chen_1a2b" → "personas/p_chen_1a2b.json". */
export function personaFilePath(personaId: string): string {
	return `${PERSONAS_DIR}${personaId}.json`
}

export interface StudyAttachments {
	dir: string
	study: AttachmentItem | null
	panel: AttachmentItem | null
	interviews: AttachmentItem[]
	discussions: AttachmentItem[]
	report: AttachmentItem | null
	plan: AttachmentItem | null
	deskResearch: AttachmentItem | null
	validation: AttachmentItem | null
	validationCsv: AttachmentItem | null
	synthesis: AttachmentItem | null
	validationResults: AttachmentItem | null
	/** Every file in the study directory, used for delete and file-count chips. */
	all: AttachmentItem[]
}

/** Groups the files of one study directory by contract role. */
export function collectStudyAttachments(list: AttachmentItem[], dir: string): StudyAttachments {
	const files = list.filter((item) => isFile(item) && attachmentPath(item).startsWith(dir))
	const byName = (name: string) =>
		files.find((item) => attachmentPath(item) === `${dir}${name}`) ?? null
	const inSubDir = (sub: string) =>
		files
			.filter((item) => {
				const rest = attachmentPath(item).slice(dir.length)
				return (
					rest.startsWith(`${sub}/`) &&
					rest.endsWith(".json") &&
					rest.split("/").length === 2
				)
			})
			.sort((a, b) => attachmentPath(a).localeCompare(attachmentPath(b)))

	return {
		dir,
		study: byName(STUDY_FILE_NAME),
		panel: byName("panel.json"),
		interviews: inSubDir("interviews"),
		discussions: inSubDir("discussions"),
		report: byName("report.html"),
		plan: byName("plan.md"),
		deskResearch: byName("desk-research.md"),
		validation: byName("validation-questionnaire.md"),
		validationCsv: byName("validation-questionnaire.csv"),
		synthesis: byName("synthesis.json"),
		validationResults: byName("validation-results.json"),
		all: files,
	}
}

/** Lists top-level files of a project-level library directory (personas/, panels/, templates/). */
export function listLibraryFiles(
	list: AttachmentItem[],
	dir: string,
	extension = ".json",
): AttachmentItem[] {
	return list
		.filter((item) => {
			if (!isFile(item)) return false
			const path = attachmentPath(item)
			return (
				path.startsWith(dir) &&
				path.toLowerCase().endsWith(extension) &&
				path.split("/").length === 2
			)
		})
		.sort((a, b) => attachmentPath(a).localeCompare(attachmentPath(b)))
}

/** Report templates, the default first, e.g. [templates/voices.html, templates/brand.html]. */
export function listReportTemplates(list: AttachmentItem[]): AttachmentItem[] {
	const isDefault = (item: AttachmentItem) =>
		attachmentPath(item) === DEFAULT_REPORT_TEMPLATE_PATH
	return listLibraryFiles(list, TEMPLATES_DIR, ".html").sort(
		(a, b) => Number(isDefault(b)) - Number(isDefault(a)),
	)
}

/** "templates/brand.html" → "brand". */
export function reportTemplateName(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1).replace(/\.html$/i, "")
}

export function getAttachmentPath(item: AttachmentItem): string {
	return attachmentPath(item)
}

// ---------------------------------------------------------------------------
// Schemas. Required fields are the ones the UI cannot render without; everything else is
// optional so the agent can add detail without breaking the page. Fields added after the
// first release (hypotheses, quota, synthesis …) are all optional: older files lack them.
// ---------------------------------------------------------------------------

const schemaVersion = z.literal(1)
const looseRecord = z.record(z.string(), z.unknown())

/**
 * Keeps the valid items of a list and drops the rest.
 * Example: 4 hypotheses where one lacks "statement" → the page shows the other 3.
 */
function validItems<T>(item: z.ZodType<T>) {
	return z.array(z.unknown()).transform((items) =>
		items.flatMap((value) => {
			const parsed = item.safeParse(value)
			return parsed.success ? [parsed.data] : []
		}),
	)
}

/** Optional list that keeps valid items; a non-array value is treated as absent. */
function lenientArray<T>(item: z.ZodType<T>) {
	return validItems(item).optional().catch(undefined)
}

const verdictSchema = z.enum(["pending", "supported", "refuted", "mixed", "insufficient"])
const agreementSchema = z.enum(["agree", "partial", "disagree"])
const levelSchema = z.enum(["high", "medium", "low"])
const optionalString = z.string().optional().catch(undefined)
const optionalIndex = z.number().int().nonnegative().optional().catch(undefined)

const evidenceRefSchema = z.union([
	z.object({
		kind: z.literal("quote"),
		persona_id: z.string(),
		round_index: optionalIndex,
		text: z.string(),
		file: optionalString,
		prompted: z.boolean().optional().catch(undefined),
	}),
	z.object({
		kind: z.literal("source"),
		ref: z.string(),
		claim: optionalString,
		covers: z.enum(["core", "context"]).optional().catch(undefined),
	}),
])

const quoteRefSchema = z.object({
	persona_id: z.string(),
	source: z.enum(["interview", "discussion"]).optional().catch(undefined),
	file: optionalString,
	round_index: optionalIndex,
	text: z.string(),
	prompted: z.boolean().optional().catch(undefined),
	question: optionalString,
})

const hypothesisSchema = z.object({
	id: z.string().min(1),
	statement: z.string().min(1),
	support_criteria: optionalString,
	refute_criteria: optionalString,
	verdict: verdictSchema.catch("pending"),
	verdict_reason: optionalString,
	evidence_refs: lenientArray(evidenceRefSchema),
	validation: z
		.object({ verdict: agreementSchema, summary: z.string().optional() })
		.optional()
		.catch(undefined),
})

const studySchema = z.object({
	schema_version: schemaVersion,
	topic_id: z.coerce.string().optional().catch(undefined),
	title: z.string(),
	question: z.string(),
	study_type: z
		.enum([
			"user_research",
			"product_rnd",
			"concept_test",
			"fast_insight",
			"panel_only",
			"persona_build",
		])
		.optional()
		.catch(undefined),
	framework: z.array(z.string()).optional().catch(undefined),
	phase: z.enum([...STUDY_PHASE_KEYS, "done"]),
	phases: z.array(
		z.object({
			key: z.enum(STUDY_PHASE_KEYS),
			status: z.enum(["done", "running", "pending", "skipped", "failed"]),
		}),
	),
	limits: z
		.object({ personas: z.number().optional(), interview_rounds: z.number().optional() })
		.optional()
		.catch(undefined),
	outputs: z
		.object({
			plan: z.string().optional(),
			report: z.string().optional(),
			validation: z.string().optional(),
		})
		.optional()
		.catch(undefined),
	decision: optionalString,
	hypotheses: lenientArray(hypothesisSchema),
	quota: lenientArray(
		z.object({
			segment: z.string(),
			criteria: optionalString,
			count: z.number().int().nonnegative(),
		}),
	),
	guide_review: z
		.object({
			items: validItems(
				z.object({
					issue: z.enum([
						"leading",
						"double_barreled",
						"hypothesis_reveal",
						"jargon",
						"sequence_priming",
					]),
					before: z.string(),
					after: z.string(),
				}),
			).catch([]),
		})
		.optional()
		.catch(undefined),
	validated_count: z.number().int().nonnegative().optional().catch(undefined),
	social_sampling: z
		.object({
			status: z.enum(["sampled", "unavailable", "not_relevant"]).catch("unavailable"),
			platforms: z.array(z.string()).catch([]),
			posts: z.number().int().nonnegative().catch(0),
			comments: z.number().int().nonnegative().catch(0),
			note: optionalString,
		})
		.optional()
		.catch(undefined),
})

const personaSchema = z.object({
	schema_version: schemaVersion,
	id: z.string().min(1),
	name: z.string().min(1),
	portrait: z
		.object({ file: z.string().min(1), file_id: optionalString, updated_at: z.string() })
		.optional()
		.catch(undefined),
	tagline: optionalString,
	tags: z.array(z.string()).optional().catch(undefined),
	tier: z.enum(["generated", "evidence_based", "imported", "manual"]).catch("generated"),
	dimensions: z
		.object({
			demographics: looseRecord.optional(),
			geography: looseRecord.optional(),
			psychographics: looseRecord.optional(),
			behavior: looseRecord.optional(),
			needs_pains: z.array(z.unknown()).optional(),
			tech_adoption: z.string().optional(),
			social: z.string().optional(),
		})
		.optional()
		.catch(undefined),
	layers: z
		.object({
			expression: z.array(z.unknown()).optional(),
			story: z.string().optional(),
			cognition: z
				.object({
					// New files rank factors qualitatively; early files used a numeric map.
					decision_weights: z
						.union([
							z.array(z.object({ factor: z.string(), level: levelSchema })),
							looseRecord,
						])
						.optional()
						.catch(undefined),
				})
				.optional(),
			behavior: z.array(z.unknown()).optional(),
		})
		.optional()
		.catch(undefined),
	evidence: z
		.array(
			z.object({
				id: z.string(),
				type: z.enum(["web", "social", "upload", "interview"]).catch("web"),
				platform: z.string().optional(),
				title: z.string().optional(),
				url: z.string().optional(),
				file: z.string().optional(),
				quote: z.string().optional(),
			}),
		)
		.optional()
		.catch(undefined),
	field_sources: z
		.record(
			z.string(),
			z.union([z.array(z.string()), z.literal("inferred"), z.literal("user")]),
		)
		.optional()
		.catch(undefined),
	consistency_notes: z.array(z.string()).optional().catch(undefined),
	created_in: optionalString,
	updated_at: optionalString,
	edited_at: optionalString,
})

const panelSchema = z.object({
	schema_version: schemaVersion,
	id: z.string().min(1),
	name: z.string().min(1),
	persona_ids: z.array(z.string()),
	criteria: optionalString,
	selection: lenientArray(
		z.object({
			persona_id: z.string(),
			reason: optionalString,
			reused: z.boolean().optional().catch(undefined),
			segment: optionalString,
		}),
	),
})

const transcriptBase = {
	insights_outdated: z.boolean().optional(),
	schema_version: schemaVersion,
	status: z.enum(["done", "running", "failed"]).catch("running"),
	error: optionalString,
	rounds: z.array(
		z.object({
			role: z.string().optional(),
			speaker: z.string().optional(),
			text: z.string(),
			request_id: z.string().optional(),
			source: z.literal("user").optional().catch(undefined),
		}),
	),
	summary: optionalString,
	key_findings: z.array(z.string()).optional().catch(undefined),
	quotes: z
		.array(z.object({ text: z.string(), theme: z.string().optional() }))
		.optional()
		.catch(undefined),
	quality: z
		.object({
			concrete_stories: z.number().nonnegative().optional().catch(undefined),
			inferred_ratio: z.number().min(0).max(1).optional().catch(undefined),
			agreement_flags: z.number().nonnegative().optional().catch(undefined),
			notes: optionalString,
		})
		.optional()
		.catch(undefined),
}

const interviewSchema = z.object({ ...transcriptBase, persona_id: z.string().min(1) })
const discussionSchema = z.object({
	...transcriptBase,
	id: optionalString,
	participants: z.array(z.string()),
	topic: optionalString,
})

const synthesisSchema = z.object({
	schema_version: schemaVersion,
	segments: validItems(
		z.object({ id: z.string(), name: z.string(), persona_ids: z.array(z.string()) }),
	).catch([]),
	themes: validItems(
		z.object({
			id: z.string(),
			name: z.string(),
			description: optionalString,
			stance_by_persona: z
				.record(
					z.string(),
					z.enum(["support", "oppose", "mixed", "not_mentioned"]).catch("not_mentioned"),
				)
				.catch({}),
			quote_refs: lenientArray(quoteRefSchema),
			source_refs: z.array(z.string()).optional().catch(undefined),
			hypothesis_ids: z.array(z.string()).optional().catch(undefined),
			confidence: z.enum(["high", "medium", "low", "to_validate"]).catch("to_validate"),
			confidence_reason: optionalString,
		}),
	),
	dimensions: lenientArray(
		z.object({
			id: z.string(),
			name: z.string(),
			level_by_segment: z.record(z.string(), levelSchema.catch("low")),
			quote_refs: lenientArray(quoteRefSchema),
		}),
	),
	saturation: z
		.object({
			new_themes_per_interview: z.array(z.number().nonnegative()),
			saturated: z.boolean(),
		})
		.optional()
		.catch(undefined),
	homogeneity: z
		.object({
			unanimous_theme_ids: z.array(z.string()).catch([]),
			warning: z.boolean().catch(false),
		})
		.optional()
		.catch(undefined),
})

const validationResultsSchema = z.object({
	schema_version: schemaVersion,
	respondent_count: z.number().int().nonnegative(),
	source_files: z.array(z.string()).optional().catch(undefined),
	by_hypothesis: validItems(
		z.object({
			hypothesis_id: z.string(),
			ai_verdict: verdictSchema.optional().catch(undefined),
			human_verdict: verdictSchema.optional().catch(undefined),
			agreement: agreementSchema,
			summary: optionalString,
			human_quotes: z.array(z.string()).optional().catch(undefined),
		}),
	),
	by_question: lenientArray(
		z.object({
			question_id: z.string(),
			hypothesis_id: optionalString,
			ai_summary: optionalString,
			human_summary: optionalString,
			agreement: agreementSchema,
		}),
	),
	summary: optionalString,
})

function parseWith<T>(schema: z.ZodType<T>, raw: unknown): ParsedResearchFile<T> {
	let value: unknown = raw
	if (typeof raw === "string") {
		try {
			value = JSON.parse(raw)
		} catch {
			return { ok: false, reason: "invalid_json" }
		}
	}
	const result = schema.safeParse(value)
	if (!result.success) return { ok: false, reason: "schema_mismatch" }
	return { ok: true, data: result.data }
}

export const parseStudyFile = (raw: unknown) =>
	parseWith(studySchema, raw) as ParsedResearchFile<StudyFile>
export const parsePersonaFile = (raw: unknown) =>
	parseWith(personaSchema, raw) as ParsedResearchFile<PersonaFile>
export const parsePanelFile = (raw: unknown) =>
	parseWith(panelSchema, raw) as ParsedResearchFile<PanelFile>
export const parseInterviewFile = (raw: unknown) =>
	parseWith(interviewSchema, raw) as ParsedResearchFile<InterviewFile>
export const parseDiscussionFile = (raw: unknown) =>
	parseWith(discussionSchema, raw) as ParsedResearchFile<DiscussionFile>
export const parseSynthesisFile = (raw: unknown) =>
	parseWith(synthesisSchema, raw) as ParsedResearchFile<SynthesisFile>
export const parseValidationResultsFile = (raw: unknown) =>
	parseWith(validationResultsSchema, raw) as ParsedResearchFile<ValidationResultsFile>

/** Status for each stepper slot, falling back to "pending" for phases the agent has not written. */
export function resolvePhaseStatuses(study: StudyFile | null) {
	return STUDY_PHASE_KEYS.map((key) => ({
		key,
		status: study?.phases.find((phase) => phase.key === key)?.status ?? "pending",
	}))
}
