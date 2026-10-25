import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type { MagicNodeDragOptions } from "../node-drag"

export type MarkdownSelectionBlockType =
	| "heading"
	| "paragraph"
	| "list-item"
	| "blockquote"
	| "table-cell"
	| "code-block"
	| "image"
	| "link"
	| "html-block"

export interface MarkdownSelectionSource {
	/** 原文 UTF-16 区间 [start, end)，不使用处理后文本或 DOM 字符位置。 */
	start: number
	end: number
	startLine: number
	endLine: number
	blockType: MarkdownSelectionBlockType
	blockPath: string
	sourceText: string
	sourceTextTruncated: boolean
	targetText: string
	targetTextTruncated: boolean
	/** 行、列均从 1 开始；表头与数据行分别计数，不计 Markdown 分隔线。 */
	tableCell?: { row: number; column: number; header: boolean }
}

export interface InspectorDetailAttrs {
	/** 旧节点没有来源类型，按 HTML 读取。Markdown 不填充虚构的 DOM／截图资料。 */
	sourceType?: "html" | "markdown"
	markdownSource?: MarkdownSelectionSource | null
	/** Title paragraph content (context description shown above detail) */
	title: string
	/** CSS selector path */
	selector: string
	/** Element tag name (e.g. "div", "button") */
	tagName: string
	/** Formatted size string (e.g. "120 × 40 px") */
	size: string
	/** JSON-serialized computed style key-value pairs */
	computedStyles: string
	/** Number of non-trivial style properties */
	styleCount: number
	/** Truncated text content preview */
	textContent: string
	/** JSON-serialized element attributes */
	elementAttributes?: string
	/** Normalized resource URL/path */
	resource?: string
	/** JSON-serialized DOM position and sibling context */
	domContext?: string
	/** Sanitized, truncated outerHTML snippet */
	elementHtml?: string
	/** Number of elements matched by selector */
	selectorMatchCount?: number
	/** Optional source file mention for the inspected HTML file. */
	fileMention?: TiptapMentionAttributes | null
	/** Optional screenshot mention rendered inside the inspector detail card. */
	screenshotMention?: TiptapMentionAttributes | null
	/** Unique capture id; also the IndexedDB key for the local screenshot. */
	captureId?: string | null
}

export type InspectorDetailOptions = MagicNodeDragOptions

declare module "@/infrastructure/editors/tiptap/core" {
	interface Commands<ReturnType> {
		inspectorDetail: {
			insertInspectorDetail: (attrs: InspectorDetailAttrs) => ReturnType
		}
	}
}
