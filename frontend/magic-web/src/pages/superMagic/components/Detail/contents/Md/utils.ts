/**
 * Utilities for Markdown content processing
 * Re-exports common utilities from shared image-url-resolver module
 */

import MarkdownIt from "markdown-it"
import DOMPurify from "dompurify"
import type { SourceReplacement } from "./components/EditorBody/source-location"

// Export shared utilities from image-url-resolver
export {
	parseImageSize,
	normalizeImagePath,
	findFileByPath,
	resolveRelativePath,
	buildImageUrlMapEntries,
	extractImagePaths,
	isExternalUrl,
	processMarkdownImages,
	resolveSingleImageUrl,
} from "@/pages/superMagic/utils/image-url-resolver"

// Export types
export type {
	AttachmentFile,
	ResolvedImageData,
	ImageUrlMap,
} from "@/pages/superMagic/utils/image-url-resolver"

interface MarkdownToken {
	type: string
	content: string
	map: [number, number] | null
	children?: MarkdownToken[] | null
}

interface SourceRange {
	start: number
	end: number
}

interface HtmlSourceRange extends SourceRange {
	content: string
}

interface RawHtmlWorkload {
	inlineContents: string[]
	blockTokens: MarkdownToken[]
}

const markdownParser = new MarkdownIt({
	html: true,
	linkify: true,
	breaks: true,
})

const protectedHtmlTags = new Set([
	"script",
	"style",
	"iframe",
	"object",
	"embed",
	"head",
	"meta",
	"link",
	"template",
	"noscript",
	"title",
	"base",
])

// Raw HTML is only retained for the small set of presentational tags that the
// Markdown preview actually needs. SVG/MathML and interactive/embed elements
// are deliberately excluded so SMIL, namespace, and browser-specific vectors
// are handled as code instead of becoming another blacklist to maintain.
const allowedRawHtmlTags = new Set([
	"a",
	"abbr",
	"b",
	"bdi",
	"bdo",
	"blockquote",
	"br",
	"caption",
	"cite",
	"code",
	"col",
	"colgroup",
	"data",
	"dd",
	"del",
	"details",
	"dfn",
	"div",
	"dl",
	"dt",
	"em",
	"figcaption",
	"figure",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"i",
	"img",
	"kbd",
	"li",
	"mark",
	"ol",
	"p",
	"pre",
	"q",
	"rp",
	"rt",
	"ruby",
	"s",
	"samp",
	"small",
	"span",
	"strong",
	"sub",
	"summary",
	"sup",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"time",
	"tr",
	"u",
	"ul",
	"var",
	"video",
	"wbr",
])

const voidHtmlTags = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
])

