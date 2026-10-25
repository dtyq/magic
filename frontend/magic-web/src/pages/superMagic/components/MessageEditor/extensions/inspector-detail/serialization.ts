import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { INSPECTOR_CAPTURE_ID_MARKER } from "./const"
import type { InspectorDetailAttrs, MarkdownSelectionBlockType } from "./types"

export const SELECTION_START = "<magic-selection>"
export const SELECTION_END = "</magic-selection>"

/** 粘贴和长文本分流共用识别入口；字段及文件身份仍由恢复器校验。 */
export function hasSerializedSelection(text: string): boolean {
	return /<magic-selection>[\s\S]*?<\/magic-selection>/.test(text)
}

/** 只将引用变为单行；HTML、引号及 & 保留原值，不按 XML 编码。 */
export function encodeSelectionText(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r")
}

export function decodeSelectionText(value: string): string {
	return value.replace(/\\([\\nr])/g, (_, character: string) =>
		character === "n" ? "\n" : character === "r" ? "\r" : "\\",
	)
}

// 发送和复制都须将 File／Screenshot 转成可定位链接；内部 ID 不能代替模型正文中的路径。
export function serializeSelection(attrs: InspectorDetailAttrs): JSONContent[] {
	const nodes: JSONContent[] = [{ type: "text", text: SELECTION_START }]
	let first = true
	const field = (label: string, value: string) => {
		nodes.push({
			type: "text",
			text: encodeSelectionText(`${first ? "" : "\n"}${label}: ${value}`),
		})
		first = false
	}
	const mention = (label: string, value?: TiptapMentionAttributes | null) => {
		if (!value) return
		field(label, "")
		nodes.push({ type: "mention", attrs: value })
	}
	field("Type", attrs.sourceType ?? "html")
	mention("File", attrs.fileMention)
	if (attrs.selector) field("Selector", attrs.selector)
	if (attrs.selectorMatchCount !== undefined && attrs.selectorMatchCount >= 0)
		field("Selector Match Count", String(attrs.selectorMatchCount))
	if (attrs.size) field("Size", attrs.size)
	if (attrs.computedStyles && attrs.computedStyles !== "{}") {
		try {
			field(
				"Computed Styles",
				Object.entries(JSON.parse(attrs.computedStyles) as Record<string, string>)
					.map(([key, value]) => `${key}: ${value}`)
					.join("; "),
			)
		} catch {
			field("Computed Styles", attrs.computedStyles)
		}
	}
	if (attrs.resource) field("Resource", attrs.resource)
	if (attrs.elementAttributes && attrs.elementAttributes !== "{}")
		field("Element Attributes", attrs.elementAttributes)
	if (attrs.domContext && attrs.domContext !== "{}") field("DOM Context", attrs.domContext)
	if (attrs.elementHtml) field("Element HTML", attrs.elementHtml)
	const source = attrs.markdownSource
	if (attrs.sourceType === "markdown" && source) {
		field("Source Lines", `${source.startLine}-${source.endLine}`)
		field("Source Range", `${source.start}-${source.end} (UTF-16, end exclusive)`)
		field("Target", source.blockType)
		field("Block Path", source.blockPath)
		if (source.tableCell)
			field(
				"Table Cell",
				`${source.tableCell.header ? "header" : "data"} row ${source.tableCell.row}; column ${source.tableCell.column}`,
			)
		field("Text Content", `"${source.targetText}"`)
		field("Source Markdown", source.sourceText)
		if (source.sourceTextTruncated)
			field("Source Truncated", "true; read the file for the complete source")
		if (source.targetTextTruncated)
			field("Target Truncated", "true; read the file for the complete target")
	} else if (attrs.textContent) field("Text Content", `"${attrs.textContent}"`)
	mention("Screenshot", attrs.screenshotMention)
	if (attrs.captureId)
		nodes.push({
			type: "text",
			text: encodeSelectionText(`\n${INSPECTOR_CAPTURE_ID_MARKER}${attrs.captureId}`),
		})
	nodes.push({ type: "text", text: SELECTION_END })
	return nodes
}

const FIELD_LABELS = [
	"Type",
	"File",
	"Selector",
	"Selector Match Count",
	"Size",
	"Computed Styles",
	"Resource",
	"Element Attributes",
	"DOM Context",
	"Element HTML",
	"Source Lines",
	"Source Range",
	"Target",
	"Block Path",
	"Table Cell",
	"Text Content",
	"Source Markdown",
	"Source Truncated",
	"Target Truncated",
	"Screenshot",
]
const BLOCK_TYPES: MarkdownSelectionBlockType[] = [
	"heading",
	"paragraph",
	"list-item",
	"blockquote",
	"table-cell",
	"code-block",
	"image",
	"link",
	"html-block",
]

