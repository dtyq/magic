import {
	SUPPORTED_AUDIO_EXTENSIONS,
	SUPPORTED_IMAGE_EXTENSIONS,
	SUPPORTED_VIDEO_EXTENSIONS,
} from "../../../../../runtime/shared/ids"
import {
	areCanvasResourceReferencesSame,
	getCanvasResourceFileName,
} from "../../../../../runtime/shared/path/canvasResourcePath"
import type { ResolveCanvasResourceReference } from "../../../../../public/resource-reference"
import type {
	DefaultGenerateVideoConfig,
	GenerateVideoFrameInput,
	GenerateVideoInputs,
	GenerateVideoRequest,
	UploadFileResponse,
	VideoInputMode,
	VideoInputModeConfig,
	VideoModelItem,
} from "../../../../../public/magic-types"
import {
	VIDEO_INPUT_MODE_ORDER,
	type VideoReferenceAssetInfo,
	type VideoReferenceAssetKind,
} from "../video-editor-config.types"
import {
	createReferenceResourceDescriptor,
	resolveReferenceResourceAssetType,
	type ReferenceResourceMetadataCandidate,
} from "../../../../editors/message/reference-assets/referenceResourceDescriptor"
import {
	canAddReferenceAsset,
	canAddReferenceAssetByCounts,
	canReplaceReferenceAssetByCounts,
	clampReferenceAssetsToLimits,
	countReferenceAssets,
	countVideoReferenceAssetInfosByKind,
	resolveReferenceAssetLimits,
	validateReferenceAssetsByLimits,
} from "../../../../../runtime/media-editors/video/reference-asset-limits"
import type {
	ReferenceAssetCounts,
	ReferenceAssetKind,
	ReferenceAssetLimits,
	ReferenceAssetValidationIssue,
	VideoReferenceAssetLimits,
	VideoReferenceAssetValidationIssue,
} from "../../../../../runtime/media-editors/video/reference-asset-limits"

export {
	canAddReferenceAsset,
	canAddReferenceAssetByCounts,
	canReplaceReferenceAssetByCounts,
	clampReferenceAssetsToLimits,
	countReferenceAssets,
	countVideoReferenceAssetInfosByKind,
	resolveReferenceAssetLimits,
	validateReferenceAssetsByLimits,
}
export type {
	ReferenceAssetCounts,
	ReferenceAssetKind,
	ReferenceAssetLimits,
	ReferenceAssetValidationIssue,
	VideoReferenceAssetLimits,
	VideoReferenceAssetValidationIssue,
}

/** 仅按 video_generation_config.input_modes 推导；无下发时退化为仅 standard */
export function getAvailableInputModes(model: VideoModelItem | undefined): VideoInputMode[] {
	if (!model) return ["standard"]
	const inputModes = model.video_generation_config?.input_modes
	if (!inputModes || Object.keys(inputModes).length === 0) return ["standard"]
	const modes = VIDEO_INPUT_MODE_ORDER.filter((mode) => Boolean(inputModes[mode]))
	return modes.length > 0 ? modes : ["standard"]
}

/**
 * 换模型等场景：若 preferred 仍可用则保留，否则按「全能 → 首尾帧 → 参考图 → standard」取第一个可用 input_mode
 */
const VIDEO_INPUT_MODE_FALLBACK_ORDER: VideoInputMode[] = [
	"omni_reference",
	"video_edit",
	"keyframe_guided",
	"image_reference",
	"standard",
]

export function resolveInputModeForAvailableModes(
	availableModes: VideoInputMode[],
	preferredMode: VideoInputMode,
): VideoInputMode {
	if (availableModes.length === 0) return "standard"
	if (availableModes.includes(preferredMode)) return preferredMode
	for (const mode of VIDEO_INPUT_MODE_FALLBACK_ORDER) {
		if (availableModes.includes(mode)) return mode
	}
	return availableModes[0] ?? "standard"
}

/**
 * 底部模式 Tab 不展示 standard；存在非 standard 模式时，standard 只是初始化过渡态，
 * 必须先归一化到最终可见模式，避免下游把过渡态能力当成稳定策略。
 */
