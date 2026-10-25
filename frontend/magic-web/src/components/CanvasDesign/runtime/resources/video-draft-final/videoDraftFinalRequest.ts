import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import type {
	GenerateVideoRequest,
	VideoGenerationSizeOption,
	VideoModelItem,
} from "../../../public/magic-types"
import type { VideoElementContent } from "../../document/types"
import { areCanvasResourceReferencesSame } from "../../shared/path/canvasResourcePath"

export const VIDEO_DRAFT_FINAL_RESOLUTION = "1080p"

export interface VideoDraftFinalElementSize {
	width: number
	height: number
}

type DraftVideoContent = VideoElementContent & {
	src: string
	generateVideoRequest: GenerateVideoRequest & { model_id: string }
}

export function isDraftVideoContent(
	content: VideoElementContent | null | undefined,
): content is DraftVideoContent {
	return Boolean(
		content?.src &&
		content.generateVideoRequest?.model_id &&
		content.generateVideoRequest.generation?.draft === true,
	)
}

export function isDraftTaskVideoRequest(request: GenerateVideoRequest | null | undefined): boolean {
	return request?.input_mode === "draft_task"
}

export function supportsVideoDraftFinal(
	model: VideoModelItem | undefined,
	modelId: string | undefined,
): boolean {
	if (!model || !modelId || model.model_id !== modelId) return false
	const mode = model.video_generation_config?.input_modes?.draft_task
	if (!mode?.supported_fields?.includes("draft_task")) return false
	const resolutions =
		mode.generation_constraints?.resolutions ??
		model.video_generation_config?.generation?.resolutions ??
		[]
	return resolutions.includes(VIDEO_DRAFT_FINAL_RESOLUTION)
}

function normalizeVideoGenerationSizes(
	sizes?: VideoGenerationSizeOption[],
): Array<VideoGenerationSizeOption & VideoDraftFinalElementSize> {
	return (sizes ?? [])
		.map((size) => {
			const [parsedWidth, parsedHeight] = size.value.split("x").map(Number)
			const width = Number.isFinite(size.width) && size.width > 0 ? size.width : parsedWidth
			const height =
				Number.isFinite(size.height) && size.height > 0 ? size.height : parsedHeight
			if (
				!size.label ||
				!size.resolution ||
				!Number.isFinite(width) ||
				!Number.isFinite(height)
			) {
				return null
			}
			return { ...size, width, height }
		})
		.filter((size): size is VideoGenerationSizeOption & VideoDraftFinalElementSize =>
			Boolean(size),
		)
}

function parseAspectRatio(value?: string): number | undefined {
	if (!value) return undefined
	const [width, height] = value.split(":").map(Number)
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return undefined
	}
	return width / height
}

/**
 * Resolve the temporary final node size from the model's real 1080p output size.
 * The source aspect ratio is preferred so portrait and landscape drafts keep their layout.
 */
export function resolveVideoDraftFinalElementSize(
	model: VideoModelItem | undefined,
	content: VideoElementContent,
): VideoDraftFinalElementSize | null {
	const draftTaskSizes =
		model?.video_generation_config?.input_modes?.draft_task?.generation_constraints?.sizes
	const modelSizes = model?.video_generation_config?.generation?.sizes
	const sizes = normalizeVideoGenerationSizes(
		draftTaskSizes && draftTaskSizes.length > 0 ? draftTaskSizes : modelSizes,
	).filter((size) => size.resolution === VIDEO_DRAFT_FINAL_RESOLUTION)
	if (sizes.length === 0) return null

	const generation = content.generateVideoRequest?.generation
	const sourceAspectRatio = parseAspectRatio(generation?.aspect_ratio)
	const exactSize = generation?.aspect_ratio
		? sizes.find((size) => size.label === generation.aspect_ratio)
		: undefined
	const aspectSize = sourceAspectRatio
		? sizes.find((size) => Math.abs(size.width / size.height - sourceAspectRatio) < 0.01)
		: undefined
	const targetSize = exactSize ?? aspectSize ?? sizes[0]
	return { width: targetSize.width, height: targetSize.height }
}

export function buildVideoDraftFinalRequest(
	content: VideoElementContent,
	videoId: string,
): GenerateVideoRequest | null {
	if (!isDraftVideoContent(content)) return null
	const sourceRequest = content.generateVideoRequest
	const sourceVideoId = sourceRequest.video_id?.trim()
	const sourceUri = content.src?.trim()
	if (!sourceVideoId && !sourceUri) return null

	return {
		video_id: videoId,
		model_id: sourceRequest.model_id,
		input_mode: "draft_task",
		task: "generate",
		inputs: {
			draft_task: sourceVideoId ? { video_id: sourceVideoId } : { uri: sourceUri },
		},
		generation: { resolution: VIDEO_DRAFT_FINAL_RESOLUTION },
	}
}

export function isVideoDraftFinalRequestForSource(
	request: GenerateVideoRequest | null | undefined,
	sourceContent: VideoElementContent,
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	if (!isDraftTaskVideoRequest(request)) return false
	const targetReference = request?.inputs?.draft_task
	const sourceVideoId = sourceContent.generateVideoRequest?.video_id?.trim()
	const targetVideoId = targetReference?.video_id?.trim()
	if (sourceVideoId) return Boolean(targetVideoId && targetVideoId === sourceVideoId)

	const sourceUri = sourceContent.src?.trim()
	const targetUri = targetReference?.uri?.trim()
	if (!sourceUri || !targetUri) return false
	return areCanvasResourceReferencesSame(sourceUri, targetUri, resolveResourceReference)
}
