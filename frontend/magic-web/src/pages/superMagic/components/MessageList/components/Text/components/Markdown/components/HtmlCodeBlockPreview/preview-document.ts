import { normalizeHtmlFenceBodyCode } from "./shared"

const DOC_TYPE_PATTERN = /<!DOCTYPE[^>]*>/gi
const HTML_SHELL_TAG_PATTERN = /<\/?(?:html|head|body)\b[^>]*>/gi
const HEAD_CONTENT_PATTERN = /<head\b[^>]*>([\s\S]*?)<\/head>/i
const BODY_CONTENT_PATTERN = /<body\b[^>]*>([\s\S]*?)<\/body>/i
const STYLE_TAG_PATTERN = /<style\b[^>]*>[\s\S]*?<\/style>/gi
const SCRIPT_TAG_PATTERN = /<script\b[^>]*>[\s\S]*?<\/script>/gi
const LINK_TAG_PATTERN = /<link\b[^>]*>/gi
const META_TAG_PATTERN = /<meta\b[^>]*>/gi
const HTML_PREVIEW_SCROLLBAR_GUTTER_STYLE_MARKER = 'data-html-preview-scrollbar-gutter="true"'
const HTML_PREVIEW_SCROLLBAR_GUTTER_STYLE = `<style ${HTML_PREVIEW_SCROLLBAR_GUTTER_STYLE_MARKER}>html, body { scrollbar-gutter: stable; }</style>`

export function resolveStreamingHtmlPreviewMarkup(code: string): string {
	const normalizedCode = normalizeHtmlFenceBodyCode(code)
	if (!normalizedCode) return ""

	const lowerCaseCode = normalizedCode.toLowerCase()
	const hasHeadTag = lowerCaseCode.includes("<head")
	const hasBodyTag = lowerCaseCode.includes("<body")
	const hasDocType = lowerCaseCode.includes("<!doctype")
	const hasHtmlShellTag =
		hasHeadTag ||
		hasBodyTag ||
		lowerCaseCode.includes("<html") ||
		lowerCaseCode.includes("</html") ||
		lowerCaseCode.includes("</head") ||
		lowerCaseCode.includes("</body")
	const hasScriptTag = lowerCaseCode.includes("<script")
	const hasLinkTag = lowerCaseCode.includes("<link")
	const hasMetaTag = lowerCaseCode.includes("<meta")

	if (!hasHtmlShellTag && !hasDocType && !hasScriptTag && !hasLinkTag && !hasMetaTag) {
		return normalizedCode
	}

	const headContent = hasHeadTag ? (normalizedCode.match(HEAD_CONTENT_PATTERN)?.[1] ?? "") : ""
	const headStyles = Array.from(headContent.matchAll(STYLE_TAG_PATTERN))
		.map(([matchedStyle]) => matchedStyle)
		.join("\n")
	const bodyContent = hasBodyTag
		? (normalizedCode.match(BODY_CONTENT_PATTERN)?.[1] ?? normalizedCode)
		: normalizedCode

	let previewMarkup = [headStyles, bodyContent].filter(Boolean).join("\n")
	if (hasDocType) previewMarkup = previewMarkup.replace(DOC_TYPE_PATTERN, "")
	if (hasHtmlShellTag) previewMarkup = previewMarkup.replace(HTML_SHELL_TAG_PATTERN, "")
	if (hasScriptTag) previewMarkup = previewMarkup.replace(SCRIPT_TAG_PATTERN, "")
	if (hasLinkTag) previewMarkup = previewMarkup.replace(LINK_TAG_PATTERN, "")
	if (hasMetaTag) previewMarkup = previewMarkup.replace(META_TAG_PATTERN, "")

	return previewMarkup.trim()
}

export function injectHtmlPreviewScrollbarGutterStyle(html: string): string {
	if (!html || html.includes(HTML_PREVIEW_SCROLLBAR_GUTTER_STYLE_MARKER)) {
		return html
	}

	if (html.includes("</head>")) {
		return html.replace("</head>", `${HTML_PREVIEW_SCROLLBAR_GUTTER_STYLE}</head>`)
	}

	return `${html}${HTML_PREVIEW_SCROLLBAR_GUTTER_STYLE}`
}
