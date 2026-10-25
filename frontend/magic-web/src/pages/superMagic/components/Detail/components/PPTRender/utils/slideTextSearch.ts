import { parse, type DefaultTreeAdapterTypes } from "parse5"
import { DecodingMode, EntityDecoder, htmlDecodeTree } from "entities/decode"

export interface SlideTextSourceRange {
	/** UTF-16 offsets in the original source, with an exclusive end. */
	readonly start: number
	readonly end: number
}

export interface SlideTextMatch {
	readonly id: number
	readonly text: string
	readonly context: string
	readonly ranges: readonly SlideTextSourceRange[]
	readonly replaceable: boolean
}

export interface SlideTextSearchSnapshot {
	readonly source: string
	readonly query: string
	readonly caseSensitive: boolean
	readonly matches: readonly SlideTextMatch[]
}

type HtmlNode = DefaultTreeAdapterTypes.Node
type HtmlElement = DefaultTreeAdapterTypes.Element
type TextBlock = { text: string; units: (SlideTextSourceRange | undefined)[] }

const EXCLUDED_TAGS = new Set([
	"head",
	"script",
	"style",
	"template",
	"noscript",
	"noembed",
	"noframes",
	"canvas",
	"iframe",
	"object",
	"embed",
	"textarea",
	"select",
	"title",
	"desc",
	"defs",
	"symbol",
])
const BLOCK_TAGS = new Set([
	"address",
	"article",
	"aside",
	"blockquote",
	"body",
	"caption",
	"dd",
	"details",
	"dialog",
	"div",
	"dl",
	"dt",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hgroup",
	"hr",
	"li",
	"main",
	"nav",
	"ol",
	"p",
	"pre",
	"section",
	"summary",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"tr",
	"ul",
	"text",
])

function getAttribute(element: HtmlElement, name: string): string | undefined {
	return element.attrs.find((attribute) => attribute.name === name)?.value
}

function isHidden(element: HtmlElement): boolean {
	if (getAttribute(element, "hidden") !== undefined) return true
	if (getAttribute(element, "aria-hidden")?.trim().toLowerCase() === "true") return true
	if (element.tagName === "dialog" && getAttribute(element, "open") === undefined) return true
	if (
		element.namespaceURI === "http://www.w3.org/2000/svg" &&
		(getAttribute(element, "display")?.trim().toLowerCase() === "none" ||
			["hidden", "collapse"].includes(
				getAttribute(element, "visibility")?.trim().toLowerCase() || "",
			))
	)
		return true
	const style = getAttribute(element, "style") || ""
	// Conservatively exclude explicit hiding declarations, including !important. External
	// stylesheets, selectors, layout and runtime changes are outside this static source index.
	return /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!\s*important\s*)?(?:;|$)/i.test(
		style.replace(/\/\*[\s\S]*?\*\//g, ""),
	)
}

function hasTextRenderingContext(node: DefaultTreeAdapterTypes.TextNode): boolean {
	let parent = node.parentNode
	if (
		!(parent && "namespaceURI" in parent) ||
		parent.namespaceURI !== "http://www.w3.org/2000/svg"
	) {
		return true
	}
	// SVG only paints character data inside a <text> subtree; a <g> label is not text.
	while (parent && "tagName" in parent) {
		if (parent.tagName === "text") return true
		parent = parent.parentNode
	}
	return false
}

/** Decode only parser-proven text ranges; never tokenize HTML with regular expressions. */
function mapText(source: string, node: DefaultTreeAdapterTypes.TextNode): TextBlock {
	const location = node.sourceCodeLocation
	const parent = node.parentNode
	// Obsolete raw-text elements display escapes literally, so the normal escaped
	// text patch cannot safely preserve replacement semantics inside them.
	if (parent && "tagName" in parent && ["xmp", "plaintext"].includes(parent.tagName)) {
		return { text: node.value, units: Array(node.value.length).fill(undefined) }
	}
	if (!location) return { text: node.value, units: Array(node.value.length).fill(undefined) }
	const raw = source.slice(location.startOffset, location.endOffset)
	const units: SlideTextSourceRange[] = []
	let text = ""
	let offset = 0
	let entityText = ""
	const decoder = new EntityDecoder(htmlDecodeTree, (codepoint) => {
		entityText += String.fromCodePoint(codepoint)
	})
	while (offset < raw.length) {
		let value = raw[offset]
		let length = 1
		if (value === "&") {
			entityText = ""
			decoder.startEntity(DecodingMode.Legacy)
			let consumed = decoder.write(raw, offset + 1)
			if (consumed < 0) consumed = decoder.end()
			if (consumed > 0) {
				value = entityText
				length = consumed
			}
		} else if (value === "\r") {
			value = "\n"
			length = raw[offset + 1] === "\n" ? 2 : 1
		} else {
			const codepoint = raw.codePointAt(offset)
			if (codepoint !== undefined) {
				value = String.fromCodePoint(codepoint)
				length = value.length
			}
		}
		const range = {
			start: location.startOffset + offset,
			end: location.startOffset + offset + length,
		}
		text += value
		for (let index = 0; index < value.length; index++) units.push(range)
		offset += length
	}
	// Browser error recovery (e.g. foster parenting or null characters) may produce
	// text with a non-contiguous source. Keep it searchable but never guess its patch.
	return text === node.value
		? { text, units }
		: { text: node.value, units: Array(node.value.length).fill(undefined) }
}

