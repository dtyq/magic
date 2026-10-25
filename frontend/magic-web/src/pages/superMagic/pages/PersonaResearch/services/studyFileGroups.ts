import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { getAttachmentPath, type StudyAttachments } from "./researchFiles"

export type StudyFileGroupKey = "deliverables" | "process" | "data"

/** How the files tab names a contract file, e.g. "report" → 研究报告. */
export type StudyFileRole =
	| "report"
	| "validation"
	| "validationCsv"
	| "plan"
	| "deskResearch"
	| "study"
	| "panel"
	| "synthesis"
	| "validationResults"
	| "interview"
	| "discussion"
	| "persona"
	| "other"

export interface StudyFileEntry {
	file: AttachmentItem
	role: StudyFileRole
	/** Persona id for interview and persona files, so the list can show the persona's name. */
	personaId?: string
}

export interface StudyFileGroup {
	key: StudyFileGroupKey
	entries: StudyFileEntry[]
}

const sameFile = (a: AttachmentItem, b: AttachmentItem | null | undefined) =>
	Boolean(b) && String(a.file_id) === String(b?.file_id)

const extensionOf = (file: AttachmentItem) =>
	getAttachmentPath(file).split(".").pop()?.toLowerCase() ?? ""

const baseNameOf = (file: AttachmentItem) =>
	(getAttachmentPath(file).split("/").pop() ?? "").replace(/\.[^.]+$/, "")

/**
 * Every file of one study, grouped for the files tab: what the user hands on (report,
 * questionnaire and any other document the agent produced), how the study got there (plan,
 * desk research, notes) and the structured data behind the views (study state, transcripts,
 * personas). Files the agent added outside the contract land in deliverables or process by type.
 *
 * Example: studies/x/{report.html, plan.md, notes.md, deck.pptx, interviews/p1.json}
 * → deliverables [report, deck], process [plan, notes], data [p1 transcript].
 */
export function groupStudyFiles(
	study: StudyAttachments,
	personaFiles: AttachmentItem[],
): StudyFileGroup[] {
	const deliverables: StudyFileEntry[] = []
	const process: StudyFileEntry[] = []
	const data: StudyFileEntry[] = []

	const fixed: Array<[AttachmentItem | null, StudyFileRole, StudyFileEntry[]]> = [
		[study.report, "report", deliverables],
		[study.validation, "validation", deliverables],
		[study.validationCsv, "validationCsv", deliverables],
		[study.plan, "plan", process],
		[study.deskResearch, "deskResearch", process],
		[study.study, "study", data],
		[study.panel, "panel", data],
		[study.synthesis, "synthesis", data],
		[study.validationResults, "validationResults", data],
	]
	for (const [file, role, group] of fixed) if (file) group.push({ file, role })
	for (const file of study.interviews)
		data.push({ file, role: "interview", personaId: baseNameOf(file) })
	for (const file of study.discussions) data.push({ file, role: "discussion" })

	const known = (file: AttachmentItem) =>
		fixed.some(([item]) => sameFile(file, item)) ||
		study.interviews.some((item) => sameFile(file, item)) ||
		study.discussions.some((item) => sameFile(file, item))
	const extras = study.all
		.filter((file) => !known(file))
		.sort((a, b) => getAttachmentPath(a).localeCompare(getAttachmentPath(b)))
	for (const file of extras) {
		const extension = extensionOf(file)
		if (extension === "json") data.push({ file, role: "other" })
		else if (extension === "md" || extension === "txt") process.push({ file, role: "other" })
		else deliverables.push({ file, role: "other" })
	}
	for (const file of personaFiles)
		data.push({ file, role: "persona", personaId: baseNameOf(file) })

	return [
		{ key: "deliverables", entries: deliverables },
		{ key: "process", entries: process },
		{ key: "data", entries: data },
	].filter((group): group is StudyFileGroup => group.entries.length > 0)
}