const urlAttributeNames = new Set([
	"href",
	"src",
	"xlink:href",
	"action",
	"formaction",
	"poster",
	"background",
	"cite",
	"manifest",
	"usemap",
])
const safeUrlProtocols = new Set(["http", "https", "mailto", "tel"])
const safeInlineStylePropertyPatterns = [
	/^background(?:-color)?$/,
	/^border(?:-(?:top|right|bottom|left))?(?:-(?:color|style|width))?$/,
	/^border-radius$/,
	/^border-(?:top|right|bottom|left)-(?:left|right)-radius$/,
	/^(?:margin|padding)(?:-(?:top|right|bottom|left))?$/,
	/^font-(?:family|size|style|weight)$/,
	/^text-(?:align|decoration|indent|transform)$/,
	/^(?:display|max-width|max-height)$/,
	/^(?:color|letter-spacing|line-height|vertical-align|white-space)$/,
]
const safeCssColorPattern =
	/^(?:#[\da-f]{3,8}|[a-z]+|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([\d\s.,%+\-/]+\))$/i
const spacingPropertyPattern = /^(?:margin|padding)(?:-(?:top|right|bottom|left))?$/
const borderWidthPropertyPattern = /^border(?:-(?:top|right|bottom|left))?(?:-width)?$/
const borderLonghandWidthPropertyPattern = /^border-(?:top|right|bottom|left)-width$/
const borderRadiusPropertyPattern =
	/^border(?:-radius|-(?:top|right|bottom|left)-(?:left|right)-radius)$/
const unsafeCssValuePattern =
	/[\\{}]|\/\*|\*\/|!\s*important|url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding|(?:calc|clamp|var|env)\s*\(/i
const MAX_PROBE_CANDIDATES = 2048
const MAX_PROBE_MARKDOWN_LENGTH = 4 * 1024 * 1024
const MAX_RAW_HTML_TOKEN_COUNT = 4096
const MAX_RAW_HTML_TOTAL_BYTES = 512 * 1024
const htmlRiskAttributePresencePattern =
	/\s+(?:on[a-z][\w:-]*|srcdoc|autoplay|style|href|src|xlink:href|action|formaction|poster|background|cite|manifest|usemap|srcset|ping)(?:\s*=|\s|>)/i

const safeHtmlSanitizeConfig = {
	ALLOWED_TAGS: Array.from(allowedRawHtmlTags),
	ALLOWED_ATTR: [
		"alt",
		"cite",
		"class",
		"controls",
		"height",
		"href",
		"loading",
		"max",
		"media",
		"min",
		"open",
		"poster",
		"preload",
		"rel",
		"src",
		"start",
		"style",
		"target",
		"title",
		"type",
		"value",
		"width",
		"playsinline",
	],
	ALLOW_DATA_ATTR: true,
	ALLOW_UNKNOWN_PROTOCOLS: false,
	FORBID_TAGS: Array.from(protectedHtmlTags),
	FORBID_ATTR: ["autoplay", "onerror", "onclick", "onload", "srcdoc"],
} as const

DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
	const attributeName = data.attrName.toLowerCase()
	if (attributeName === "style" && !isSafeInlineStyle(data.attrValue)) {
		data.keepAttr = false
		return
	}
	if (
		urlAttributeNames.has(attributeName) &&
		!isSafeUrlAttribute(attributeName, data.attrValue)
	) {
		data.keepAttr = false
	}
})

function escapeHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function getHtmlTagDescriptor(html: string): {
	name: string
	isClosing: boolean
	isSelfClosing: boolean
} | null {
	const match = html.match(/^<\s*(\/?)\s*([a-z][\w:-]*)\b[\s\S]*>$/i)
	if (!match) return null

	return {
		name: match[2].toLowerCase(),
		isClosing: match[1] === "/",
		isSelfClosing: /\/\s*>$/.test(html),
	}
}

function removeProtocolWhitespaceAndControls(value: string): string {
	return Array.from(value)
		.filter((character) => {
			const codePoint = character.codePointAt(0) ?? 0
			return codePoint > 0x20 && (codePoint < 0x7f || codePoint > 0x9f)
		})
		.join("")
}

export function isSafeUrlAttribute(attributeName: string, value: string): boolean {
	const normalizedValue = removeProtocolWhitespaceAndControls(value)
	if (!normalizedValue) return true

	const protocolMatch = normalizedValue.match(/^([a-z][a-z0-9+.-]*):/i)
	if (!protocolMatch) return true

	const protocol = protocolMatch[1].toLowerCase()
	if (safeUrlProtocols.has(protocol)) return true

	return (
		protocol === "data" &&
		(attributeName === "src" || attributeName === "poster") &&
		/^data:image\/(?:avif|gif|jpe?g|png|webp);base64,/i.test(normalizedValue)
	)
}

function isBoundedCssLength(
	value: string,
	options: { maxPx: number; maxRelative: number; allowNegative?: boolean },
): boolean {
	if (/^0(?:\.0+)?$/.test(value)) return true

	const match = value.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em)$/i)
	if (!match) return false

	const amount = Number(match[1])
	if (!Number.isFinite(amount) || (!options.allowNegative && amount < 0)) return false

	const absoluteAmount = Math.abs(amount)
	return match[2].toLowerCase() === "px"
		? absoluteAmount <= options.maxPx
		: absoluteAmount <= options.maxRelative
}

function isSafeSpacingValue(property: string, value: string): boolean {
	const values = value.split(/\s+/)
	if (values.length === 0 || values.length > 4) return false

	return values.every(
		(item) =>
			(property.startsWith("margin") && item.toLowerCase() === "auto") ||
			isBoundedCssLength(item, { maxPx: 128, maxRelative: 8 }),
	)
}

function isSafeBorderWidthValue(value: string): boolean {
	const values = value.split(/\s+/)
	if (values.length === 0 || values.length > 4) return false

	return values.every(
		(item) =>
			/^(?:thin|medium|thick)$/i.test(item) ||
			isBoundedCssLength(item, { maxPx: 16, maxRelative: 1 }),
	)
}

