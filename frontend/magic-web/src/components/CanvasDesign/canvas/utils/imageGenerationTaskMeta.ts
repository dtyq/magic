import type { ImageElement as ImageElementData } from "../types"
import type {
	EraserRequest,
	GenerateExtendedImageRequest,
	GenerateHightImageRequest,
	ImageGenerationTaskMeta,
	RemoveBackgroundRequest,
} from "../../types.magic"
import { ImageGenerationTaskTypeMap } from "../../types.magic"

export function createHighImageTaskMeta(
	request: GenerateHightImageRequest,
): ImageGenerationTaskMeta {
	return {
		type: ImageGenerationTaskTypeMap.High,
		image_id: request.image_id,
		file_path: request.file_path,
		size: request.size,
		reference_image_options: request.reference_image_options,
	}
}

export function createRemoveBackgroundTaskMeta(
	request: RemoveBackgroundRequest,
): ImageGenerationTaskMeta {
	return {
		type: ImageGenerationTaskTypeMap.RemoveBackground,
		image_id: request.image_id,
		file_path: request.file_path,
		size: request.size,
		reference_image_options: request.reference_image_options,
	}
}

export function createEraserTaskMeta(request: EraserRequest): ImageGenerationTaskMeta {
	return {
		type: ImageGenerationTaskTypeMap.Eraser,
		image_id: request.image_id,
		file_path: request.file_path,
		mark_path: request.mark_path,
		size: request.size,
		reference_image_options: request.reference_image_options,
	}
}

export function createExpandImageTaskMeta(
	request: GenerateExtendedImageRequest,
): ImageGenerationTaskMeta {
	return {
		type: ImageGenerationTaskTypeMap.Expand,
		image_id: request.image_id,
		file_path: request.file_path,
		canvas_path: request.canvas_path,
		mask_path: request.mask_path,
		size: request.size,
		reference_image_options: request.reference_image_options,
	}
}

export function getLegacyHighImageTaskMeta(
	request?: GenerateHightImageRequest,
): ImageGenerationTaskMeta | undefined {
	if (!request) return undefined

	return {
		type: ImageGenerationTaskTypeMap.High,
		image_id: request.image_id,
		file_path: request.file_path,
		size: request.size,
		reference_image_options: request.reference_image_options,
	}
}

export function getImageGenerationTaskMeta(
	element: Pick<ImageElementData, "imageGenerationTaskMeta" | "generateHightImageRequest">,
): ImageGenerationTaskMeta | undefined {
	return (
		element.imageGenerationTaskMeta ||
		getLegacyHighImageTaskMeta(element.generateHightImageRequest)
	)
}
