import type { Canvas } from "../../core/Canvas"
import { VideoEditElement } from "../../elements/video-edit/VideoEditElement"
import { generateElementId } from "../../shared/ids"
import type { SelectionContentSnapshot } from "../selection/selectionContentCollector"
import { createElementFromSelectionConnection } from "./selectionConnectionCreation"

export function getVideoEditSelectionCreateSize(): { width: number; height: number } {
	const config = VideoEditElement.getDefaultConfig()
	return { width: config.width, height: config.height }
}

export interface CreateVideoEditFromSelectionOptions {
	snapshot: SelectionContentSnapshot
	x: number
	y: number
}

export function createVideoEditFromSelection(
	context: CreateVideoEditFromSelectionOptions & { canvas: Canvas },
): string | null {
	const { canvas, snapshot } = context
	if (snapshot.videoSequence.length < 2 || !snapshot.allRootsCanConnect) return null

	return createElementFromSelectionConnection({
		canvas,
		snapshot,
		originSide: "right",
		createElement: () => {
			const elementId = generateElementId()
			const element = VideoEditElement.createElementData({
				id: elementId,
				x: context.x,
				y: context.y,
				zIndex: canvas.elementManager.getNextZIndexInLevel(),
			})

			canvas.elementManager.create(element)
			return elementId
		},
		afterConnect: ({ createdElementId: elementId }) => {
			canvas.selectionManager.select(elementId)
			requestAnimationFrame(() => {
				if (!canvas.elementManager.hasElement(elementId)) return
				if (canvas.viewportController.isElementInViewport([elementId])) return
				canvas.viewportController.moveElementToViewport([elementId], {
					animated: true,
					padding: { top: 50, right: 50, bottom: 50, left: 100 },
				})
			})
		},
	})
}
