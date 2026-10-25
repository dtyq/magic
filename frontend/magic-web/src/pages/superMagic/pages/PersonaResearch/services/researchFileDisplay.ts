import type { ReactNode } from "react"
import type {
	ProjectFileDisplay,
	ProjectFileDisplayResolver,
} from "@/components/business/MentionPanel/types"
import {
	DEFAULT_REPORT_TEMPLATE_PATH,
	PANELS_DIR,
	PERSONAS_DIR,
	STUDIES_DIR,
	TEMPLATES_DIR,
	reportTemplateName,
} from "./researchFiles"
import { TEMPLATE_CHATS_DIR } from "./templateChats"

export interface ResearchFileDisplayLabels {
	personas: string
	panels: string
	studies: string
	templates: string
	defaultTemplate: string
	interviews: string
	discussions: string
	/** Names of the study files, same wording as the workspace tabs. */
	study: { report: string; plan: string; deskResearch: string; validation: string; panel: string }
}

/**
 * Names read from content the page has already parsed (no extra requests). Both take the real
 * workspace path without a leading slash and return undefined while the file is not parsed yet,
 * in which case the row keeps its file name.
 */
export interface ResearchFileDisplayLookups {
	/** personas/<id>.json → the persona's name. */
	personaName?: (path: string) => string | undefined
	/** studies/<slug>/interviews/<id>.json → e.g. "王浩 · 访谈记录". */
	interviewLabel?: (path: string) => string | undefined
	/** studies/<slug> → the study's title. */
	studyTitle?: (path: string) => string | undefined
}

export interface ResearchFileDisplayIcons {
	/** Top-level folders. */
	personas?: ReactNode
	panels?: ReactNode
	studies?: ReactNode
	templates?: ReactNode
	/** studies/<slug>/ and its interviews/ · discussions/ folders. */
	study?: ReactNode
	interviews?: ReactNode
	discussions?: ReactNode
	/** Single files: a persona, an interview, a report template. */
	persona?: ReactNode
	interview?: ReactNode
	template?: ReactNode
	/** Named study files, keyed like ResearchFileDisplayLabels["study"]. */
	studyFiles?: Partial<Record<keyof ResearchFileDisplayLabels["study"], ReactNode>>
}

/** Study files with a readable name, keyed by their name inside studies/<slug>/. */
function studyFileKey(name: string): keyof ResearchFileDisplayLabels["study"] | undefined {
	const byName: Record<string, keyof ResearchFileDisplayLabels["study"]> = {
		"report.html": "report",
		"plan.md": "plan",
		"desk-research.md": "deskResearch",
		"validation-questionnaire.md": "validation",
		"panel.json": "panel",
	}
	return byName[name]
}

/**
 * Readable names for the research project's own folders and files in the @ panel's
 * "Current project files". Display only: the resolver never sees ids and cannot change a path,
 * so what a mention inserts still points at the real file.
 *
 * | Real path                          | Shown as                     |
 * | personas/ · panels/ · studies/     | 人设 · 人设分组 · 研究          |
 * | templates/ · templates/<name>.html | 报告模板 · 模板名 (voices → 人声（默认）) |
 * | template-chats/ (and below)        | hidden: internal conversation markers |
 * | studies/<slug>/                    | the study title (lookup, once known) |
 * | studies/<slug>/report.html …       | 研究报告 / 研究方案 / 市场洞察 / 验证问卷 / 受访者名单 |
 * | studies/<slug>/interviews/ · discussions/ | 访谈记录 · 小组讨论 |
 *
 * | personas/<id>.json · studies/<slug>/interviews/<id>.json | persona name · "name · 访谈记录" (lookups, once parsed) |
 *
 * Everything else (study slugs, unknown folders, unparsed files) keeps its real name.
 */
export function createResearchFileDisplayResolver(
	labels: ResearchFileDisplayLabels,
	icons: ResearchFileDisplayIcons = {},
	lookups: ResearchFileDisplayLookups = {},
): ProjectFileDisplayResolver {
	return ({ path, name, isDirectory }): ProjectFileDisplay | null => {
		const normalized = path.replace(/\/+$/, "")
		const segments = normalized.split("/")

		if (`${segments[0]}/` === TEMPLATE_CHATS_DIR) return { hidden: true }

		if (isDirectory) {
			if (segments.length === 1) {
				const top: Record<string, [string, ReactNode | undefined]> = {
					[PERSONAS_DIR]: [labels.personas, icons.personas],
					[PANELS_DIR]: [labels.panels, icons.panels],
					[STUDIES_DIR]: [labels.studies, icons.studies],
					[TEMPLATES_DIR]: [labels.templates, icons.templates],
				}
				const match = top[`${normalized}/`]
				return match ? { name: match[0], icon: match[1] } : null
			}
			if (`${segments[0]}/` === STUDIES_DIR && segments.length === 2) {
				const title = lookups.studyTitle?.(normalized)
				return title ? { name: title, icon: icons.study } : null
			}
			if (`${segments[0]}/` === STUDIES_DIR && segments.length === 3) {
				if (name === "interviews")
					return { name: labels.interviews, icon: icons.interviews }
				if (name === "discussions")
					return { name: labels.discussions, icon: icons.discussions }
			}
			return null
		}

		if (`${segments[0]}/` === PERSONAS_DIR && segments.length === 2) {
			const personaName = lookups.personaName?.(normalized)
			return personaName ? { name: personaName, icon: icons.persona } : null
		}

		if (
			`${segments[0]}/` === STUDIES_DIR &&
			segments.length === 4 &&
			segments[2] === "interviews"
		) {
			const label = lookups.interviewLabel?.(normalized)
			return label ? { name: label, icon: icons.interview } : null
		}

		if (`${segments[0]}/` === TEMPLATES_DIR && segments.length === 2) {
			if (!normalized.toLowerCase().endsWith(".html")) return null
			return {
				name:
					normalized === DEFAULT_REPORT_TEMPLATE_PATH
						? labels.defaultTemplate
						: reportTemplateName(normalized),
				icon: icons.template,
			}
		}

		if (`${segments[0]}/` === STUDIES_DIR && segments.length === 3) {
			const key = studyFileKey(name)
			return key ? { name: labels.study[key], icon: icons.studyFiles?.[key] } : null
		}

		return null
	}
}
