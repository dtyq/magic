import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { PERSONAS_DIR, getAttachmentPath, type StudyAttachments } from "./researchFiles"

const PERSON_PORTRAITS_DIR = `${PERSONAS_DIR}portraits/`

/** Readable study documents, in reading order. */
export type StudyDocumentKey = "plan" | "deskResearch"

/** One assistant message's attachments, grouped by their role in the study. */
export interface StudyDeliverables {
	report: AttachmentItem | null
	/** Validation questionnaire; `validationCsv` is the same questionnaire for survey tools. */
	validation: AttachmentItem | null
	validationCsv: AttachmentItem | null
	documents: { key: StudyDocumentKey; file: AttachmentItem }[]
	/** Structured files are summarized as counts and open their own output tab. */
	interviews: number
	discussions: number
	hasPanel: boolean
	hasSynthesis: boolean
	hasValidationResults: boolean
	/** Persona library files, rendered as people instead of file names. */
	personas: AttachmentItem[]
	/** Files in the message that are not part of the study contract (user files, images). */
	others: AttachmentItem[]
}

/**
 * Id of a persona library file, e.g. "personas/p_chen_1a2b.json" → "p_chen_1a2b"; null for any
 * other file. Library personas are shown as people, not as file names.
 */
export function personaIdOfFile(file: AttachmentItem): string | null {
	const path = getAttachmentPath(file).replace(/^\//, "")
	if (!path.startsWith(PERSONAS_DIR) || !path.endsWith(".json")) return null
	const name = path.slice(PERSONAS_DIR.length, -".json".length)
	return name && !name.includes("/") ? name : null
}

const sameFile = (a: AttachmentItem, b: AttachmentItem | null | undefined) => {
	if (!b) return false
	if (a.file_id && b.file_id) return String(a.file_id) === String(b.file_id)
	return getAttachmentPath(a) !== "" && getAttachmentPath(a) === getAttachmentPath(b)
}

/**
 * Groups a message's attachments by the study they belong to.
 * Returns null when none of them is a study file, so the message keeps the default list.
 *
 * Example: [report.html, plan.md, interviews/p1.json, interviews/p2.json, notes.png]
 * → report, documents [plan], interviews 2, others [notes.png].
 */
export function classifyStudyDeliverables(
	files: AttachmentItem[],
	study: StudyAttachments | null,
	projectFileById?: ReadonlyMap<string, AttachmentItem>,
): StudyDeliverables | null {
	if (!study) return null
	const result: StudyDeliverables = {
		report: null,
		validation: null,
		validationCsv: null,
		documents: [],
		interviews: 0,
		discussions: 0,
		hasPanel: false,
		hasSynthesis: false,
		hasValidationResults: false,
		personas: [],
		others: [],
	}
	files.forEach((messageFile) => {
		// A message attachment carries only `filename` and `file_key`, no project path. Resolve it to
		// the project's own record by file id, so persona files and portraits are told apart by path
		// and the row keeps a readable name. Unknown ids keep the message record.
		const file = projectFileById?.get(String(messageFile.file_id)) ?? messageFile
		const is = (candidate: AttachmentItem | null) => sameFile(file, candidate)
		if (is(study.report)) result.report = file
		else if (is(study.validation)) result.validation = file
		else if (is(study.validationCsv)) result.validationCsv = file
		else if (is(study.plan)) result.documents.push({ key: "plan", file })
		else if (is(study.deskResearch)) result.documents.push({ key: "deskResearch", file })
		else if (study.interviews.some(is)) result.interviews += 1
		else if (study.discussions.some(is)) result.discussions += 1
		else if (is(study.panel)) result.hasPanel = true
		else if (is(study.synthesis)) result.hasSynthesis = true
		else if (is(study.validationResults)) result.hasValidationResults = true
		// study.json is the page's own state file; it has nothing to read on its own.
		else if (is(study.study)) return
		// Avatar images bound to personas are shown on the persona cards, not as separate files.
		else if (getAttachmentPath(file).replace(/^\//, "").startsWith(PERSON_PORTRAITS_DIR)) return
		else if (personaIdOfFile(file)) result.personas.push(file)
		else result.others.push(file)
	})

	const hasStudyContent =
		result.report ||
		result.validation ||
		result.validationCsv ||
		result.documents.length ||
		result.interviews ||
		result.discussions ||
		result.hasPanel ||
		result.hasSynthesis ||
		result.hasValidationResults ||
		result.personas.length
	// Only study.json or no study file at all: nothing study-specific to present.
	if (!hasStudyContent) return null
	// Plan before desk research, whatever order the agent attached them in.
	result.documents.sort((a, b) => Number(b.key === "plan") - Number(a.key === "plan"))
	return result
}
