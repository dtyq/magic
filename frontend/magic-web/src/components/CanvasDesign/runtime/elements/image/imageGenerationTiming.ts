import type { ImageElementContent } from "../../document/types"
import { IMAGE_CONFIG } from "./ImageElement.config"

export type ImageGenerationTiming = NonNullable<ImageElementContent["generationTiming"]>

export function getImageGenerationId(content: ImageElementContent): string | undefined {
	return content.generateImageRequest?.image_id ?? content.imageGenerationTaskMeta?.image_id
}

/** 已有结果和真实终态优先；前端等待超时不能阻止迟到结果写回。 */
export function isPendingImageGeneration(content: ImageElementContent): boolean {
	return (
		!content.src &&
		(!content.status || content.status === "pending" || content.status === "processing") &&
		(content.status === "pending" ||
			content.status === "processing" ||
			Boolean(content.generateImageRequest || content.imageGenerationTaskMeta))
	)
}

export function getImageGenerationTiming(
	content: ImageElementContent,
): ImageGenerationTiming | undefined {
	const timing = content.generationTiming
	if (!timing || !Number.isFinite(timing.startedAt) || timing.startedAt <= 0) return undefined
	return timing.imageId === getImageGenerationId(content) ? timing : undefined
}

export function isImageGenerationTimedOut(
	content: ImageElementContent,
	timing = getImageGenerationTiming(content),
	now = Date.now(),
): boolean {
	return (
		isPendingImageGeneration(content) &&
		Boolean(timing && now - timing.startedAt > IMAGE_CONFIG.GENERATION_TIMEOUT_MS)
	)
}

/** 不猜服务端无时区文本的含义，缺少明确时区时继续使用观察时间。 */
export function parseImageGenerationCreatedAt(value: unknown): number | undefined {
	if (typeof value !== "string") return undefined
	if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())) return undefined
	const timestamp = Date.parse(value)
	return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= Date.now()
		? timestamp
		: undefined
}