export function resolveSelectableInputModeForAvailableModes(
	availableModes: VideoInputMode[],
	preferredMode: VideoInputMode,
): VideoInputMode {
	const selectableModes =
		preferredMode === "standard" && availableModes.some((mode) => mode !== "standard")
			? availableModes.filter((mode) => mode !== "standard")
			: availableModes
	return resolveInputModeForAvailableModes(selectableModes, preferredMode)
}

/** 子 Tab：若 preferred 仍可用则保留，否则按「首尾帧 → 参考图」取第一个可用项 */
const INPUT_SUB_TAB_FALLBACK_ORDER: Array<"frame" | "reference"> = ["frame", "reference"]

export function resolveInputSubTabForAvailableTabs(
	availableTabs: Array<"frame" | "reference">,
	preferredTab: "frame" | "reference",
): "frame" | "reference" {
	if (availableTabs.length === 0) return "frame"
	if (availableTabs.includes(preferredTab)) return preferredTab
	for (const tab of INPUT_SUB_TAB_FALLBACK_ORDER) {
		if (availableTabs.includes(tab)) return tab
	}
	return availableTabs[0] ?? "frame"
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

export interface ResolvedVideoReferenceVideoModel {
	model: VideoModelItem
	inputMode: VideoInputMode
	task: GenerateVideoRequest["task"]
	maxReferenceVideos: number
}

const VIDEO_REFERENCE_MODE_ORDER = VIDEO_INPUT_MODE_ORDER

/** 找到至少允许一个 reference_videos 的模型和 input_mode，供视频快捷编辑使用。 */
export function resolveVideoReferenceVideoModel(
	videoModelList: VideoModelItem[],
	preferredModelId?: string,
): ResolvedVideoReferenceVideoModel | null {
	const models = [
		...(preferredModelId
			? videoModelList.filter((model) => model.model_id === preferredModelId)
			: []),
		...videoModelList.filter((model) => model.model_id !== preferredModelId),
	]

	for (const model of models) {
		const modes = getAvailableInputModes(model)
		for (const inputMode of VIDEO_REFERENCE_MODE_ORDER) {
			if (!modes.includes(inputMode)) continue
			const modeConfig = getInputModeConfig(model, inputMode)
			if (!modeConfig?.supported_fields?.includes("reference_videos")) continue

			const initialReferenceVideos: VideoReferenceAssetInfo[] = [
				{
					path: "__quick_edit_video__",
					src: "__quick_edit_video__",
					fileName: "",
					assetType: "video",
				},
			]
			const limits = resolveReferenceAssetLimits(modeConfig, initialReferenceVideos)
			if (validateReferenceAssetsByLimits(modeConfig, initialReferenceVideos).length > 0) {
				continue
			}

			return {
				model,
				inputMode,
				task: modeConfig.task ?? (inputMode === "video_edit" ? "edit" : "generate"),
				maxReferenceVideos: limits.reference_videos.max,
			}
		}
	}

	return null
}

/** 与 `getMaxFrameCount` / UI 槽位一致：无下发或空数组时默认开放首尾帧 */
function getEffectiveFrameRoles(
	modeConfig: VideoInputModeConfig | undefined,
): GenerateVideoFrameInput["role"][] {
	const raw = modeConfig?.frame_roles
	if (raw && raw.length > 0) return raw
	return ["start", "end"]
}

/** 根据 `supported_fields` 与 `frame_roles` 推导首帧、尾帧是否在 UI 与请求中开放 */
export function resolveVideoFrameRoleSupport(modeConfig: VideoInputModeConfig | undefined): {
	supportsStartFrame: boolean
	supportsEndFrame: boolean
} {
	const supportsFramesField = Boolean(modeConfig?.supported_fields?.includes("frames"))
	const roles = getEffectiveFrameRoles(modeConfig)
	return {
		supportsStartFrame: supportsFramesField && roles.includes("start"),
		supportsEndFrame: supportsFramesField && roles.includes("end"),
	}
}

/** 根据当前输入模式推导 UI 上可用的输入 Tab */
export function getAvailableInputTabs(
	model: VideoModelItem | undefined,
	inputMode: VideoInputMode,
): Array<"frame" | "reference"> {
	const supportedFields = getInputModeConfig(model, inputMode)?.supported_fields || []
	const tabs: Array<"frame" | "reference"> = []
	if (supportedFields.includes("frames")) tabs.push("frame")
	if (
		supportedFields.includes("reference_images") ||
		supportedFields.includes("reference_videos") ||
		supportedFields.includes("reference_audios")
	)
		tabs.push("reference")
	return tabs
}

/** 无历史请求时的默认输入 Tab */
export function getDefaultInputTab(
	model: VideoModelItem | undefined,
	inputMode: VideoInputMode,
): "frame" | "reference" {
	return getAvailableInputTabs(model, inputMode)[0] || "frame"
}

/** 当前模型允许的最大首尾帧数量 */
export function getMaxFrameCount(
	model: VideoModelItem | undefined,
	inputMode: VideoInputMode,
): number {
	const modeConfig = getInputModeConfig(model, inputMode)
	if (!modeConfig?.supported_fields?.includes("frames")) return 0
	return getEffectiveFrameRoles(modeConfig).length
}

/** 当前模型允许的最大参考图数量 */
export function getMaxReferenceImageCount(
	model: VideoModelItem | undefined,
	inputMode: VideoInputMode,
	assets: VideoReferenceAssetInfo[] = [],
): number {
	const modeConfig = getInputModeConfig(model, inputMode)
	if (!modeConfig) return 0
	if (
		!modeConfig.supported_fields?.includes("reference_images") &&
		!modeConfig.supported_fields?.includes("reference_videos") &&
		!modeConfig.supported_fields?.includes("reference_audios")
	)
		return 0
	const limits = resolveReferenceAssetLimits(modeConfig, assets, {
		ignoreModeMaxCountForTotal: inputMode === "omni_reference",
	})
	const maxCount = limits.total.max
	return maxCount && maxCount > 0 ? maxCount : Infinity
}

/** 将本地路径按首帧、尾帧顺序映射为 API 的 frames 输入 */
export function buildFrameInputs(
	paths: Array<string | undefined> | undefined,
	options: {
		supportsStartFrame: boolean
		supportsEndFrame: boolean
	},
): GenerateVideoRequest["inputs"] {
	if (!paths?.length) return {}

	const frames: GenerateVideoFrameInput[] = []
	let currentIndex = 0

	if (options.supportsStartFrame) {
		const startPath = paths[currentIndex]
		if (startPath) {
			frames.push({
				role: "start",
				uri: startPath,
			})
			currentIndex += 1
		}
	}

	if (options.supportsEndFrame) {
		const endPath = paths[currentIndex]
		if (endPath) {
			frames.push({
				role: "end",
				uri: endPath,
			})
		}
	}

	return frames.length > 0 ? { frames } : {}
}

/** 将请求中的首尾帧恢复到 UI 槽位顺序 */
export function buildFrameSlotInfos(
	frames: GenerateVideoFrameInput[] | undefined,
	model: VideoModelItem | undefined,
	inputMode: VideoInputMode,
): Array<UploadFileResponse | undefined> {
	if (!frames?.length) return []

	const nextInfos: Array<UploadFileResponse | undefined> = []
	const frameRoles = getEffectiveFrameRoles(getInputModeConfig(model, inputMode))
	let slotIndex = 0
	if (frameRoles.includes("start")) {
		const startFrame = frames.find((frame) => frame.role === "start")
		nextInfos[slotIndex] = startFrame ? createUploadFileInfo(startFrame.uri) : undefined
		slotIndex += 1
	}
	if (frameRoles.includes("end")) {
		const endFrame = frames.find((frame) => frame.role === "end")
		nextInfos[slotIndex] = endFrame ? createUploadFileInfo(endFrame.uri) : undefined
	}
	return nextInfos
}

/** 参考素材 Tab 下将资源列表映射为对应输入 */
export function buildReferenceAssetInputs(
	assets: VideoReferenceAssetInfo[] | undefined,
	inputModeConfig: VideoInputModeConfig | undefined,
): GenerateVideoRequest["inputs"] {
	if (!assets?.length || !inputModeConfig?.supported_fields?.length) return {}
	const supportsImages = inputModeConfig.supported_fields.includes("reference_images")
	const supportsVideos = inputModeConfig.supported_fields.includes("reference_videos")
	const supportsAudios = inputModeConfig.supported_fields.includes("reference_audios")
	const imageAssets = supportsImages ? assets.filter((item) => item.assetType === "image") : []
	const videoAssets = supportsVideos ? assets.filter((item) => item.assetType === "video") : []
	const audioAssets = supportsAudios ? assets.filter((item) => item.assetType === "audio") : []

	return {
		...(imageAssets.length > 0
			? {
					reference_images: imageAssets.map((item) => ({
						uri: item.path,
					})),
				}
			: {}),
		...(videoAssets.length > 0
			? {
					reference_videos: videoAssets.map((item) => ({
						uri: item.path,
					})),
				}
			: {}),
		...(audioAssets.length > 0
			? {
					reference_audios: audioAssets.map((item) => ({
						uri: item.path,
					})),
				}
			: {}),
	}
}

/** 判断 inputs 是否包含至少一类有效字段，以决定是否写入请求 */
export function hasVideoInputs(
	inputs: GenerateVideoRequest["inputs"],
): inputs is GenerateVideoInputs {
	if (!inputs) return false
	return Object.keys(inputs).length > 0
}

export function createUploadFileInfo(path: string): UploadFileResponse {
	return {
		path,
		src: path,
		fileName: getCanvasResourceFileName(path) || path,
	}
}

/** 根据请求体中的 inputs 推断当时处于「首尾帧」还是「参考图」Tab */
export function getRequestInputTab(
	request: Partial<GenerateVideoRequest> | undefined,
	inputMode?: VideoInputMode,
): "frame" | "reference" | undefined {
	if (inputMode === "standard") return undefined
	if (inputMode === "keyframe_guided") return "frame"
	if (
		inputMode === "image_reference" ||
		inputMode === "omni_reference" ||
		inputMode === "video_edit"
	)
		return "reference"
	if (request?.inputs?.reference_videos?.length || request?.inputs?.reference_audios?.length)
		return "reference"
	if (request?.inputs?.reference_images?.length) return "reference"
	if (request?.inputs?.frames?.length) return "frame"
	return undefined
}

export function resolveInputModeFromRequest(
	request: Partial<GenerateVideoRequest> | DefaultGenerateVideoConfig | undefined,
	model: VideoModelItem | undefined,
): VideoInputMode {
	if (request?.input_mode) return request.input_mode
	if (request && "inputs" in request) {
		const modes = getAvailableInputModes(model)
		if (request.inputs?.reference_videos?.length || request.inputs?.reference_audios?.length) {
			if (request.task === "edit" && modes.includes("video_edit")) {
				return "video_edit"
			}
			if (modes.includes("video_edit") && request.inputs?.reference_videos?.length === 1) {
				return "video_edit"
			}
			return "omni_reference"
		}
		if (request.inputs?.frames?.length) return "keyframe_guided"
		if (request.inputs?.reference_images?.length) {
			if (modes.includes("image_reference")) return "image_reference"
			if (modes.includes("omni_reference")) return "omni_reference"
		}
	}
	return getAvailableInputModes(model)[0] || "standard"
}

export function buildReferenceAssetInfos(
	inputs: GenerateVideoRequest["inputs"] | undefined,
): VideoReferenceAssetInfo[] {
	if (!inputs) return []
	const images =
		inputs.reference_images?.map((item) => createReferenceAssetInfo(item.uri, "image")) || []
	const videos =
		inputs.reference_videos?.map((item) => createReferenceAssetInfo(item.uri, "video")) || []
	const audios =
		inputs.reference_audios?.map((item) => createReferenceAssetInfo(item.uri, "audio")) || []
	return [...images, ...videos, ...audios]
}

export function createReferenceAssetInfo(
	path: string,
	assetType: VideoReferenceAssetKind,
): VideoReferenceAssetInfo {
	return {
		...createUploadFileInfo(path),
		assetType,
	}
}

export function resolveReferenceAssetType(
	path: string,
	options?: {
		explicitAssetType?: VideoReferenceAssetKind
		metadataCandidates?: readonly ReferenceResourceMetadataCandidate[]
		resolveResourceReference?: ResolveCanvasResourceReference
	},
): VideoReferenceAssetKind | undefined {
	return resolveReferenceResourceAssetType({
		path,
		explicitAssetType: options?.explicitAssetType,
		metadataCandidates: options?.metadataCandidates,
		resolveResourceReference: options?.resolveResourceReference,
		inferFromPath: inferReferenceAssetTypeFromPath,
	})
}

export function resolveVideoReferenceAssetInfo(options: {
	path: string
	src?: string
	fileName?: string
	file_id?: string
	source_file_id?: string
	source_project_id?: string
	project_id?: string
	explicitAssetType?: VideoReferenceAssetKind
	metadataCandidates?: readonly ReferenceResourceMetadataCandidate[]
	resolveResourceReference?: ResolveCanvasResourceReference
}): VideoReferenceAssetInfo | undefined {
	const assetType = resolveReferenceAssetType(options.path, options)
	if (!assetType) return undefined
	const descriptor = createReferenceResourceDescriptor({
		path: options.path,
		src: options.src,
		fileName: options.fileName,
		assetType,
		resolveResourceReference: options.resolveResourceReference,
	})
	if (!descriptor) return undefined
	const metadataIdentity = options.metadataCandidates?.find((candidate) =>
		areCanvasResourceReferencesSame(
			candidate.path,
			descriptor.path,
			options.resolveResourceReference,
		),
	) as
		| (ReferenceResourceMetadataCandidate & {
				file_id?: string
				source_file_id?: string
				source_project_id?: string
				project_id?: string
		  })
		| undefined
	const fileId = options.file_id || metadataIdentity?.file_id
	const sourceFileId = options.source_file_id || metadataIdentity?.source_file_id
	const sourceProjectId = options.source_project_id || metadataIdentity?.source_project_id
	const projectId = options.project_id || metadataIdentity?.project_id
	return {
		path: descriptor.path,
		src: descriptor.src,
		fileName: descriptor.fileName,
		assetType,
		...(fileId ? { file_id: fileId } : {}),
		...(sourceFileId ? { source_file_id: sourceFileId } : {}),
		...(sourceProjectId ? { source_project_id: sourceProjectId } : {}),
		...(projectId ? { project_id: projectId } : {}),
	}
}

function inferReferenceAssetTypeFromPath(path: string): VideoReferenceAssetKind | undefined {
	const extension = getLowercaseFileExtension(path)
	if (!extension) return undefined
	if (
		SUPPORTED_IMAGE_EXTENSIONS.includes(
			extension as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number],
		)
	)
		return "image"
	if (
		SUPPORTED_VIDEO_EXTENSIONS.includes(
			extension as (typeof SUPPORTED_VIDEO_EXTENSIONS)[number],
		)
	)
		return "video"
	if (
		SUPPORTED_AUDIO_EXTENSIONS.includes(
			extension as (typeof SUPPORTED_AUDIO_EXTENSIONS)[number],
		)
	)
		return "audio"
	return undefined
}

export function isReferenceAssetTypeAllowed(
	assetType: VideoReferenceAssetKind,
	inputModeConfig: VideoInputModeConfig | undefined,
): boolean {
	if (!inputModeConfig?.supported_fields?.length) return false
	if (assetType === "image") return inputModeConfig.supported_fields.includes("reference_images")
	if (assetType === "video") return inputModeConfig.supported_fields.includes("reference_videos")
	return inputModeConfig.supported_fields.includes("reference_audios")
}

export function getLowercaseFileExtension(path: string): string {
	const lowerPath = path.toLowerCase()
	const lastDotIndex = lowerPath.lastIndexOf(".")
	if (lastDotIndex < 0) return ""
	return lowerPath.slice(lastDotIndex)
}
