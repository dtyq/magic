import type { ResearchConsoleTab } from "../components/ResearchConsole"
import { STUDY_FILE_NAME } from "./researchFiles"

/** How much each results tab holds; the studio counts these from the study's loaded files. */
export type StudyOutputCounts = Record<ResearchConsoleTab, number>

/**
 * Tabs in the order a study usually fills them, so the panel opens on what appeared first:
 * hypotheses after the plan, then personas, interviews and so on.
 */
const FIRST_OUTPUT_ORDER: ResearchConsoleTab[] = [
	"hypotheses",
	"personas",
	"interviews",
	"discussions",
	"analysis",
	"report",
	"validation",
	"files",
]

/** True once any tab has something to show; before that the results panel stays hidden. */
export function hasStudyOutputs(counts: StudyOutputCounts): boolean {
	return FIRST_OUTPUT_ORDER.some((tab) => counts[tab] > 0)
}

/** The first tab with content, or null while the study has none. */
export function firstOutputTab(counts: StudyOutputCounts): ResearchConsoleTab | null {
	return FIRST_OUTPUT_ORDER.find((tab) => counts[tab] > 0) ?? null
}

/**
 * Study-directory files that count as outputs: everything except study.json, which exists
 * from the first message, and hidden files.
 */
export function countVisibleStudyFiles(paths: string[]): number {
	return paths.filter((path) => {
		const name = path.split("/").pop() ?? ""
		return name !== STUDY_FILE_NAME && !name.startsWith(".")
	}).length
}