function hasUnsafeBorderWidth(value: string): boolean {
	const dimensions = value.match(/(?:^|[\s/])(-?(?:\d+(?:\.\d+)?|\.\d+)[a-z%]+)/gi) ?? []
	return dimensions.some(
		(dimension) => !isBoundedCssLength(dimension.trim(), { maxPx: 16, maxRelative: 1 }),
	)
}

function isSafeBoundedSizeValue(value: string): boolean {
	const minMatch = value.match(/^min\(\s*([^,]+)\s*,\s*([^)]+)\s*\)$/i)
	if (minMatch) {
		return [minMatch[1], minMatch[2]].every((part) => {
			const normalizedPart = part.trim()
			const percentage = normalizedPart.match(/^(\d+(?:\.\d+)?|\.\d+)%$/)
			if (percentage) return Number(percentage[1]) <= 100
			return isBoundedCssLength(normalizedPart, { maxPx: 2048, maxRelative: 128 })
		})
	}

	const percentage = value.match(/^(\d+(?:\.\d+)?|\.\d+)%$/)
	if (percentage) return Number(percentage[1]) <= 100
	return isBoundedCssLength(value, { maxPx: 2048, maxRelative: 128 })
}

function isSafeBorderRadiusValue(value: string): boolean {
	const values = value.split(/[\s/]+/).filter(Boolean)
	if (values.length === 0 || values.length > 8) return false

	return values.every((item) => {
		const percentage = item.match(/^(\d+(?:\.\d+)?|\.\d+)%$/)
		if (percentage) return Number(percentage[1]) <= 100
		return isBoundedCssLength(item, { maxPx: 128, maxRelative: 8 })
	})
}

function isSafeInlineStyleValue(property: string, value: string): boolean {
	if (unsafeCssValuePattern.test(value)) return false

	if (
		property === "background" ||
		property === "background-color" ||
		property === "color" ||
		property.endsWith("-color")
	) {
		return safeCssColorPattern.test(value)
	}
	if (spacingPropertyPattern.test(property)) return isSafeSpacingValue(property, value)
	if (borderRadiusPropertyPattern.test(property)) return isSafeBorderRadiusValue(value)
	if (property === "border-width" || borderLonghandWidthPropertyPattern.test(property)) {
		return isSafeBorderWidthValue(value)
	}
	if (borderWidthPropertyPattern.test(property) && hasUnsafeBorderWidth(value)) return false
	if (property === "font-size") {
		return (
			/^(?:xx-small|x-small|small|medium|large|x-large|xx-large)$/i.test(value) ||
			isBoundedCssLength(value, { maxPx: 96, maxRelative: 6 })
		)
	}
	if (property === "line-height") {
		if (/^normal$/i.test(value)) return true
		if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
			const amount = Number(value)
			return amount >= 0.5 && amount <= 3
		}
		return isBoundedCssLength(value, { maxPx: 128, maxRelative: 8 })
	}
	if (property === "text-indent") {
		return isBoundedCssLength(value, { maxPx: 128, maxRelative: 8 })
	}
	if (property === "display") return /^(?:block|inline|inline-block)$/i.test(value)
	if (property === "max-width" || property === "max-height") {
		return isSafeBoundedSizeValue(value)
	}
	if (property === "letter-spacing") {
		return (
			/^normal$/i.test(value) ||
			isBoundedCssLength(value, { maxPx: 16, maxRelative: 1, allowNegative: true })
		)
	}

	// Remaining allowed properties are keyword/string based. Disallow functions
	// and viewport/container units so they cannot indirectly create unbounded UI.
	return !/[a-z-]+\s*\(|(?:vh|vw|vmin|vmax|svh|svw|lvh|lvw|dvh|dvw|cqh|cqw|cqi|cqb)\b/i.test(
		value,
	)
}

