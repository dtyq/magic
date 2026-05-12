import type { Canvas } from "../../canvas/Canvas"
import { VideoElement as VideoElementClass } from "../../canvas/element/elements/VideoElement"
import { ElementTypeEnum, type VideoElement } from "../../canvas/types"
import { calculateNewElementPosition, generateElementId } from "../../canvas/utils/utils"
import type { GenerateVideoRequest } from "../../types.magic"

interface CreateAndSubmitVideoGenerationOptions {
	canvas: Canvas | null | undefined
	sourceVideoElement: VideoElement
	request: GenerateVideoRequest
}

export async function createAndSubmitVideoGeneration(
	options: CreateAndSubmitVideoGenerationOptions,
): Promise<boolean> {
	const { canvas, sourceVideoElement, request } = options
	if (!canvas || !request.model_id || !request.prompt?.trim()) {
		return false
	}

	const sourceElementInstance = canvas.elementManager.getElementInstance(sourceVideoElement.id)
	if (!(sourceElementInstance instanceof VideoElementClass)) {
		return false
	}

	const newPosition = calculateNewElementPosition(
		sourceVideoElement,
		sourceElementInstance,
		canvas.elementManager,
	)
	if (!newPosition) {
		return false
	}

	const newElementId = generateElementId()
	const newZIndex = canvas.elementManager.getNextZIndexInLevel()
	const size = VideoElementClass.getDefaultConfig(
		sourceVideoElement.width,
		sourceVideoElement.height,
	)

	const newVideoElement: VideoElement = {
		id: newElementId,
		type: ElementTypeEnum.Video,
		x: newPosition.x,
		y: newPosition.y,
		...size,
		zIndex: newZIndex,
	}

	canvas.elementManager.create(newVideoElement)
	canvas.selectionManager.select(newElementId)

	const newElementInstance = canvas.elementManager.getElementInstance(newElementId)
	if (!(newElementInstance instanceof VideoElementClass)) {
		return false
	}

	const requestToSubmit: GenerateVideoRequest = {
		...request,
		prompt: request.prompt.trim(),
	}
	newElementInstance.saveTempGenerateVideoRequest(requestToSubmit)

	return newElementInstance.generateVideo(requestToSubmit)
}