/** 外层已经由固定正则提取。内部是可读资料，不交给 XML parser。 */
export function restoreSelection(content: JSONContent[]): InspectorDetailAttrs | null {
	let encoded = ""
	const mentions = new Map<number, TiptapMentionAttributes>()
	for (const node of content) {
		if (node.type === "text") encoded += node.text ?? ""
		else if (node.type === "mention" && node.attrs) {
			mentions.set(encoded.length, node.attrs as TiptapMentionAttributes)
			encoded += "\ufffc"
		} else return null
	}
	const body = decodeSelectionText(encoded)
	const matches = [...body.matchAll(new RegExp(`(?:^|\\n)(${FIELD_LABELS.join("|")}): `, "g"))]
	const fields: Record<string, string> = {}
	for (let index = 0; index < matches.length; index++) {
		const match = matches[index]
		fields[match[1]] = body.slice(
			(match.index ?? 0) + match[0].length,
			matches[index + 1]?.index ?? body.length,
		)
	}
	if (fields.Type !== "html" && fields.Type !== "markdown") return null
	const captureIndex = body.lastIndexOf(`\n${INSPECTOR_CAPTURE_ID_MARKER}`)
	const captureId =
		captureIndex >= 0
			? body.slice(captureIndex + 1 + INSPECTOR_CAPTURE_ID_MARKER.length)
			: undefined
	const last = matches.at(-1)
	if (captureId && last) {
		fields[last[1]] = body.slice((last.index ?? 0) + last[0].length, captureIndex)
	}
	const findMention = (label: string) => {
		const match = new RegExp(`(?:^|\\\\n)${label}: `).exec(encoded)
		return match ? (mentions.get(match.index + match[0].length) ?? null) : null
	}
	// 没有真实 mention 时保留完整原文，不能折叠后丢掉文件或截图链接。
	if (
		(fields.File !== undefined && !findMention("File")) ||
		(fields.Screenshot !== undefined && !findMention("Screenshot"))
	)
		return null
	const text = (fields["Text Content"] ?? "").replace(/^"([\s\S]*)"$/, "$1")
	const styles: Record<string, string> = {}
	for (const pair of (fields["Computed Styles"] ?? "").split("; ")) {
		const separator = pair.indexOf(": ")
		if (separator >= 0) styles[pair.slice(0, separator)] = pair.slice(separator + 2)
	}
	const attrs: InspectorDetailAttrs = {
		sourceType: fields.Type,
		title: "",
		selector: fields.Selector ?? "",
		tagName: "",
		size: fields.Size ?? "",
		computedStyles: JSON.stringify(styles),
		styleCount: Object.keys(styles).length,
		textContent: text,
		resource: fields.Resource ?? "",
		elementAttributes: fields["Element Attributes"] ?? "{}",
		domContext: fields["DOM Context"] ?? "{}",
		elementHtml: fields["Element HTML"] ?? "",
		selectorMatchCount:
			fields["Selector Match Count"] === undefined
				? -1
				: Number(fields["Selector Match Count"]),
		fileMention: findMention("File"),
		screenshotMention: findMention("Screenshot"),
		captureId,
	}
	attrs.tagName = attrs.selector.match(/(?:^|\s|>)\s*([a-z][a-z0-9]*)/i)?.[1] ?? ""
	if (fields.Type === "markdown") {
		const range = fields["Source Range"]?.match(/^(\d+)-(\d+)/)
		const lines = fields["Source Lines"]?.match(/^(\d+)-(\d+)$/)
		const blockType = fields.Target as MarkdownSelectionBlockType
		if (!range || !lines || !BLOCK_TYPES.includes(blockType)) return null
		const cell = fields["Table Cell"]?.match(/^(header|data) row (\d+); column (\d+)$/)
		attrs.markdownSource = {
			start: Number(range[1]),
			end: Number(range[2]),
			startLine: Number(lines[1]),
			endLine: Number(lines[2]),
			blockType,
			blockPath: fields["Block Path"] ?? "",
			targetText: text,
			sourceText: fields["Source Markdown"] ?? "",
			sourceTextTruncated: fields["Source Truncated"]?.startsWith("true") ?? false,
			targetTextTruncated: fields["Target Truncated"]?.startsWith("true") ?? false,
			...(cell
				? {
						tableCell: {
							header: cell[1] === "header",
							row: Number(cell[2]),
							column: Number(cell[3]),
						},
					}
				: {}),
		}
	}
	return attrs
}
