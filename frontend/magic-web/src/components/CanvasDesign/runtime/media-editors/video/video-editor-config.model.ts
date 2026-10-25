import type {
	VideoInputMode,
	VideoInputModeConfig,
	VideoModelItem,
} from "../../../public/magic-types"

export {
	canAddReferenceAsset,
	canAddReferenceAssetByCounts,
	canReplaceReferenceAssetByCounts,
	clampReferenceAssetsToLimits,
	countReferenceAssets,
	countVideoReferenceAssetInfosByKind,
	resolveReferenceAssetLimits,
	validateReferenceAssetsByLimits,
} from "./reference-asset-limits"
export type {
	ReferenceAssetCounts,
	ReferenceAssetKind,
	ReferenceAssetLimits,
	ReferenceAssetValidationIssue,
	VideoReferenceAssetLike,
	VideoReferenceAssetLimits,
	VideoReferenceAssetValidationIssue,
} from "./reference-asset-limits"

export const VIDEO_INPUT_MODE_ORDER: VideoInputMode[] = [
	"standard",
	"omni_reference",
	"video_edit",
	"keyframe_guided",
	"image_reference",
]
export function getAvailableInputModes(model: VideoModelItem | undefined): VideoInputMode[] {
	if (!model) return ["standard"]
	const inputModes = model.video_generation_config?.input_modes
	if (!inputModes || Object.keys(inputModes).length === 0) return ["standard"]
	const modes = VIDEO_INPUT_MODE_ORDER.filter((mode) => Boolean(inputModes[mode]))
	return modes.length > 0 ? modes : ["standard"]
}

export function getInputModeConfig(
	model: VideoModelItem | undefined,
	inputMode: VideoInputMode,
): VideoInputModeConfig | undefined {
	if (!model) return undefined
	const config = model.video_generation_config?.input_modes?.[inputMode]
	if (config) return config
	if (inputMode === "standard") return { supported_fields: [] }
	return undefined
}

function getEffectiveFrameRoles(modeConfig: VideoInputModeConfig | undefined) {
	const raw = modeConfig?.frame_roles
	return raw && raw.length > 0 ? raw : (["start", "end"] as const)
}

export function resolveVideoFrameRoleSupport(modeConfig: VideoInputModeConfig | undefined) {
	const supportsFramesField = Boolean(modeConfig?.supported_fields?.includes("frames"))
	const roles = getEffectiveFrameRoles(modeConfig)
	return {
		supportsStartFrame: supportsFramesField && roles.includes("start"),
		supportsEndFrame: supportsFramesField && roles.includes("end"),
	}
}
