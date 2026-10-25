import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	INSPECTOR_DETAIL_MARKER,
	INSPECTOR_DETAIL_TYPE,
	INSPECTOR_CAPTURE_ID_MARKER,
} from "./const"

/**
 * Known label prefixes that identify inspector detail lines.
 * Covers both zh_CN and en_US translations.
 */
const KNOWN_LABELS = [
	// zh_CN
	"选择器:",
	"尺寸:",
	"计算样式:",
	"文本内容:",
	"资源信息:",
	"元素属性:",
	"DOM 上下文:",
	"元素片段:",
	"选择器匹配数:",
	// en_US
	"Selector:",
	"Size:",
	"Computed Styles:",
	"Text Content:",
	"Resource:",
	"Element Attributes:",
	"DOM Context:",
	"Element HTML:",
	"Selector Match Count:",
]

function isInspectorDetailLine(text: string): boolean {
	return (
		KNOWN_LABELS.some((label) => text.startsWith(label)) ||
		text.startsWith(INSPECTOR_CAPTURE_ID_MARKER)
	)
}

function getFirstText(node: JSONContent): string {
	if (node.type === "text" && node.text) return node.text
	if (node.content) {
		for (const child of node.content) {
			const t = getFirstText(child)
			if (t) return t
		}
	}
	return ""
}

function getOnlyMention(node: JSONContent | undefined): TiptapMentionAttributes | null {
	const content = node?.content
	if (node?.type !== "paragraph" || !Array.isArray(content) || content.length !== 1) {
		return null
	}
	const child = content[0]
	return child?.type === "mention" && child.attrs
		? (child.attrs as TiptapMentionAttributes)
		: null
}

function createInspectorParagraph(attrs: ReturnType<typeof extractInspectorAttrs>): JSONContent {
	return {
		type: "paragraph",
		content: [
			{
				type: INSPECTOR_DETAIL_TYPE,
				attrs,
			},
		],
	}
}

function parseInspectorMarker(text: string) {
	let titleText = text.slice(INSPECTOR_DETAIL_MARKER.length)
	let metadataMarkerCount = 0
	while (titleText.startsWith(INSPECTOR_DETAIL_MARKER)) {
		metadataMarkerCount += 1
		titleText = titleText.slice(INSPECTOR_DETAIL_MARKER.length)
	}

	return {
		titleText,
		inlineBefore: Boolean(metadataMarkerCount & 1),
		inlineAfter: Boolean(metadataMarkerCount & 2),
		hasFileMention: Boolean(metadataMarkerCount & 4),
		hasScreenshotMention: Boolean(metadataMarkerCount & 8),
	}
}

/**
 * Extracts inspector detail attributes from consecutive paragraphs.
 */
