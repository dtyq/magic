import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { StudyType } from "../types"

export const RESEARCH_METHODS = [
	"auto",
	"user_research",
	"product_rnd",
	"concept_test",
	"fast_insight",
] as const satisfies readonly ("auto" | StudyType)[]
export const PANEL_SIZES = ["auto", 4, 6, 8, 10, 12] as const
// Keep numeric storage for existing saved composer settings and research templates.
// These values select a depth preference, never a required question count.
export const ROUND_COUNTS = ["auto", 5, 12, 20] as const
export function interviewDepth(rounds: number): "quick" | "standard" | "deep" {
	return rounds <= 5 ? "quick" : rounds <= 12 ? "standard" : "deep"
}

/** Bounds for typed-in values; the agent caps a panel at 12 people and automatic interviews at 20 rounds. */
export const PANEL_SIZE_RANGE = { min: 1, max: 12 } as const
export const ROUND_COUNT_RANGE = { min: 1, max: 20 } as const
/** A custom method is one short sentence, e.g. "price sensitivity, Van Westendorp". */
export const CUSTOM_METHOD_MAX_LENGTH = 60

export type ResearchMethod = (typeof RESEARCH_METHODS)[number] | "custom"

export interface ResearchOptions {
	/** A preset study type, or "custom" with the user's own description in `customMethod`. */
	method: ResearchMethod
	customMethod?: string
	/** "auto" or any whole number in PANEL_SIZE_RANGE, not only the presets. */
	panelSize: "auto" | number
	/** Depth preference; legacy numeric settings are mapped to quick / standard / deep. */
	rounds: "auto" | number
}

export const DEFAULT_RESEARCH_OPTIONS: ResearchOptions = {
	method: "auto",
	panelSize: "auto",
	rounds: "auto",
}

/**
 * Fixed prefix of the settings line. The agent's skill reads the line as the user's answers to
 * scale and study type, and the conversation can match it to render a tag; keep it unchanged.
 */
export const RESEARCH_SETTINGS_PREFIX = "【研究设置】"

/**
 * One line appended to the first message, e.g.
 * "【研究设置】访谈人数: 8 · 访谈深度: quick · 研究方式: concept_test ·
 *  指定人设: personas/p_a.json, personas/p_b.json · 报告模板: templates/brand.html".
 * A custom method is sent as "研究方式: 自定义：<description>". Chosen personas are the panel as
 * they are; a fixed panel size smaller than their number is raised to it, never below.
 * Items left on "auto" (or the default report template, null) are omitted; with nothing fixed
 * there is no line. Labels stay in Chinese whatever the UI language, because the skill matches
 * them literally.
 */
export function researchSettingsLine(
	options: ResearchOptions,
	extras: { reportTemplatePath?: string | null; personaPaths?: string[] } = {},
): string | null {
	const { reportTemplatePath = null, personaPaths = [] } = extras
	const panelSize = effectivePanelSize(options.panelSize, personaPaths.length)
	const items = [
		panelSize === "auto" ? null : `访谈人数: ${panelSize}`,
		options.rounds === "auto" ? null : `访谈深度: ${interviewDepth(options.rounds)}`,
		options.method === "auto"
			? null
			: options.method === "custom"
				? `研究方式: 自定义：${options.customMethod}`
				: `研究方式: ${options.method}`,
		personaPaths.length ? `指定人设: ${personaPaths.join(", ")}` : null,
		reportTemplatePath ? `报告模板: ${reportTemplatePath}` : null,
	].filter(Boolean)
	return items.length ? `${RESEARCH_SETTINGS_PREFIX}${items.join(" · ")}` : null
}

/** A fixed panel size never below the number of chosen personas; "auto" stays auto. */
export function effectivePanelSize(
	panelSize: ResearchOptions["panelSize"],
	chosenCount: number,
): ResearchOptions["panelSize"] {
	return panelSize === "auto" ? "auto" : Math.max(panelSize, chosenCount)
}

/** Appends a plain paragraph to an editor document without mutating it. */
export function appendParagraph(value: JSONContent | undefined, text: string): JSONContent {
	const paragraph: JSONContent = { type: "paragraph", content: [{ type: "text", text }] }
	if (!value) return { type: "doc", content: [paragraph] }
	return { ...value, content: [...(value.content ?? []), paragraph] }
}

/** A whole number within the range, else null; used for typed-in and saved values. */
export function parseWholeNumber(
	candidate: unknown,
	range: { min: number; max: number },
): number | null {
	const value = typeof candidate === "string" ? Number(candidate.trim()) : candidate
	if (typeof value !== "number" || !Number.isInteger(value)) return null
	return value >= range.min && value <= range.max ? value : null
}

/** A custom method description trimmed and capped, else null when blank. */
export function normalizeCustomMethod(candidate: unknown): string | null {
	if (typeof candidate !== "string") return null
	const text = candidate.replace(/\s+/g, " ").trim().slice(0, CUSTOM_METHOD_MAX_LENGTH)
	return text || null
}

/** Restores saved settings, dropping values that are no longer allowed. */
export function parseResearchOptions(raw: unknown): ResearchOptions {
	const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
	const customMethod = normalizeCustomMethod(value.customMethod)
	const method: ResearchMethod =
		value.method === "custom"
			? customMethod
				? "custom"
				: "auto"
			: RESEARCH_METHODS.includes(value.method as (typeof RESEARCH_METHODS)[number])
				? (value.method as ResearchMethod)
				: "auto"
	return {
		method,
		...(method === "custom" && customMethod ? { customMethod } : {}),
		panelSize: parseWholeNumber(value.panelSize, PANEL_SIZE_RANGE) ?? "auto",
		rounds: parseWholeNumber(value.rounds, ROUND_COUNT_RANGE) ?? "auto",
	}
}

const REPORT_TEMPLATE_STORAGE_KEY = "persona-research:report-template"

/**
 * The report template picked for new studies, remembered per browser as a convenience only;
 * null means the default. The caller drops a path that no longer exists.
 */
export function readSavedReportTemplate(): string | null {
	try {
		return localStorage.getItem(REPORT_TEMPLATE_STORAGE_KEY) || null
	} catch {
		return null
	}
}

export function saveReportTemplateChoice(path: string | null) {
	try {
		if (path) localStorage.setItem(REPORT_TEMPLATE_STORAGE_KEY, path)
		else localStorage.removeItem(REPORT_TEMPLATE_STORAGE_KEY)
	} catch {
		// Storage can be unavailable (private mode); the choice still applies to this page.
	}
}