function collectTextBlocks(source: string): TextBlock[] {
	const document = parse(source, { sourceCodeLocationInfo: true, scriptingEnabled: true })
	const blocks: TextBlock[] = []
	let current: TextBlock = { text: "", units: [] }
	function flush() {
		if (current.text) blocks.push(current)
		current = { text: "", units: [] }
	}
	function visit(node: HtmlNode) {
		if ("value" in node && node.nodeName === "#text") {
			if (!hasTextRenderingContext(node)) return
			const mapped = mapText(source, node)
			current.text += mapped.text
			for (const unit of mapped.units) current.units.push(unit)
			return
		}
		if (!("childNodes" in node)) return
		const element = "tagName" in node ? node : undefined
		if (element && (EXCLUDED_TAGS.has(element.tagName) || isHidden(element))) {
			flush()
			return
		}
		const boundary = element && (BLOCK_TAGS.has(element.tagName) || element.tagName === "br")
		if (boundary) flush()
		// Closed details expose their summary only. The excluded body forms a boundary.
		for (const child of node.childNodes) {
			if (
				element?.tagName === "details" &&
				getAttribute(element, "open") === undefined &&
				!("tagName" in child && child.tagName === "summary")
			) {
				flush()
				continue
			}
			visit(child)
		}
		if (boundary) flush()
	}
	visit(document)
	flush()
	return blocks
}

function sameRange(
	left: SlideTextSourceRange | undefined,
	right: SlideTextSourceRange | undefined,
) {
	return (
		left !== undefined &&
		right !== undefined &&
		left.start === right.start &&
		left.end === right.end
	)
}

function getMatchRanges(block: TextBlock, start: number, end: number) {
	const ranges: SlideTextSourceRange[] = []
	let replaceable =
		!sameRange(block.units[start - 1], block.units[start]) &&
		!sameRange(block.units[end - 1], block.units[end])
	for (let index = start; index < end; index++) {
		const unit = block.units[index]
		if (!unit) {
			replaceable = false
			continue
		}
		const last = ranges[ranges.length - 1]
		if (last && unit.start < last.end) {
			if (unit.end !== last.end) replaceable = false
			continue
		}
		if (last && last.end === unit.start)
			ranges[ranges.length - 1] = { start: last.start, end: unit.end }
		else ranges.push({ ...unit })
	}
	return { ranges: Object.freeze(ranges.map((range) => Object.freeze(range))), replaceable }
}

/**
 * Pure, inert source search. Matches are literal, non-overlapping and separated by HTML
 * block boundaries. Whitespace follows source textContent (including preformatted text),
 * not computed CSS layout. No scripts, resource loads or DOM serialization are involved.
 */
export function createSlideTextSearchSnapshot(
	source: string,
	query: string,
	options: { caseSensitive?: boolean } = {},
): SlideTextSearchSnapshot {
	const caseSensitive = options.caseSensitive ?? false
	const matches: SlideTextMatch[] = []
	if (query) {
		// Escaping gives literal search while RegExp's Unicode case folding preserves
		// source offsets; lowercasing whole strings can change their UTF-16 lengths.
		const pattern = new RegExp(
			query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
			caseSensitive ? "gu" : "giu",
		)
		for (const block of collectTextBlocks(source)) {
			for (const match of block.text.matchAll(pattern)) {
				const start = match.index
				const end = start + match[0].length
				matches.push(
					Object.freeze({
						id: matches.length,
						text: match[0],
						context: block.text.slice(Math.max(0, start - 40), end + 40),
						...getMatchRanges(block, start, end),
					}),
				)
			}
		}
	}
	return Object.freeze({ source, query, caseSensitive, matches: Object.freeze(matches) })
}

/**
 * Build a preview from the exact indexed source. Persisting it still requires the
 * caller to conditionally save using the revision paired with that source.
 * A cross-element replacement inherits its first text node's formatting; later
 * matched text is removed, while all intervening markup stays byte-for-byte intact.
 */
export function applySlideTextReplacements(
	snapshot: SlideTextSearchSnapshot,
	currentSource: string,
	replacement: string,
	matchIds: "all" | readonly number[] = "all",
): string {
	if (currentSource !== snapshot.source) throw new Error("Stale slide text search snapshot")
	const ids =
		matchIds === "all" ? snapshot.matches.map((match) => match.id) : [...new Set(matchIds)]
	const escaped = replacement.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
	const patches: (SlideTextSourceRange & { value: string })[] = []
	for (const id of ids) {
		const match = snapshot.matches[id]
		if (!match || match.id !== id) throw new Error("Unknown slide text match")
		if (!match.replaceable || !match.ranges.length)
			throw new Error("Slide text match cannot be safely replaced")
		match.ranges.forEach((range, index) =>
			patches.push({ ...range, value: index === 0 ? escaped : "" }),
		)
	}
	patches.sort((left, right) => right.start - left.start)
	const parts: string[] = []
	let cursor = currentSource.length
	for (const patch of patches) {
		if (patch.start < 0 || patch.end <= patch.start || patch.end > cursor) {
			throw new Error("Overlapping or invalid slide text source ranges")
		}
		parts.push(currentSource.slice(patch.end, cursor), patch.value)
		cursor = patch.start
	}
	parts.push(currentSource.slice(0, cursor))
	return parts.reverse().join("")
}