function extractInspectorAttrs(
	titleText: string,
	paragraphs: JSONContent[],
): {
	title: string
	selector: string
	tagName: string
	size: string
	computedStyles: string
	styleCount: number
	textContent: string
	elementAttributes: string
	resource: string
	domContext: string
	elementHtml: string
	selectorMatchCount: number
	fileMention?: TiptapMentionAttributes | null
	screenshotMention?: TiptapMentionAttributes | null
	captureId?: string | null
} {
	let selector = ""
	let size = ""
	let computedStyles = "{}"
	let styleCount = 0
	let textContent = ""
	let elementAttributes = "{}"
	let resource = ""
	let domContext = "{}"
	let elementHtml = ""
	let selectorMatchCount = -1
	let captureId = ""

	for (const p of paragraphs) {
		const text = getFirstText(p)
		// Match label by checking both locales
		if (
			text.startsWith("选择器: ") ||
			text.startsWith("选择器:") ||
			text.startsWith("Selector: ") ||
			text.startsWith("Selector:")
		) {
			selector = text.replace(/^(选择器|Selector):\s*/, "")
		} else if (
			text.startsWith("尺寸: ") ||
			text.startsWith("尺寸:") ||
			text.startsWith("Size: ") ||
			text.startsWith("Size:")
		) {
			size = text.replace(/^(尺寸|Size):\s*/, "")
		} else if (
			text.startsWith("计算样式: ") ||
			text.startsWith("计算样式:") ||
			text.startsWith("Computed Styles: ") ||
			text.startsWith("Computed Styles:")
		) {
			const raw = text.replace(/^(计算样式|Computed Styles):\s*/, "")
			// Parse "prop: val; prop: val" into JSON object
			const pairs = raw.split("; ").reduce(
				(acc, pair) => {
					const colonIdx = pair.indexOf(": ")
					if (colonIdx > 0) {
						acc[pair.slice(0, colonIdx)] = pair.slice(colonIdx + 2)
					}
					return acc
				},
				{} as Record<string, string>,
			)
			styleCount = Object.keys(pairs).length
			computedStyles = JSON.stringify(pairs)
		} else if (
			text.startsWith("文本内容: ") ||
			text.startsWith("文本内容:") ||
			text.startsWith("Text Content: ") ||
			text.startsWith("Text Content:")
		) {
			textContent = text
				.replace(/^(文本内容|Text Content):\s*/, "")
				.replace(/^"/, "")
				.replace(/"$/, "")
		} else if (text.startsWith("资源信息:") || text.startsWith("Resource:")) {
			resource = text.replace(/^(资源信息|Resource):\s*/, "")
		} else if (text.startsWith("元素属性:") || text.startsWith("Element Attributes:")) {
			elementAttributes = text.replace(/^(元素属性|Element Attributes):\s*/, "") || "{}"
		} else if (text.startsWith("DOM 上下文:") || text.startsWith("DOM Context:")) {
			domContext = text.replace(/^(DOM 上下文|DOM Context):\s*/, "") || "{}"
		} else if (text.startsWith("元素片段:") || text.startsWith("Element HTML:")) {
			elementHtml = text.replace(/^(元素片段|Element HTML):\s*/, "")
		} else if (text.startsWith("选择器匹配数:") || text.startsWith("Selector Match Count:")) {
			selectorMatchCount = Number(
				text.replace(/^(选择器匹配数|Selector Match Count):\s*/, ""),
			)
		} else if (text.startsWith(INSPECTOR_CAPTURE_ID_MARKER)) {
			captureId = text.slice(INSPECTOR_CAPTURE_ID_MARKER.length)
		}
	}

	// Extract tagName from selector (last tag before any class/id/attr)
	const tagMatch = selector.match(/(?:^|\s|>)\s*([a-z][a-z0-9]*)/i)
	const tagName = tagMatch ? tagMatch[1] : ""

	return {
		title: titleText,
		selector,
		tagName,
		size,
		computedStyles,
		styleCount,
		textContent,
		elementAttributes,
		resource,
		domContext,
		elementHtml,
		selectorMatchCount,
		captureId: captureId || undefined,
	}
}

/** 只读恢复历史段落格式；新消息使用原位 Magic Selection。 */
export function transformLegacyInspectorContent(doc: JSONContent): JSONContent {
	if (!doc.content || doc.content.length === 0) return doc

	const newContent: JSONContent[] = []
	let i = 0

	while (i < doc.content.length) {
		const node = doc.content[i]
		const text = getFirstText(node)

		// Detect the marker at the start of a paragraph
		if (node.type === "paragraph" && text.startsWith(INSPECTOR_DETAIL_MARKER)) {
			const { titleText, inlineBefore, inlineAfter, hasFileMention, hasScreenshotMention } =
				parseInspectorMarker(text)

			// Collect following detail paragraphs
			const detailParagraphs: JSONContent[] = []
			let j = i + 1

			while (j < doc.content.length) {
				const next = doc.content[j]
				const nextText = getFirstText(next)

				// Stop at empty paragraph or non-matching paragraph
				if (
					next.type !== "paragraph" ||
					!next.content ||
					next.content.length === 0 ||
					!isInspectorDetailLine(nextText)
				) {
					break
				}

				detailParagraphs.push(next)
				j++
			}

			if (detailParagraphs.length > 0) {
				// Build inspector-detail node from collected paragraphs
				const attrs = extractInspectorAttrs(titleText, detailParagraphs)

				// Remove preceding plain paragraph if it's a duplicate of the title
				// (old format stored title as a separate paragraph before the marker)
				if (newContent.length > 0) {
					const screenshotMention = getOnlyMention(newContent[newContent.length - 1])
					if (screenshotMention && hasScreenshotMention) {
						attrs.screenshotMention = screenshotMention
						newContent.pop()
					}
					const prev = newContent[newContent.length - 1]
					const fileMention = getOnlyMention(prev)
					if (fileMention && (hasFileMention || !inlineBefore)) {
						attrs.fileMention = fileMention
						newContent.pop()
					} else if (prev?.type === "paragraph" && getFirstText(prev) === titleText) {
						newContent.pop()
					}
				}

				const inspectorNode = createInspectorParagraph(attrs).content?.[0]
				if (!inspectorNode) {
					i = j
					continue
				}

				let targetParagraph: JSONContent
				const previous = newContent[newContent.length - 1]
				if (inlineBefore && previous?.type === "paragraph") {
					targetParagraph = previous
					targetParagraph.content = [...(targetParagraph.content ?? []), inspectorNode]
				} else {
					targetParagraph = createInspectorParagraph(attrs)
					newContent.push(targetParagraph)
				}

				if (inlineAfter && doc.content[j]?.type === "paragraph") {
					targetParagraph.content = [
						...(targetParagraph.content ?? []),
						...(doc.content[j].content ?? []),
					]
					i = j + 1
				} else {
					i = j
				}
			} else {
				// No detail paragraphs found, keep original (strip marker for display)
				newContent.push(node)
				i++
			}
		} else {
			newContent.push(node)
			i++
		}
	}

	return { ...doc, content: newContent }
}