export function isSafeInlineStyle(styleValue: string): boolean {
	if (!styleValue.trim()) return true

	// Validate the authored declarations instead of enumerating CSSStyleDeclaration.
	// Browsers differ in whether shorthand properties such as `border` and
	// `margin` are exposed as authored shorthands or expanded longhands. Using
	// the authored form keeps the safety decision deterministic across browsers.
	const declarations: string[] = []
	let start = 0
	let quote: "'" | '"' | null = null
	let parentheses = 0

	for (let index = 0; index < styleValue.length; index += 1) {
		const character = styleValue[index]
		if (quote) {
			if (character === quote && styleValue[index - 1] !== "\\") quote = null
			continue
		}
		if (character === "'" || character === '"') {
			quote = character
			continue
		}
		if (character === "(") parentheses += 1
		if (character === ")") parentheses -= 1
		if (character === ";" && parentheses === 0) {
			declarations.push(styleValue.slice(start, index))
			start = index + 1
		}
	}
	if (quote || parentheses !== 0) return false
	declarations.push(styleValue.slice(start))

	for (const declaration of declarations) {
		if (!declaration.trim()) continue
		const separator = declaration.indexOf(":")
		if (separator <= 0) return false

		const property = declaration.slice(0, separator).trim().toLowerCase()
		const value = declaration.slice(separator + 1).trim()
		if (!value || !safeInlineStylePropertyPatterns.some((pattern) => pattern.test(property))) {
			return false
		}
		if (!isSafeInlineStyleValue(property, value)) return false
	}

	return declarations.some((declaration) => declaration.trim() !== "")
}

function hasDangerousHtmlContent(html: string): boolean {
	if (typeof window === "undefined") return htmlRiskAttributePresencePattern.test(html)

	// DOMPurify intentionally removes some elements before adding an entry to
	// `removed` (notably script/style and unsupported namespaces). Inspect the
	// parsed fragment as well so those removals cannot be mistaken for a safe
	// empty result. The template fragment avoids treating the document's
	// synthetic html/head/body wrappers as authored tags.
	const template = window.document.createElement("template")
	template.innerHTML = html
	for (const element of Array.from(template.content.querySelectorAll("*"))) {
		if (!allowedRawHtmlTags.has(element.tagName.toLowerCase())) return true
	}

	DOMPurify.removed = []
	DOMPurify.sanitize(html, safeHtmlSanitizeConfig)
	// DOMPurify parses fragments through a temporary BODY element. That
	// container is reported in `removed` for every sanitize call, including
	// completely safe HTML, so checking the array length would turn all raw
	// HTML into code. Only removed attributes/elements from the authored
	// fragment represent a policy violation; ignore the parser container.
	return DOMPurify.removed.some((entry) => {
		if (entry.attribute) return true
		const elementName = entry.element?.tagName?.toLowerCase()
		return !!elementName && elementName !== "body"
	})
}

function shouldRenderHtmlAsCode(html: string): boolean {
	return hasDangerousHtmlContent(html)
}

function shouldRenderHtmlAsCodeCached(html: string, cache: Map<string, boolean>): boolean {
	const cached = cache.get(html)
	if (cached !== undefined) return cached

	const result = shouldRenderHtmlAsCode(html)
	cache.set(html, result)
	return result
}

function addUtf8ByteLength(value: string, currentBytes: number): number {
	let bytes = currentBytes
	for (const character of value) {
		const codePoint = character.codePointAt(0) ?? 0
		bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4
		if (bytes > MAX_RAW_HTML_TOTAL_BYTES) return bytes
	}
	return bytes
}

function collectRawHtmlWorkload(tokens: MarkdownToken[]): RawHtmlWorkload | null {
	const inlineContents: string[] = []
	const blockTokens: MarkdownToken[] = []
	let tokenCount = 0
	let totalBytes = 0

	const addContent = (content: string): boolean => {
		tokenCount += 1
		if (tokenCount > MAX_RAW_HTML_TOKEN_COUNT) return false
		totalBytes = addUtf8ByteLength(content, totalBytes)
		return totalBytes <= MAX_RAW_HTML_TOTAL_BYTES
	}

	for (const token of tokens) {
		if (token.type === "html_block") {
			if (!addContent(token.content)) return null
			blockTokens.push(token)
		}

		for (const child of token.children ?? []) {
			if (child.type !== "html_inline") continue
			if (!addContent(child.content)) return null
			inlineContents.push(child.content)
		}
	}

	return { inlineContents, blockTokens }
}

function collectHtmlInlineContents(tokens: MarkdownToken[]): string[] {
	const contents: string[] = []
	for (const token of tokens) {
		for (const child of token.children ?? []) {
			if (child.type === "html_inline") contents.push(child.content)
		}
	}
	return contents
}

