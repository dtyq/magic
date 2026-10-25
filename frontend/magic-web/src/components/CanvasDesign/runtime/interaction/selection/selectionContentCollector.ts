import type { Canvas } from "../../core/Canvas"
import { getMainContent, getUsableDownstreamImageContent } from "../../document/elementContent"
import {
	ElementTypeEnum,
	type ElementContentBase,
	type ImageElement,
	type LayerElement,
} from "../../document/types"
import type { Rect } from "../../shared/ids"
import { canSelectionRootConnect } from "./selectionConnectionGuards"

export interface SelectionContentItem {
	elementId: string
	type: LayerElement["type"]
	rootElementId: string
	activeContent?: ElementContentBase
	mainContent?: ElementContentBase
	ready: boolean
	mainReady: boolean
}

export interface SelectionContentSnapshot {
	rootElementIds: string[]
	items: SelectionContentItem[]
	/** Storyboard 等连接下游实际可消费的图片元素 ID，按文档顺序排列。 */
	imageSequence: string[]
	videoSequence: string[]
	/** 续写视频等操作使用稳定 main content 的视频 ID，按文档顺序排列。 */
	mainVideoSequence: string[]
	audioSequence: string[]
	counts: {
		image: number
		video: number
		audio: number
		text: number
	}
	boundingRect: Rect | null
	selectionRevision: string
	allRootsCanConnect: boolean
}

function getChildren(element: LayerElement | undefined): LayerElement[] {
	if (!element || !("children" in element) || !Array.isArray(element.children)) return []
	return element.children
}

function isContainer(element: LayerElement): boolean {
	return element.type === ElementTypeEnum.Frame || element.type === ElementTypeEnum.Group
}

function getEffectiveContent(
	canvas: Canvas,
	element: LayerElement,
): ElementContentBase | undefined {
	return canvas.getEffectiveContent(element.id)
}

function isReadyMedia(canvas: Canvas, element: LayerElement): boolean {
	if (element.type === ElementTypeEnum.Audio) {
		const content = getEffectiveContent(canvas, element)
		return Boolean(
			content && "src" in content && typeof content.src === "string" && content.src,
		)
	}
	if (element.type === ElementTypeEnum.Image) {
		const content = getEffectiveContent(canvas, element)
		return Boolean(
			content &&
			"src" in content &&
			typeof content.src === "string" &&
			content.src &&
			(content.status === undefined || content.status === "completed"),
		)
	}

	if (element.type !== ElementTypeEnum.Video) return true
	const content = getEffectiveContent(canvas, element)
	if (!content || !("src" in content) || typeof content.src !== "string" || !content.src) {
		return false
	}
	return content.status === undefined || content.status === "completed"
}

function isReadyVideoMainContent(element: LayerElement): boolean {
	if (element.type !== ElementTypeEnum.Video) return false
	const content = getMainContent(element)
	return Boolean(
		content &&
		"src" in content &&
		typeof content.src === "string" &&
		content.src &&
		(content.status === undefined || content.status === "completed"),
	)
}

function isUsableDownstreamImage(element: LayerElement): boolean {
	if (element.type !== ElementTypeEnum.Image) return false
	return Boolean(getUsableDownstreamImageContent(element as ImageElement))
}

function createDocumentOrderMap(canvas: Canvas): Map<string, number> {
	const order = new Map<string, number>()
	let index = 0
	const visit = (element: LayerElement): void => {
		if (order.has(element.id)) return
		order.set(element.id, index++)
		const latest = canvas.elementManager.getElementData(element.id) ?? element
		getChildren(latest).forEach(visit)
	}
	canvas.elementManager.getAllElements().forEach(visit)
	return order
}

export function createSelectionRevision(elementIds: readonly string[]): string {
	return Array.from(new Set(elementIds)).sort().join("\u0000")
}

/**
 * 将当前选择转换成一次性的内容快照。容器作为选择根参与连接，容器子项只用于
 * 识别创建场景和初始化目标节点的媒体序列。
 */
export function collectSelectionContentSnapshot(
	canvas: Canvas,
	selectedElementIds: string[],
	boundingRect?: Rect | null,
): SelectionContentSnapshot {
	const documentOrder = createDocumentOrderMap(canvas)
	const rootElementIds = Array.from(new Set(selectedElementIds))
		.filter((elementId) => canvas.elementManager.hasElement(elementId))
		.sort(
			(left, right) =>
				(documentOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
				(documentOrder.get(right) ?? Number.MAX_SAFE_INTEGER),
		)

	const items: SelectionContentItem[] = []
	const imageSequence: string[] = []
	const visited = new Set<string>()
	const visit = (element: LayerElement, rootElementId: string): void => {
		if (visited.has(element.id)) return
		visited.add(element.id)

		const latest = canvas.elementManager.getElementData(element.id) ?? element
		if (latest.visible === false) return
		if (isContainer(latest)) {
			getChildren(latest).forEach((child) => visit(child, rootElementId))
			return
		}

		const content = getEffectiveContent(canvas, latest)
		const mainContent = getMainContent(latest)
		items.push({
			elementId: latest.id,
			type: latest.type,
			rootElementId,
			activeContent: content,
			ready: isReadyMedia(canvas, latest),
			mainContent,
			mainReady: isReadyVideoMainContent(latest),
		})
		if (isUsableDownstreamImage(latest)) imageSequence.push(latest.id)
	}

	rootElementIds.forEach((elementId) => {
		const element = canvas.elementManager.getElementData(elementId)
		if (element) visit(element, elementId)
	})

	const videoSequence = items
		.filter((item) => item.type === ElementTypeEnum.Video && item.ready)
		.map((item) => item.elementId)
	const mainVideoSequence = items
		.filter((item) => item.type === ElementTypeEnum.Video && item.mainReady)
		.map((item) => item.elementId)
	const audioSequence = items
		.filter((item) => item.type === ElementTypeEnum.Audio && item.ready)
		.map((item) => item.elementId)

	return {
		rootElementIds,
		items,
		imageSequence,
		videoSequence,
		mainVideoSequence,
		audioSequence,
		counts: {
			image: items.filter((item) => item.type === ElementTypeEnum.Image).length,
			video: items.filter((item) => item.type === ElementTypeEnum.Video).length,
			audio: items.filter((item) => item.type === ElementTypeEnum.Audio).length,
			text: items.filter((item) => item.type === ElementTypeEnum.Text).length,
		},
		boundingRect:
			boundingRect ??
			(rootElementIds.length > 0
				? canvas.elementManager.getNodeAdapter().getElementsBounds(rootElementIds)
				: null),
		selectionRevision: createSelectionRevision(rootElementIds),
		allRootsCanConnect: rootElementIds.every((elementId) =>
			canSelectionRootConnect(canvas, elementId),
		),
	}
}
