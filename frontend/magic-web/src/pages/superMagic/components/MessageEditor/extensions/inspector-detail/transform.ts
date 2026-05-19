import type { JSONContent } from "@tiptap/core"
import { INSPECTOR_DETAIL_MARKER, INSPECTOR_DETAIL_TYPE } from "./const"

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
	// en_US
	"Selector:",
	"Size:",
	"Computed Styles:",
	"Text Content:",
]

function isInspectorDetailLine(text: string): boolean {
	return KNOWN_LABELS.some((label) => text.startsWith(label))
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
} {
	let selector = ""
	let size = ""
	let computedStyles = "{}"
	let styleCount = 0
	let textContent = ""

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
		}
	}

	// Extract tagName from selector (last tag before any class/id/attr)
	const tagMatch = selector.match(/(?:^|\s|>)\s*([a-z][a-z0-9]*)/i)
	const tagName = tagMatch ? tagMatch[1] : ""

	return { title: titleText, selector, tagName, size, computedStyles, styleCount, textContent }
}

/**
 * Transforms JSONContent by detecting inspector-detail text paragraphs
 * (marked with invisible U+2063) and replacing them with a single
 * `inspector-detail` node for collapsible panel rendering.
 *
 * This allows the sent message to remain as plain text paragraphs while
 * the message list renders a rich collapsible panel.
 */
export function transformInspectorContent(doc: JSONContent): JSONContent {
	if (!doc.content || doc.content.length === 0) return doc

	const newContent: JSONContent[] = []
	let i = 0

	while (i < doc.content.length) {
		const node = doc.content[i]
		const text = getFirstText(node)

		// Detect the marker at the start of a paragraph
		if (node.type === "paragraph" && text.startsWith(INSPECTOR_DETAIL_MARKER)) {
			// Extract title text (strip the invisible marker prefix)
			const titleText = text.slice(INSPECTOR_DETAIL_MARKER.length)

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
					const prev = newContent[newContent.length - 1]
					if (prev.type === "paragraph" && getFirstText(prev) === titleText) {
						newContent.pop()
					}
				}

				newContent.push({
					type: INSPECTOR_DETAIL_TYPE,
					attrs,
				})
				i = j // Skip past the consumed paragraphs
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

/**
 * Serializes `inspector-detail` nodes back into plain text paragraphs
 * with the invisible marker prefix. This is the inverse of
 * `transformInspectorContent` and is called before sending a message
 * so that the backend/AI receives readable text.
 *
 * The title paragraph includes the marker so that renderers can later
 * detect and re-collapse the content.
 */
export function serializeInspectorContent(
	doc: JSONContent,
	labels: {
		title: string
		selector: string
		size: string
		computedStyles: string
		textContent: string
	},
): JSONContent {
	if (!doc.content || doc.content.length === 0) return doc

	const text = (s: string): JSONContent => ({ type: "text", text: s })
	const para = (...content: JSONContent[]): JSONContent => ({
		type: "paragraph",
		content,
	})

	const newContent: JSONContent[] = []

	for (const node of doc.content) {
		if (node.type === INSPECTOR_DETAIL_TYPE && node.attrs) {
			const attrs = node.attrs as {
				selector?: string
				size?: string
				computedStyles?: string
				textContent?: string
			}

			// Title with marker
			newContent.push(para(text(`${INSPECTOR_DETAIL_MARKER}${labels.title}`)))

			// Selector
			if (attrs.selector) {
				newContent.push(para(text(`${labels.selector}: ${attrs.selector}`)))
			}

			// Size
			if (attrs.size) {
				newContent.push(para(text(`${labels.size}: ${attrs.size}`)))
			}

			// Computed styles
			if (attrs.computedStyles && attrs.computedStyles !== "{}") {
				try {
					const styles = JSON.parse(attrs.computedStyles) as Record<string, string>
					const pairs = Object.entries(styles).map(([k, v]) => `${k}: ${v}`)
					if (pairs.length > 0) {
						newContent.push(para(text(`${labels.computedStyles}: ${pairs.join("; ")}`)))
					}
				} catch {
					// skip malformed styles
				}
			}

			// Text content
			if (attrs.textContent) {
				newContent.push(para(text(`${labels.textContent}: "${attrs.textContent}"`)))
			}
		} else {
			newContent.push(node)
		}
	}

	return { ...doc, content: newContent }
}
