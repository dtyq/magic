import { normalizeResearchPath, PERSONAS_DIR } from "./researchFiles"

/**
 * Where a research file belongs. Contract files have their own UI, so opening one as raw JSON in
 * the generic preview is never what the user wants; everything else keeps the readable preview.
 */
export type ResearchFileTarget =
	| { kind: "persona"; personaId: string }
	| { kind: "interview"; personaId: string }
	| { kind: "tab"; tab: "discussions" | "analysis" | "validation" }
	| { kind: "preview" }

const PREVIEW: ResearchFileTarget = { kind: "preview" }

/**
 * Routes a workspace path to its research UI.
 *
 * Study files live under "studies/<dir>/", but links in a report may be relative to it, so the
 * study-level files are matched by their trailing segments rather than the full path.
 *
 * Example: "studies/a-1/interviews/p_chen_1a2b.json" → interview of "p_chen_1a2b";
 * "personas/p_chen_1a2b.json" → persona dialog; "plan.md" → generic preview.
 */
export function routeResearchFile(path: string | undefined | null): ResearchFileTarget {
	const normalized = normalizeResearchPath(path).split(/[?#]/)[0]
	if (!normalized.toLowerCase().endsWith(".json")) return PREVIEW

	// Library personas sit directly in personas/; nested paths are not persona files.
	if (normalized.startsWith(PERSONAS_DIR)) {
		const name = normalized.slice(PERSONAS_DIR.length, -".json".length)
		return name && !name.includes("/") ? { kind: "persona", personaId: name } : PREVIEW
	}

	const segments = normalized.split("/")
	const fileName = segments[segments.length - 1]
	const parent = segments[segments.length - 2]

	if (parent === "interviews") {
		const personaId = fileName.slice(0, -".json".length)
		return personaId ? { kind: "interview", personaId } : PREVIEW
	}
	if (parent === "discussions") return { kind: "tab", tab: "discussions" }
	if (fileName === "synthesis.json") return { kind: "tab", tab: "analysis" }
	if (fileName === "validation-results.json") return { kind: "tab", tab: "validation" }
	return PREVIEW
}
