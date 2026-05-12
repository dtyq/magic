import dashboardShellIndexCssRaw from "./templates/dashboard/index.css?raw"
import dashboardShellDashboardJsRaw from "./templates/dashboard/dashboard?raw"
import dashboardTemplateIndexHtml from "./templates/dashboard/index.html?raw"
import audioTemplateIndexHtml from "./templates/audio/index.html?raw"
import videoTemplateIndexHtml from "./templates/video/index.html?raw"

/** 详情页可视化预览使用构建内 templates 的场景 */
export type HtmlPreviewBundledTemplateKind = "dashboard" | "audio" | "video"

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
	const normalized = relativeAttrPath.replace(/^\.\//, "").split("?")[0]
	return normalized === "index.css" || normalized === "dashboard.js"
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
		const base = info.path.replace(/^\.\//, "").split("?")[0]
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
