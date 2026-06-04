import dashboardShellIndexCssRaw from "./templates/dashboard/index.css?raw"
import dashboardShellDashboardJsRaw from "./templates/dashboard/dashboard?raw"
import dashboardTemplateIndexHtml from "./templates/dashboard/index.html?raw"
import audioTemplateIndexHtml from "./templates/audio/index.html?raw"
import videoTemplateIndexHtml from "./templates/video/index.html?raw"

/** 详情页可视化预览使用构建内 templates 的场景 */
export type HtmlPreviewBundledTemplateKind = "dashboard" | "audio" | "video"

interface TemplateEntryRule {
	path: string
}

type TemplateEntryRuleMap = Record<HtmlPreviewBundledTemplateKind, TemplateEntryRule[]>

export interface ResolveHtmlPreviewBundledTemplateInput {
	fileName?: string
	relativeFilePath?: string
	displayConfigType?: string
	templateEntryRuleMap?: Partial<TemplateEntryRuleMap>
}

export const DEFAULT_TEMPLATE_ENTRY_RULE_MAP: TemplateEntryRuleMap = {
	dashboard: [{ path: "index.html" }],
	audio: [{ path: "index.html" }],
	video: [{ path: "index.html" }],
}

const DASHBOARD_TEMPLATE_SHELL_REFERENCE_PATHS = new Set(["index.css", "dashboard.js"])

function normalizePath(path?: string): string {
	if (!path) return ""
	return path.split(/[?#]/)[0].replace(/^\.\//, "").replace(/^\//, "").replace(/\\/g, "/")
}

function getFileName(path?: string): string {
	const normalizedPath = normalizePath(path)
	if (!normalizedPath) return ""
	const segments = normalizedPath.split("/").filter(Boolean)
	return segments[segments.length - 1] || ""
}

function matchesTemplateEntryRule(path: string, rule: TemplateEntryRule): boolean {
	const normalizedPath = normalizePath(path)
	const normalizedRulePath = normalizePath(rule.path)

	if (!normalizedPath || !normalizedRulePath) return false
	if (!normalizedRulePath.includes("/")) {
		return getFileName(normalizedPath) === normalizedRulePath
	}
	return normalizedPath === normalizedRulePath
}

function mergeTemplateEntryRuleMap(
	overrides?: Partial<TemplateEntryRuleMap>,
): TemplateEntryRuleMap {
	return {
		dashboard: overrides?.dashboard || DEFAULT_TEMPLATE_ENTRY_RULE_MAP.dashboard,
		audio: overrides?.audio || DEFAULT_TEMPLATE_ENTRY_RULE_MAP.audio,
		video: overrides?.video || DEFAULT_TEMPLATE_ENTRY_RULE_MAP.video,
	}
}

function resolveCandidateTemplateKind({
	displayConfigType,
}: Pick<ResolveHtmlPreviewBundledTemplateInput, "displayConfigType">):
	| HtmlPreviewBundledTemplateKind
	| undefined {
	if (displayConfigType === "dashboard") return "dashboard"
	if (displayConfigType === "audio") return "audio"
	if (displayConfigType === "video") return "video"
	return undefined
}

export function resolveHtmlPreviewBundledTemplate({
	fileName,
	relativeFilePath,
	displayConfigType,
	templateEntryRuleMap,
}: ResolveHtmlPreviewBundledTemplateInput): HtmlPreviewBundledTemplateKind | undefined {
	const candidateKind = resolveCandidateTemplateKind({
		displayConfigType,
	})

	if (!candidateKind) return undefined

	const normalizedPath = normalizePath(relativeFilePath || fileName)
	if (!normalizedPath) return undefined

	const ruleMap = mergeTemplateEntryRuleMap(templateEntryRuleMap)
	const entryRules = ruleMap[candidateKind]

	if (!entryRules.some((rule) => matchesTemplateEntryRule(normalizedPath, rule))) {
		return undefined
	}

	return candidateKind
}

/** 与当前发版一致的 dashboard 入口 HTML（仅预览壳替换用） */
export function getDashboardBundledTemplateHtml(): string {
	return String(dashboardTemplateIndexHtml)
}

/** 与当前发版一致的 audio 场景入口 HTML（仅预览壳替换用） */
export function getAudioBundledTemplateHtml(): string {
	return String(audioTemplateIndexHtml)
}

/** 与当前发版一致的 video 场景入口 HTML（仅预览壳替换用） */
export function getVideoBundledTemplateHtml(): string {
	return String(videoTemplateIndexHtml)
}

export function getBundledTemplateHtmlByKind(kind: HtmlPreviewBundledTemplateKind): string {
	if (kind === "dashboard") return getDashboardBundledTemplateHtml()
	if (kind === "audio") return getAudioBundledTemplateHtml()
	return getVideoBundledTemplateHtml()
}

/** 与模板约定一致：仅根目录下的 ./index.css、./dashboard.js，避免误伤子路径同名文件 */
export function isDashboardTemplateShellReferencePath(relativeAttrPath: string): boolean {
	return DASHBOARD_TEMPLATE_SHELL_REFERENCE_PATHS.has(normalizePath(relativeAttrPath))
}

interface UrlMapShellEntry {
	path?: string
	attr?: string
	tag?: string
}

/**
 * 预览走打包模板壳时，不再为 index.css / dashboard.js 请求 OSS
 */
export function omitDashboardShellFromFetchPlan(
	fileIdsToFetch: string[],
	urlMap: Map<string, unknown>,
): string[] {
	const idsToRemove = new Set<string>()
	for (const [fid, raw] of Array.from(urlMap.entries())) {
		const info = raw as UrlMapShellEntry
		if (!info.path || !isDashboardTemplateShellReferencePath(info.path)) continue
		const base = normalizePath(info.path)
		if (base === "index.css" && info.attr === "href") idsToRemove.add(fid)
		else if (base === "dashboard.js" && info.attr === "src" && info.tag === "script")
			idsToRemove.add(fid)
	}
	for (const fid of Array.from(idsToRemove)) urlMap.delete(fid)
	return fileIdsToFetch.filter((id) => !idsToRemove.has(id))
}

/**
 * 将 HTML 中的模板壳引用替换为当前构建产物的绝对 URL（供 iframe 加载）
 */
export function applyDashboardBundledShellToHtml(html: string): string {
	const inlineCss = String(dashboardShellIndexCssRaw || "")
	const inlineJs = String(dashboardShellDashboardJsRaw || "")
	const safeInlineJs = inlineJs.replace(/<\/script/gi, "<\\/script")
	let out = html
	out = out.replace(/<link\b[^>]*href=(["'])(\.\/)?index\.css\1[^>]*>/gi, (full) => {
		if (!/\brel\s*=\s*["']stylesheet["']/i.test(full)) return full
		return `<style data-injected="true" data-shell="dashboard-index-css">\n${inlineCss}\n</style>`
	})
	out = out.replace(
		/<script\b([^>]*?)src=(["'])(\.\/)?dashboard\.js\2([^>]*)>\s*<\/script>/gi,
		(_, beforeAttrs: string, __: string, ___: string, afterAttrs: string) => {
			return `<script${beforeAttrs}${afterAttrs} data-injected="true" data-shell="dashboard-runtime">\n${safeInlineJs}\n</script>`
		},
	)
	return out
}
