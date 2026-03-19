import { JSONContent } from "@tiptap/core"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	MentionItemType,
	CanvasMarkerMentionData,
	TransformedCanvasMarkerMentionData,
} from "@/components/business/MentionPanel/types"

/**
 * 检查数据是否是 CanvasMarkerMentionData
 */
function isCanvasMarkerMentionData(data: unknown): data is CanvasMarkerMentionData {
	if (!data || typeof data !== "object") return false

	const markerData = data as Record<string, unknown>
	return (
		"design_project_id" in markerData &&
		"data" in markerData &&
		markerData.data !== null &&
		typeof markerData.data === "object" &&
		"id" in markerData.data &&
		"elementId" in markerData.data
	)
}

/**
 * 检查数据是否是 TransformedCanvasMarkerMentionData
 */
function isTransformedCanvasMarkerMentionData(
	data: unknown,
): data is TransformedCanvasMarkerMentionData {
	if (!data || typeof data !== "object") return false

	const transformedData = data as Record<string, unknown>
	return (
		"mark_number" in transformedData && "image" in transformedData && "label" in transformedData
	)
}

/**
 * 从 JSONContent 中递归查找所有 DESIGN_MARKER 节点
 */
function findMarkerNodes(node: JSONContent): CanvasMarkerMentionData[] {
	const markers: CanvasMarkerMentionData[] = []

	if (node.type === "mention" && node.attrs) {
		const attrs = node.attrs as TiptapMentionAttributes
		if (
			attrs.type === MentionItemType.DESIGN_MARKER &&
			attrs.data &&
			isCanvasMarkerMentionData(attrs.data)
		) {
			markers.push(attrs.data)
		}
	}

	if (node.content && Array.isArray(node.content)) {
		node.content.forEach((child) => {
			markers.push(...findMarkerNodes(child))
		})
	}

	return markers
}

/**
 * 从 content 中提取所有完整的 DESIGN_MARKER 节点
 * @param content - 消息的 content（可能是字符串或 JSONContent）
 * @returns 找到的所有 CanvasMarkerMentionData 数组
 */
export function extractAllMarkersFromContent(
	content: JSONContent | string | Record<string, unknown> | undefined,
): CanvasMarkerMentionData[] {
	if (!content) return []

	try {
		// 解析 content（可能是字符串）
		const parsedContent: JSONContent =
			typeof content === "string" ? JSON.parse(content) : (content as JSONContent)

		return findMarkerNodes(parsedContent)
	} catch (error) {
		return []
	}
}

/**
 * 从 content 中通过 mark_number 查找对应的 CanvasMarkerMentionData
 * @param content - 消息的 content（可能是字符串或 JSONContent）
 * @param markNumber - 标记编号
 * @returns 找到的 CanvasMarkerMentionData 或 null
 */
export function findMarkerByMarkNumber(
	content: JSONContent | string | Record<string, unknown> | undefined,
	markNumber: number | undefined,
): CanvasMarkerMentionData | null {
	if (!content || markNumber === undefined) return null

	try {
		// 解析 content（可能是字符串）
		const parsedContent: JSONContent =
			typeof content === "string" ? JSON.parse(content) : (content as JSONContent)

		const markers = findMarkerNodes(parsedContent)
		return markers.find((marker) => marker.mark_number === markNumber) || null
	} catch (error) {
		return null
	}
}

/**
 * 从 mention 数据中提取 mark_number
 * @param mentionData - mention 数据（可能是 CanvasMarkerMentionData 或 TransformedCanvasMarkerMentionData）
 * @returns mark_number 或 undefined
 */
export function extractMarkNumber(mentionData: unknown): number | undefined {
	if (!mentionData || typeof mentionData !== "object") return undefined

	const data = mentionData as Record<string, unknown>
	if ("mark_number" in data && typeof data.mark_number === "number") {
		return data.mark_number
	}

	return undefined
}

/**
 * 从 mention 数据中提取完整的 CanvasMarkerMentionData
 * 如果是 TransformedCanvasMarkerMentionData，会尝试从 content 中查找完整数据
 * @param mentionData - mention 数据
 * @param transformedMarkerData - 转换后的 marker 数据（可选）
 * @param content - 消息的 content（用于查找完整数据）
 * @returns 完整的 CanvasMarkerMentionData 或 null
 */
