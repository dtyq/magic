import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum } from "../../document/types"
import { VideoEditElement } from "../../elements/video-edit/VideoEditElement"
import { generateElementId } from "../../shared/ids"
import type { ConnectionOrigin } from "../../shared/connectionOrigin"
import { createElementFromElementConnection } from "./elementConnectionCreation"
import { canSelectionRootConnect } from "../selection/selectionConnectionGuards"

type ElementConnectionOrigin = Extract<ConnectionOrigin, { kind: "element" }>

/** The single-audio shortcut creates an editor; composition remains an explicit node action. */
export function canCreateVideoEditFromAudioConnection(
	canvas: Canvas | null | undefined,
	origin: ConnectionOrigin | null | undefined,
): origin is ElementConnectionOrigin {
	if (!canvas || !origin || origin.kind !== "element" || origin.side !== "right") return false
	return (
		canvas.elementManager.getElementData(origin.elementId)?.type === ElementTypeEnum.Audio &&
		canSelectionRootConnect(canvas, origin.elementId)
	)
}

export function getVideoEditConnectionCreateSize(): { width: number; height: number } {
	const config = VideoEditElement.getDefaultConfig()
	return { width: config.width, height: config.height }
}

export function createVideoEditFromAudioConnection(options: {
	canvas: Canvas
	origin: ElementConnectionOrigin
	x: number
	y: number
}): string | null {
	const { canvas, origin } = options
	if (!canCreateVideoEditFromAudioConnection(canvas, origin)) return null

	return createElementFromElementConnection({
		canvas,
		origin,
		createElement: () => {
			const elementId = generateElementId()
			canvas.elementManager.create(
				VideoEditElement.createElementData({
					id: elementId,
					x: options.x,
					y: options.y,
					zIndex: canvas.elementManager.getNextZIndexInLevel(),
				}),
			)
			return elementId
		},
		afterConnect: ({ createdElementId }) => {
			canvas.selectionManager.select(createdElementId)
			requestAnimationFrame(() => {
				if (!canvas.elementManager.hasElement(createdElementId)) return
				if (canvas.viewportController.isElementInViewport([createdElementId])) return
				canvas.viewportController.moveElementToViewport([createdElementId], {
					animated: true,
					padding: { top: 50, right: 50, bottom: 50, left: 100 },
				})
			})
		},
	})
}
