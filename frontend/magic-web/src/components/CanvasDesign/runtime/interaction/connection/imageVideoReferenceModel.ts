import type { Canvas } from "../../core/Canvas"
import type {
	DefaultGenerateVideoConfig,
	GenerateVideoTask,
	VideoInputMode,
	VideoModelItem,
} from "../../../public/magic-types"
import {
	getAvailableInputModes,
	getInputModeConfig,
	resolveReferenceAssetLimits,
} from "../../media-editors/video/video-editor-config.model"

export interface ResolvedImageReferenceVideoModel {
	model: VideoModelItem
	inputMode: VideoInputMode
	task: GenerateVideoTask
	maxReferenceImages: number
}

const PREFERRED_REFERENCE_MODE_ORDER: VideoInputMode[] = [
	"image_reference",
	"omni_reference",
	"standard",
	"keyframe_guided",
	"video_edit",
]

function getReferenceImagesMax(model: VideoModelItem, inputMode: VideoInputMode): number {
	const modeConfig = getInputModeConfig(model, inputMode)
	if (!modeConfig?.supported_fields?.includes("reference_images")) return 0
	const max = resolveReferenceAssetLimits(modeConfig, []).reference_images.max
	if (!Number.isFinite(max) || max <= 0) return Number.POSITIVE_INFINITY
	return max
}

function getModeCandidates(
	model: VideoModelItem,
	preferredMode?: VideoInputMode,
): VideoInputMode[] {
	const availableModes = getAvailableInputModes(model)
	return Array.from(
		new Set([
			...(preferredMode ? [preferredMode] : []),
			...PREFERRED_REFERENCE_MODE_ORDER,
			...availableModes,
		]),
	).filter((mode) => availableModes.includes(mode))
}

function resolveForModel(
	model: VideoModelItem,
	defaultConfig: DefaultGenerateVideoConfig | undefined,
	requiredReferenceImages: number,
	preferDefaultMode = false,
): ResolvedImageReferenceVideoModel | null {
	const modeCandidates = getModeCandidates(
		model,
		preferDefaultMode ? defaultConfig?.input_mode : undefined,
	)
	for (const inputMode of modeCandidates) {
		const maxReferenceImages = getReferenceImagesMax(model, inputMode)
		if (maxReferenceImages < requiredReferenceImages) continue
		const modeConfig = getInputModeConfig(model, inputMode)
		return {
			model,
			inputMode,
			task: modeConfig?.task ?? defaultConfig?.task ?? "generate",
			maxReferenceImages,
		}
	}
	return null
}

/**
 * 解析可把图片作为 reference_images 的默认视频模型。
 * requiredReferenceImages：单视频需要的参考图数量（批量/分镜按 1 校验）。
 */
export function resolveImageReferenceVideoModel(
	canvas: Canvas,
	videoModelList: VideoModelItem[],
	requiredReferenceImages = 1,
): ResolvedImageReferenceVideoModel | null {
	if (requiredReferenceImages < 1 || videoModelList.length === 0) return null

	const defaultConfig = canvas.magicConfigManager.config?.methods?.getRootStorage?.()
		?.defaultGenerateVideoConfig as DefaultGenerateVideoConfig | undefined

	const defaultModel = videoModelList.find((model) => model.model_id === defaultConfig?.model_id)
	if (defaultModel) {
		const preferred = resolveForModel(
			defaultModel,
			defaultConfig,
			requiredReferenceImages,
			true,
		)
		if (preferred) return preferred
	}

	for (const model of videoModelList) {
		const resolved = resolveForModel(model, defaultConfig, requiredReferenceImages)
		if (resolved) return resolved
	}
	return null
}

/** 菜单门控：默认模型是否支持至少 required 张参考图。 */
export function canUseImageReferenceVideoModel(
	canvas: Canvas,
	videoModelList: VideoModelItem[],
	requiredReferenceImages = 1,
): boolean {
	return Boolean(resolveImageReferenceVideoModel(canvas, videoModelList, requiredReferenceImages))
}
