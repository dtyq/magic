import type { ReactNode } from "react"
import {
	MentionItemType,
	type MentionItem,
	type MentionSceneCatalog,
	type ProjectFileMentionData,
} from "@/components/business/MentionPanel/types"
import { normalizeProjectReferencePath } from "@/components/business/MentionPanel/utils/projectReferenceMention"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { PersonaFile } from "../types"
import { getAttachmentPath, type StudyAttachments } from "./researchFiles"

export interface ResearchMentionCatalogLabels {
	study: string
	personas: string
	outputs: string
	interviews: string
	/** Readable names of the study outputs; the file name becomes the subtitle. */
	outputNames: { report: string; plan: string; validation: string; deskResearch: string }
	/** Transcript label for one persona, e.g. "王浩 · 访谈记录". */
	interviewOf: (personaName: string) => string
}

export interface ResearchMentionCatalogInput {
	study: StudyAttachments
	projectId?: string
	/** Panel personas in panel order, each with its personas/<id>.json attachment. */
	personas: Array<{ persona: PersonaFile; file: AttachmentItem }>
	/** persona_id of each interviews/<id>.json, keyed by file id; missing until parsed. */
	interviewPersonaIdByFileId: Map<string, string>
	personaNameById: (personaId: string) => string | undefined
	labels: ResearchMentionCatalogLabels
	icon?: ReactNode
	renderPersonaIcon: (persona: PersonaFile) => ReactNode
}

/**
 * A study file as a project_file mention, so the backend file handler reads it as usual.
 * file_name is the chip label and the link text the model sees ("[王浩](personas/p-01.json)");
 * file_id and file_path keep the real identity.
 */
function toFileMention(
	file: AttachmentItem,
	options: { label?: string; description?: string; icon?: ReactNode; projectId?: string },
): MentionItem | null {
	const fileId = file.file_id ? String(file.file_id) : ""
	if (!fileId) return null
	const realName = fileNameOf(file)
	const extension = String(file.file_extension ?? realName.split(".").pop() ?? "")
	const name = options.label || realName
	const path = normalizeProjectReferencePath(file.relative_file_path ?? getAttachmentPath(file))
	const projectId = file.project_id ? String(file.project_id) : options.projectId
	return {
		id: fileId,
		type: MentionItemType.PROJECT_FILE,
		name,
		// Persona rows pass an avatar; files fall back to the extension icon.
		icon: options.icon ?? extension,
		extension,
		description: options.description,
		hasChildren: false,
		isFolder: false,
		path,
		size: typeof file.file_size === "number" ? file.file_size : undefined,
		data: {
			file_id: fileId,
			file_name: name,
			file_path: path,
			file_extension: extension,
			...(projectId ? { project_id: projectId } : {}),
		} as ProjectFileMentionData,
	}
}

function fileNameOf(file: AttachmentItem): string {
	return String(file.file_name ?? file.filename ?? "")
}

function compact(items: Array<MentionItem | null>): MentionItem[] {
	return items.filter((item): item is MentionItem => item !== null)
}

/**
 * "This study" entry of the research composer's @ panel.
 *
 * | Group      | Rows                                                         |
 * | personas   | avatar + persona name, tagline as subtitle                   |
 * | outputs    | 研究报告 / 研究方案 / 验证问卷 / 市场洞察 (existing only), file name as subtitle |
 * | interviews | interviews/<id>.json, labelled with the persona's name, file name as subtitle |
 *
 * Report templates are not here: they live under "Current project files" (templates/), see
 * researchFileDisplay.ts.
 *
 * Empty groups are dropped by the panel; a study without files gives no entry at all.
 */
export function buildResearchMentionCatalog(
	input: ResearchMentionCatalogInput,
): MentionSceneCatalog {
	const { study, projectId, labels } = input
	const personas = compact(
		input.personas.map(({ persona, file }) =>
			toFileMention(file, {
				label: persona.name,
				description: persona.tagline,
				icon: input.renderPersonaIcon(persona),
				projectId,
			}),
		),
	)
	const { outputNames } = labels
	const outputs = compact(
		(
			[
				[study.report, outputNames.report],
				[study.plan, outputNames.plan],
				[study.validation, outputNames.validation],
				[study.deskResearch, outputNames.deskResearch],
			] as const
		).map(([file, label]) =>
			file ? toFileMention(file, { label, description: fileNameOf(file), projectId }) : null,
		),
	)
	// Transcripts follow the persona order above instead of their file names.
	const personaOrder = new Map(input.personas.map(({ persona }, index) => [persona.id, index]))
	const orderOf = (file: AttachmentItem) => {
		const personaId = input.interviewPersonaIdByFileId.get(String(file.file_id ?? ""))
		return personaId === undefined
			? Number.MAX_SAFE_INTEGER
			: (personaOrder.get(personaId) ?? Number.MAX_SAFE_INTEGER)
	}
	const interviews = compact(
		[...study.interviews]
			.sort((a, b) => orderOf(a) - orderOf(b))
			.map((file) => {
				const personaId = input.interviewPersonaIdByFileId.get(String(file.file_id ?? ""))
				const personaName = personaId ? input.personaNameById(personaId) : undefined
				return toFileMention(file, {
					label: personaName ? labels.interviewOf(personaName) : undefined,
					description: personaName ? fileNameOf(file) : undefined,
					projectId,
				})
			}),
	)

	return {
		name: labels.study,
		icon: input.icon,
		groups: [
			{ id: "personas", title: labels.personas, items: personas },
			{ id: "outputs", title: labels.outputs, items: outputs },
			{ id: "interviews", title: labels.interviews, items: interviews },
		],
	}
}
