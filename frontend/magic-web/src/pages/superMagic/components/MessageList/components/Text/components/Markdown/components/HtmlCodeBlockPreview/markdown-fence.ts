import type { HtmlCodeBlockPreviewCodeBlockInfo } from "./types"
import { HTML_CODE_BLOCK_LANGUAGE, normalizeHtmlFenceBodyCode } from "./shared"

export interface HtmlCodeBlockPreviewDomCodeBlockInfo extends HtmlCodeBlockPreviewCodeBlockInfo {
	streamStatus?: "loading" | "done"
}

interface DomNodeLike {
	type?: string
	name?: string
	data?: string
	attribs?: Record<string, string | undefined>
	children?: DomNodeLike[]
}

function isDomElementNode(node: unknown, tagName?: string): node is DomNodeLike {
	if (!node || typeof node !== "object") return false

	const candidate = node as DomNodeLike
	if (typeof candidate.name !== "string") return false

	if (!tagName) return true

	return candidate.name.toLowerCase() === tagName.toLowerCase()
}

function extractTextContentFromDomNode(node: unknown): string {
	if (!node || typeof node !== "object") return ""

	const candidate = node as DomNodeLike

	if (candidate.type === "text") {
		return typeof candidate.data === "string" ? candidate.data : ""
	}

	if (!Array.isArray(candidate.children)) return ""

	return candidate.children.map((child) => extractTextContentFromDomNode(child)).join("")
}

function resolveCodeBlockClassNameFromDomNode(codeNode: DomNodeLike): string | undefined {
	const className = codeNode.attribs?.class ?? codeNode.attribs?.className
	if (className?.trim()) return className.trim()

	const infoString = codeNode.attribs?.["data-lang"]?.trim()
	if (!infoString) return undefined

	const [language] = infoString.split(/\s+/)
	return language ? `language-${language}` : undefined
}

function isCodeLanguage(className: string | undefined, language: string): boolean {
	if (!className) return false

	const tokens = className
		.split(/\s+/)
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean)

	return tokens.some(
		(token) =>
			token === language || token === `lang-${language}` || token === `language-${language}`,
	)
}

export function extractCodeBlockDomInfoFromDomNode(
	domNode: unknown,
): HtmlCodeBlockPreviewDomCodeBlockInfo | null {
	if (!isDomElementNode(domNode, "pre")) return null

	const codeNode = domNode.children?.find((child) => isDomElementNode(child, "code"))
	if (!isDomElementNode(codeNode, "code")) return null

	const streamStatusAttr = codeNode.attribs?.["data-state"]
	const streamStatus = streamStatusAttr === "loading" ? "loading" : "done"

	return {
		className: resolveCodeBlockClassNameFromDomNode(codeNode),
		code: extractTextContentFromDomNode(codeNode),
		streamStatus,
	}
}

export function isHtmlCodeLanguage(className?: string): boolean {
	return isCodeLanguage(className, HTML_CODE_BLOCK_LANGUAGE)
}

export function resolveHtmlPreviewCode(
	codeBlockInfo: HtmlCodeBlockPreviewCodeBlockInfo | null,
): string | undefined {
	if (!codeBlockInfo) return undefined

	if (isHtmlCodeLanguage(codeBlockInfo.className)) {
		return normalizeHtmlFenceBodyCode(codeBlockInfo.code)
	}

	return undefined
}
