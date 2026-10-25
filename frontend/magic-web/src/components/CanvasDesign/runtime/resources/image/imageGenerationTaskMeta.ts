import type { ImageElement as ImageElementData } from "../../document/types"
import type {
	EraserRequest,
	GenerateExtendedImageRequest,
	GenerateHightImageRequest,
	ImageGenerationTaskMeta,
	RemoveBackgroundRequest,
} from "../../../public/magic-types"
import { ImageGenerationTaskTypeMap } from "../../../public/magic-types"
import { getActiveImageContent } from "../../document/elementContent"

export function createBatchImageTaskMeta({
	imageId,
	outputIndex,
	outputCount,
}: {
	imageId: string
	outputIndex: number
	outputCount: number
}): ImageGenerationTaskMeta {
	return {
		type: ImageGenerationTaskTypeMap.Batch,
		image_id: imageId,
		output_index: outputIndex,
		output_count: outputCount,
	}
}

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
	element: ImageElementData,
): ImageGenerationTaskMeta | undefined {
	return getActiveImageContent(element).imageGenerationTaskMeta
}

export function isBatchImageGenerationTaskMeta(
	meta: ImageGenerationTaskMeta | undefined,
): meta is ImageGenerationTaskMeta & {
	image_id: string
	output_index: number
	output_count: number
} {
	return (
		meta?.type === ImageGenerationTaskTypeMap.Batch &&
		typeof meta.image_id === "string" &&
		meta.image_id.length > 0 &&
		typeof meta.output_index === "number" &&
		Number.isFinite(meta.output_index) &&
		meta.output_index > 0 &&
		typeof meta.output_count === "number" &&
		Number.isFinite(meta.output_count) &&
		meta.output_count > 0
	)
}