export function extractMarkerData(
	mentionData: unknown,
	transformedMarkerData: CanvasMarkerMentionData | null,
	content?: JSONContent | string | Record<string, unknown>,
): CanvasMarkerMentionData | null {
	// 优先使用转换后的数据
	if (transformedMarkerData && isCanvasMarkerMentionData(transformedMarkerData)) {
		// 检查是否有完整的 id 和 elementId
		if (transformedMarkerData.data?.id && transformedMarkerData.data?.elementId) {
			return transformedMarkerData
		}
	}

	// 如果 mentionData 本身就是 CanvasMarkerMentionData
	if (isCanvasMarkerMentionData(mentionData)) {
		return mentionData
	}

	// 如果是 TransformedCanvasMarkerMentionData，尝试从 content 中查找
	if (isTransformedCanvasMarkerMentionData(mentionData) && content) {
		const markNumber = mentionData.mark_number
		if (markNumber !== undefined) {
			return findMarkerByMarkNumber(content, markNumber)
		}
	}

	return null
}

/**
 * 从 DOM 节点和 mentions 中提取 TiptapMentionAttributes
 * 优先从 mentions 中查找，如果找不到则从 DOM 节点的 data-data 属性中解析
 * @param node - DOM 节点（.magic-mention）
 * @param mentions - 消息节点中的 mentions 数组
 * @param type - mention 类型（如 MentionItemType.DESIGN_MARKER）
 * @returns TiptapMentionAttributes 或 null
 */
export function extractMentionAttrsFromDOM(
	node: HTMLElement | null,
	mentions?: Array<{ attrs?: TiptapMentionAttributes }>,
	type?: string,
): TiptapMentionAttributes | null {
	if (!node) return null

	const attrs = node.getAttribute("data-data")
	const nodeType = node.getAttribute("data-type")

	// 如果指定了 type，检查是否匹配
	if (type && nodeType !== type) {
		return null
	}

	// 尝试从 DOM 节点的 attrs 中解析 mark_number（用于精确匹配）
	let domMarkNumber: number | undefined
	if (attrs) {
		try {
			const parsedData = JSON.parse(attrs)
			// 检查是否是 TransformedCanvasMarkerMentionData 或 CanvasMarkerMentionData
			if (parsedData && typeof parsedData === "object") {
				if ("mark_number" in parsedData) {
					domMarkNumber = parsedData.mark_number
				} else if (
					"data" in parsedData &&
					parsedData.data &&
					typeof parsedData.data === "object" &&
					"mark_number" in parsedData.data
				) {
					domMarkNumber = parsedData.data.mark_number
				}
			}
		} catch (error) {
			//
		}
	}

	// 优先从 mentions 中查找（如果有 mark_number，使用它来精确匹配）
	if (mentions && mentions.length > 0 && nodeType) {
		let mentionItem: { attrs?: TiptapMentionAttributes } | undefined

		if (domMarkNumber !== undefined) {
			// 如果有 mark_number，使用它来精确匹配
			mentionItem = mentions.find((m) => {
				if (m.attrs?.type !== nodeType || !m.attrs?.data) return false

				const data = m.attrs.data
				let mentionMarkNumber: number | undefined

				// 检查是否是 TransformedCanvasMarkerMentionData
				if (data && typeof data === "object" && "mark_number" in data) {
					mentionMarkNumber = (data as { mark_number?: number }).mark_number
				}
				// 检查是否是 CanvasMarkerMentionData
				else if (
					data &&
					typeof data === "object" &&
					"data" in data &&
					data.data &&
					typeof data.data === "object" &&
					"mark_number" in data.data
				) {
					mentionMarkNumber = (data.data as { mark_number?: number }).mark_number
				}

				const matched = mentionMarkNumber === domMarkNumber
				return matched
			})
		} else {
			// 如果没有 mark_number，使用原来的逻辑（可能匹配到第一个）
			mentionItem = mentions.find((m) => m.attrs?.type === nodeType && m.attrs?.data)
		}

		if (mentionItem?.attrs) {
			return mentionItem.attrs
		}
	}

	// 如果从 mentions 中找不到，尝试从 attrs 中解析
	if (attrs) {
		try {
			const parsedData = JSON.parse(attrs)
			if (nodeType) {
				return {
					type: nodeType as MentionItemType,
					data: parsedData,
				} as TiptapMentionAttributes
			}
		} catch (error) {
			//
		}
	}

	return null
}
