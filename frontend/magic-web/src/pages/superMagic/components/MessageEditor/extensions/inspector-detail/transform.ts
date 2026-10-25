import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { INSPECTOR_DETAIL_TYPE } from "./const"
import type { InspectorDetailAttrs } from "./types"
import { transformLegacyInspectorContent } from "./legacy-transform"
import { restoreSelection, serializeSelection } from "./serialization"

/** 保留用户节点顺序、段落及主动换行，仅在原位置投影引用资料。 */
export function serializeInspectorContent(doc: JSONContent): JSONContent {
	if (!doc.content) return doc
	return {
		...doc,
		content: doc.content.flatMap((node) =>
			node.type === INSPECTOR_DETAIL_TYPE && node.attrs
				? serializeSelection(node.attrs as InspectorDetailAttrs)
				: [serializeInspectorContent(node)],
		),
	}
}

function restoreInlineContent(content: JSONContent[]): JSONContent[] {
	const positions: Array<{ node: JSONContent; start: number; end: number }> = []
	let text = ""
	for (const node of content) {
		const start = text.length
		text += node.type === "text" ? (node.text ?? "") : "\ufffc"
		positions.push({ node, start, end: text.length })
	}
	const slice = (start: number, end: number) =>
		positions.flatMap(({ node, start: nodeStart, end: nodeEnd }) => {
			if (nodeEnd <= start || nodeStart >= end) return []
			if (node.type !== "text") return [node]
			const value = (node.text ?? "").slice(
				Math.max(start, nodeStart) - nodeStart,
				Math.min(end, nodeEnd) - nodeStart,
			)
			return value ? [{ ...node, text: value }] : []
		})
	const result: JSONContent[] = []
	let cursor = 0
	for (const match of text.matchAll(/<magic-selection>([\s\S]*?)<\/magic-selection>/g)) {
		const start = match.index ?? 0
		const end = start + match[0].length
		const attrs = restoreSelection(
			slice(start + "<magic-selection>".length, end - "</magic-selection>".length),
		)
		if (!attrs) continue
		result.push(...slice(cursor, start), { type: INSPECTOR_DETAIL_TYPE, attrs })
		cursor = end
	}
	return cursor ? [...result, ...slice(cursor, text.length)] : content
}

/** 新消息在同一段内恢复；旧格式继续读取，不改写历史存储。 */
export function transformInspectorContent(doc: JSONContent): JSONContent {
	if (!doc.content) return doc
	const restored = {
		...doc,
		content: restoreInlineContent(doc.content.map(transformInspectorContent)),
	}
	return transformLegacyInspectorContent(restored)
}
