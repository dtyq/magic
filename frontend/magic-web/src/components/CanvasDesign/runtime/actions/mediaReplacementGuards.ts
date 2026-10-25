import type { Canvas } from "../core/Canvas"
import { getCanvasElementChildren } from "../document/elementIndex"
import { ElementTypeEnum, type LayerElement } from "../document/types"

function isMediaElement(element: LayerElement): boolean {
	return (
		element.type === ElementTypeEnum.Image ||
		element.type === ElementTypeEnum.Video ||
		element.type === ElementTypeEnum.Audio
	)
}

export function containsReplacingMedia(
	canvas: Canvas,
	elements: Array<LayerElement | undefined>,
): boolean {
	const visitedIds = new Set<string>()
	const visit = (element: LayerElement | undefined): boolean => {
		if (!element || visitedIds.has(element.id)) return false
		visitedIds.add(element.id)
		if (
			isMediaElement(element) &&
			(canvas.mediaReplaceController?.isReplacing?.(element.id) ?? false)
		) {
			return true
		}
		return getCanvasElementChildren(element)?.some(visit) ?? false
	}

	return elements.some(visit)
}

export function selectionContainsReplacingMedia(canvas: Canvas): boolean {
	return containsReplacingMedia(
		canvas,
		canvas.selectionManager
			.getSelectedIds()
			.map((elementId) => canvas.elementManager.getElementData(elementId)),
	)
}

export function isElementReplacing(canvas: Canvas, elementId?: string | null): boolean {
	return Boolean(elementId && canvas.mediaReplaceController?.isReplacing?.(elementId))
}
