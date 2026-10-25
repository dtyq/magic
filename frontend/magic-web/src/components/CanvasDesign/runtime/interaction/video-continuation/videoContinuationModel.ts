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
	resolveVideoFrameRoleSupport,
} from "../../media-editors/video/video-editor-config.model"

export interface ResolvedVideoContinuationModel {
	model: VideoModelItem
	inputMode: VideoInputMode
	task: GenerateVideoTask
}

const PREFERRED_FRAME_MODE_ORDER: VideoInputMode[] = [
	"keyframe_guided",
	"omni_reference",
	"video_edit",
	"image_reference",
	"standard",
]

function isStartFrameMode(model: VideoModelItem, inputMode: VideoInputMode): boolean {
	return resolveVideoFrameRoleSupport(getInputModeConfig(model, inputMode)).supportsStartFrame
}

function getModeCandidates(
	model: VideoModelItem,
	preferredMode?: VideoInputMode,
): VideoInputMode[] {
	const availableModes = getAvailableInputModes(model)
	return Array.from(
		new Set([
			...(preferredMode ? [preferredMode] : []),
			...PREFERRED_FRAME_MODE_ORDER,
			...availableModes,
		]),
	).filter((mode) => availableModes.includes(mode))
}

function resolveForModel(
	model: VideoModelItem,
	defaultConfig?: DefaultGenerateVideoConfig,
	preferDefaultMode = false,
): ResolvedVideoContinuationModel | null {
	const modeCandidates = getModeCandidates(
		model,
		preferDefaultMode ? defaultConfig?.input_mode : undefined,
	)
	for (const inputMode of modeCandidates) {
		if (!isStartFrameMode(model, inputMode)) continue
		const modeConfig = getInputModeConfig(model, inputMode)
		return {
			model,
			inputMode,
			task: modeConfig?.task ?? defaultConfig?.task ?? "generate",
		}
	}
	return null
}

/**
 * 续写只需要能提交 start frame。模型选择沿用视频编辑器的能力判断，避免菜单显示
 * 了首帧能力但打开编辑器后又被配置层拒绝。
 */
export function resolveVideoContinuationModel(
	canvas: Canvas,
	videoModelList: VideoModelItem[],
): ResolvedVideoContinuationModel | null {
	const defaultConfig = canvas.magicConfigManager.config?.methods?.getRootStorage?.()
		?.defaultGenerateVideoConfig as DefaultGenerateVideoConfig | undefined
	if (videoModelList.length === 0) return null

	const defaultModel = videoModelList.find((model) => model.model_id === defaultConfig?.model_id)
	if (defaultModel) {
		const preferred = resolveForModel(defaultModel, defaultConfig, true)
		if (preferred) return preferred
	}

	for (const model of videoModelList) {
		const resolved = resolveForModel(model, defaultConfig)
		if (resolved) return resolved
	}
	return null
}
