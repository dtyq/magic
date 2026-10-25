import type {
	MarkdownSelectionBlockType,
	MarkdownSelectionSource,
} from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/types"

export interface SourceReplacement {
	sourceStart: number
	sourceEnd: number
	start: number
	end: number
}

export interface MarkdownSourceSnapshot {
	source: string
	content: string
	replacements: SourceReplacement[]
}

/** 替换区间内只能定位到完整原文块；区间外按累计长度差精确还原。 */
export function mapSourceRange(start: number, end: number, replacements: SourceReplacement[]) {
	const mapOffset = (offset: number, isEnd: boolean): number => {
		let delta = 0
		for (const range of replacements) {
			if (offset <= range.start) break
			if (offset < range.end) return isEnd ? range.sourceEnd : range.sourceStart
			delta = range.sourceEnd - range.end
		}
		return offset + delta
	}
	return { start: mapOffset(start, false), end: mapOffset(end, true) }
}

export const SOURCE_START = "data-markdown-source-start"
export const SOURCE_END = "data-markdown-source-end"
export const SOURCE_KIND = "data-markdown-source-kind"
const SOURCE_EXCERPT_LIMIT = 4000
const TARGET_EXCERPT_LIMIT = 1000
const SEMANTIC_SELECTOR =
	"img,a,td,th,pre,h1,h2,h3,h4,h5,h6,li,blockquote,p,[data-markdown-source-start]"

export function getMarkdownSelectionTarget(root: HTMLElement, target: EventTarget | null) {
	if (!(target instanceof Element)) return null
	let element = target.closest<HTMLElement>(SEMANTIC_SELECTOR)
	if (!element || !root.contains(element)) return null
	// 单元格内的段落属于单元格；图片、链接仍可单独选取。
	if (!element.matches("img,a"))
		element =
			element.closest<HTMLElement>("td,th") ??
			(element.matches("p") ? (element.closest<HTMLElement>("li") ?? element) : element)
	const located = element.closest<HTMLElement>(`[${SOURCE_START}][${SOURCE_END}]`)
	return located && root.contains(located) ? { element, located } : null
}

function excerpt(value: string, limit: number) {
	const characters: string[] = []
	for (const character of value) {
		if (characters.length === limit) return { text: characters.join(""), truncated: true }
		characters.push(character)
	}
	return { text: characters.join(""), truncated: false }
}

function sourceLine(source: string, offset: number): number {
	let line = 1
	let index = source.indexOf("\n")
	while (index >= 0 && index < offset) {
		line += 1
		index = source.indexOf("\n", index + 1)
	}
	return line
}

export function readMarkdownSelection(
	root: HTMLElement,
	element: HTMLElement,
	located: HTMLElement,
	snapshot: MarkdownSourceSnapshot,
): MarkdownSelectionSource | null {
	const processedStart = Number(located.getAttribute(SOURCE_START))
	const processedEnd = Number(located.getAttribute(SOURCE_END))
	if (
		!Number.isInteger(processedStart) ||
		!Number.isInteger(processedEnd) ||
		processedStart < 0 ||
		processedEnd <= processedStart ||
		processedEnd > snapshot.content.length
	)
		return null
	const { start, end } = mapSourceRange(processedStart, processedEnd, snapshot.replacements)
	if (start < 0 || end > snapshot.source.length || end <= start) return null
	const tag = element.tagName.toLowerCase()
	const types: Record<string, MarkdownSelectionBlockType> = {
		p: "paragraph",
		li: "list-item",
		blockquote: "blockquote",
		td: "table-cell",
		th: "table-cell",
		pre: "code-block",
		img: "image",
		a: "link",
	}
	const blockType = /^h[1-6]$/.test(tag)
		? "heading"
		: (types[tag] ??
			(located.getAttribute(SOURCE_KIND) === "code-block" ? "code-block" : "html-block"))
	const path: string[] = []
	for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
		path.unshift(
			`${node.tagName.toLowerCase()}[${Array.from(node.parentElement?.children ?? []).indexOf(node) + 1}]`,
		)
	}
	const source = excerpt(snapshot.source.slice(start, end), SOURCE_EXCERPT_LIMIT)
	const textElement =
		blockType === "code-block" ? (element.querySelector("pre,code") ?? element) : element
	const target = excerpt(
		element instanceof HTMLImageElement
			? element.alt || element.getAttribute("src") || ""
			: (textElement.textContent ?? ""),
		TARGET_EXCERPT_LIMIT,
	)
	const cell = element instanceof HTMLTableCellElement ? element : null
	const row = cell?.parentElement
	return {
		start,
		end,
		startLine: sourceLine(snapshot.source, start),
		endLine: sourceLine(snapshot.source, Math.max(start, end - 1)),
		blockType,
		blockPath: path.join(" > "),
		sourceText: source.text,
		sourceTextTruncated: source.truncated,
		targetText: target.text,
		targetTextTruncated: target.truncated,
		...(cell && row
			? {
					tableCell: {
						row:
							Array.from(row.parentElement?.children ?? [])
								.filter((sibling) =>
									sibling.querySelector(tag === "th" ? "th" : "td"),
								)
								.indexOf(row) + 1,
						column: cell.cellIndex + 1,
						header: tag === "th",
					},
				}
			: {}),
	}
}