function collectRelevantHtmlInlineContents(
	htmlContents: string[],
	riskCache: Map<string, boolean>,
): string[] {
	const selectedIndexes = new Set<number>()
	const openTags = new Map<string, Array<{ index: number; dangerous: boolean }>>()

	for (const [index, content] of htmlContents.entries()) {
		const descriptor = getHtmlTagDescriptor(content)
		if (!descriptor) continue

		const isVoid = descriptor.isSelfClosing || voidHtmlTags.has(descriptor.name)

		if (descriptor.isClosing) {
			const openingTag = openTags.get(descriptor.name)?.pop()
			if (openingTag?.dangerous || protectedHtmlTags.has(descriptor.name)) {
				if (openingTag) selectedIndexes.add(openingTag.index)
				selectedIndexes.add(index)
			}
			continue
		}

		const dangerous = shouldRenderHtmlAsCodeCached(content, riskCache)

		if (isVoid) {
			if (dangerous) selectedIndexes.add(index)
			continue
		}

		const tagStack = openTags.get(descriptor.name) ?? []
		tagStack.push({ index, dangerous })
		openTags.set(descriptor.name, tagStack)
	}

	for (const tagStack of openTags.values()) {
		for (const openingTag of tagStack) {
			if (openingTag.dangerous) selectedIndexes.add(openingTag.index)
		}
	}

	return htmlContents.filter((_, index) => selectedIndexes.has(index))
}

function createHtmlProbe(html: string, probeIndex: number): string {
	const closingBracketIndex = html.lastIndexOf(">")
	if (closingBracketIndex === -1) return html

	const selfClosingSlashIndex = html.slice(0, closingBracketIndex).search(/\/\s*$/)
	const insertionIndex =
		selfClosingSlashIndex === -1 ? closingBracketIndex : selfClosingSlashIndex
	// Encode the candidate index into a fixed-width whitespace marker. HTML
	// permits whitespace here for both opening and closing tags, and fixed
	// width prevents probe memory from growing with the number of candidates.
	const probeBits = (probeIndex >>> 0).toString(2).padStart(24, "0").slice(-24)
	const probeWhitespace = Array.from(probeBits, (bit) => (bit === "1" ? "\t" : " ")).join("")

	return `${html.slice(0, insertionIndex)}${probeWhitespace}${html.slice(insertionIndex)}`
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function locateHtmlInlineRanges(
	markdown: string,
	htmlInlineContents: string[],
	riskCache: Map<string, boolean>,
): HtmlSourceRange[] | null {
	const htmlContents = [
		...new Set(collectRelevantHtmlInlineContents(htmlInlineContents, riskCache)),
	]
	if (htmlContents.length === 0) return []
	if (htmlContents.length > MAX_PROBE_CANDIDATES) return null

	const candidates: Array<{ start: number; end: number; probe: string; content: string }> = []
	const seenCandidates = new Set<string>()
	const contentPattern = new RegExp(
		htmlContents
			.slice()
			.sort((left, right) => right.length - left.length)
			.map(escapeRegExp)
			.join("|"),
		"g",
	)
	let match: RegExpExecArray | null
	while ((match = contentPattern.exec(markdown))) {
		const content = match[0]
		const candidateStart = match.index
		const candidateEnd = candidateStart + content.length
		const key = `${candidateStart}:${candidateEnd}`
		if (!seenCandidates.has(key)) {
			const probe = createHtmlProbe(content, candidates.length)
			candidates.push({ start: candidateStart, end: candidateEnd, probe, content })
			seenCandidates.add(key)
		}
		if (candidates.length > MAX_PROBE_CANDIDATES) return null
	}

	const nonOverlappingCandidates = candidates
		.sort((left, right) => left.start - right.start || right.end - left.end)
		.filter(
			(candidate, index, sorted) => index === 0 || candidate.start >= sorted[index - 1].end,
		)
	const probedParts: string[] = []
	let sourceCursor = 0
	for (const candidate of nonOverlappingCandidates) {
		probedParts.push(markdown.slice(sourceCursor, candidate.start), candidate.probe)
		sourceCursor = candidate.end
	}
	probedParts.push(markdown.slice(sourceCursor))
	const probedMarkdown = probedParts.join("")
	const recognizedProbes = new Set(
		collectHtmlInlineContents(markdownParser.parse(probedMarkdown, {}) as MarkdownToken[]),
	)

	return nonOverlappingCandidates
		.filter((candidate) => recognizedProbes.has(candidate.probe))
		.map(({ start, end, content }) => ({ start, end, content }))
}

function getLineOffsets(markdown: string): number[] {
	const offsets = [0]
	for (let index = 0; index < markdown.length; index += 1) {
		if (markdown[index] === "\n") offsets.push(index + 1)
	}
	offsets.push(markdown.length)
	return offsets
}

function createHtmlBlockReplacement(
	markdown: string,
	token: MarkdownToken,
	lineOffsets: number[],
	riskCache: Map<string, boolean>,
): { range: SourceRange; replacement: string } | null {
	if (!token.map || !shouldRenderHtmlAsCodeCached(token.content, riskCache)) return null

	const [startLine, endLine] = token.map
	const start = lineOffsets[startLine]
	const end = lineOffsets[endLine] ?? markdown.length
	const sourceLines = markdown.slice(start, end).replace(/\n$/, "").split("\n")
	const tokenLines = token.content.replace(/\n$/, "").split("\n")
	const encodedLines = sourceLines.map((sourceLine, index) => {
		const tokenLine = tokenLines[index] ?? ""
		const contentStart = tokenLine ? sourceLine.indexOf(tokenLine) : sourceLine.length
		const prefix = contentStart >= 0 ? sourceLine.slice(0, contentStart) : ""
		const content = contentStart >= 0 ? tokenLine : sourceLine
		const opening = index === 0 ? "<pre><code>" : ""
		const closing = index === sourceLines.length - 1 ? "</code></pre>" : ""
		return `${prefix}${opening}${escapeHtml(content)}${closing}`
	})

	return {
		range: { start, end },
		replacement: `${encodedLines.join("\n")}${markdown.slice(start, end).endsWith("\n") ? "\n" : ""}`,
	}
}

function createInlineCodeRanges(
	ranges: HtmlSourceRange[],
	riskCache: Map<string, boolean>,
): SourceRange[] {
	const result: SourceRange[] = []
	const openTags = new Map<string, Array<HtmlSourceRange & { dangerous: boolean }>>()

	for (const range of ranges) {
		const descriptor = getHtmlTagDescriptor(range.content)
		if (!descriptor) continue

		const isVoid = descriptor.isSelfClosing || voidHtmlTags.has(descriptor.name)

		if (descriptor.isClosing) {
			const tagStack = openTags.get(descriptor.name)
			const openingTag = tagStack?.pop()
			if (openingTag?.dangerous || protectedHtmlTags.has(descriptor.name)) {
				result.push({
					start: openingTag?.start ?? range.start,
					end: range.end,
				})
			}
			continue
		}

		const dangerous = shouldRenderHtmlAsCodeCached(range.content, riskCache)

		if (isVoid) {
			if (dangerous) result.push(range)
			continue
		}

		const tagStack = openTags.get(descriptor.name) ?? []
		tagStack.push({ ...range, dangerous })
		openTags.set(descriptor.name, tagStack)
	}

	for (const tagStack of openTags.values()) {
		for (const openingTag of tagStack) {
			if (openingTag.dangerous) result.push(openingTag)
		}
	}

	return result
}

function mergeSourceRanges(ranges: SourceRange[]): SourceRange[] {
	const sortedRanges = [...ranges].sort((left, right) => left.start - right.start)
	const merged: SourceRange[] = []

	for (const range of sortedRanges) {
		const previous = merged[merged.length - 1]
		if (previous && range.start <= previous.end) {
			previous.end = Math.max(previous.end, range.end)
		} else {
			merged.push({ ...range })
		}
	}

	return merged
}

function applySourceReplacements(
	markdown: string,
	replacements: Array<{ range: SourceRange; replacement: string }>,
	onReplacements?: (ranges: SourceReplacement[]) => void,
): string {
	const sortedReplacements = [...replacements].sort(
		(left, right) => left.range.start - right.range.start,
	)
	const parts: string[] = []
	let sourceCursor = 0
	let outputCursor = 0
	const ranges: SourceReplacement[] = []

	for (const { range, replacement } of sortedReplacements) {
		if (range.start < sourceCursor) continue
		outputCursor += range.start - sourceCursor
		ranges.push({
			sourceStart: range.start,
			sourceEnd: range.end,
			start: outputCursor,
			end: outputCursor + replacement.length,
		})
		outputCursor += replacement.length
		parts.push(markdown.slice(sourceCursor, range.start), replacement)
		sourceCursor = range.end
	}

	parts.push(markdown.slice(sourceCursor))
	onReplacements?.(ranges)
	return parts.join("")
}

/**
 * Convert HTML elements that are either invisible or can execute content into
 * literal code text when a Markdown parser is configured with raw HTML support.
 *
 * The same markdown-it grammar used by the renderer identifies code blocks,
 * inline code, and raw HTML, so code samples are intentionally left untouched.
 * DOMPurify supplies the maintained HTML/attribute policy; the source-range
 * pass below preserves the product behavior of showing rejected fragments as
 * literal code instead of silently dropping them.
 */
export function escapeDangerousInvisibleHtmlTags(
	markdown: string,
	onReplacements?: (ranges: SourceReplacement[]) => void,
): string {
	onReplacements?.([])
	const escapeDocument = () =>
		applySourceReplacements(
			markdown,
			[
				{
					range: { start: 0, end: markdown.length },
					replacement: `<pre><code>${escapeHtml(markdown)}</code></pre>`,
				},
			],
			onReplacements,
		)
	if (!markdown) return markdown
	if (markdown.length > MAX_PROBE_MARKDOWN_LENGTH) {
		return escapeDocument()
	}

	const tokens = markdownParser.parse(markdown, {}) as MarkdownToken[]
	const rawHtmlWorkload = collectRawHtmlWorkload(tokens)
	if (!rawHtmlWorkload) {
		return escapeDocument()
	}

	const riskCache = new Map<string, boolean>()
	const lineOffsets = getLineOffsets(markdown)
	const replacements: Array<{ range: SourceRange; replacement: string }> =
		rawHtmlWorkload.blockTokens
			.map((token) => createHtmlBlockReplacement(markdown, token, lineOffsets, riskCache))
			.filter((replacement): replacement is NonNullable<typeof replacement> => !!replacement)

	const locatedInlineRanges = locateHtmlInlineRanges(
		markdown,
		rawHtmlWorkload.inlineContents,
		riskCache,
	)
	if (locatedInlineRanges === null) {
		return escapeDocument()
	}

	const inlineRanges = createInlineCodeRanges(locatedInlineRanges, riskCache)
	for (const range of mergeSourceRanges(inlineRanges)) {
		replacements.push({
			range,
			replacement: `<code>${escapeHtml(markdown.slice(range.start, range.end))}</code>`,
		})
	}

	return applySourceReplacements(markdown, replacements, onReplacements)
}

/**
 * Recursively find a file in the attachment tree by file name
 * Legacy function for backward compatibility
 *
 * @param items - Array of attachment files
 * @param fileName - The file name to search for
 * @returns The matched file or null if not found
 */
export function findFileByName(
	items: Array<{
		file_id: string
		file_name: string
		is_directory?: boolean
		children?: any[]
		relative_file_path?: string
	}>,
	fileName: string,
): any | null {
	if (!Array.isArray(items) || items.length === 0) {
		return null
	}

	for (const item of items) {
		// Recursively search in directories
		if (item.is_directory && item.children) {
			const found = findFileByName(item.children, fileName)
			if (found) return found
		}
		// Check if the file name matches
		else if (item.file_name === fileName || fileName.startsWith(item.file_name)) {
			return item
		}
	}

	return null
}

/**
 * Extract file name from image URL (removing size syntax)
 *
 * @param imgUrl - Image URL with optional size syntax (e.g., "./images/file.png =300x200")
 * @returns File name without path and size syntax
 *
 * @example
 * extractFileName("./images/file.png =300x200") // returns "file.png"
 * extractFileName("../folder/photo.jpg =300x") // returns "photo.jpg"
 */
export function extractFileName(imgUrl: string): string {
	// Remove size syntax first (e.g., " =300x200")
	const urlWithoutSize = imgUrl.split(" ")[0]
	// Extract the file name from path
	const pathParts = urlWithoutSize.split("/")
	return pathParts[pathParts.length - 1]
}
