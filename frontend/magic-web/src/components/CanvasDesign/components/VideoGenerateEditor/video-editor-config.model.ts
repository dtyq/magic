import {
	SUPPORTED_AUDIO_EXTENSIONS,
	SUPPORTED_IMAGE_EXTENSIONS,
	SUPPORTED_VIDEO_EXTENSIONS,
} from "../../canvas/utils/utils"
import type {
	DefaultGenerateVideoConfig,
	GenerateVideoFrameInput,
	GenerateVideoInputs,
	GenerateVideoRequest,
	UploadFileResponse,
	VideoInputMode,
	VideoInputModeConfig,
	VideoInputModeVariant,
	VideoModelItem,
} from "../../types.magic"
import {
	VIDEO_INPUT_MODE_ORDER,
	type VideoReferenceAssetInfo,
	type VideoReferenceAssetKind,
} from "./video-editor-config.types"

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
	const limits = resolveReferenceAssetLimits(modeConfig, assets)
	const maxCount = limits.total.max
	return maxCount && maxCount > 0 ? maxCount : Infinity
}

interface VideoModeFieldRange {
	min: number
	max: number
}

export interface VideoReferenceAssetLimits {
	reference_images: VideoModeFieldRange
	reference_videos: VideoModeFieldRange
	reference_audios: VideoModeFieldRange
	total: VideoModeFieldRange
	variantCode?: string
}

export interface VideoReferenceAssetValidationIssue {
	field: "total" | "reference_images" | "reference_videos" | "reference_audios"
	rule: "min" | "max"
	expected: number
	actual: number
}

function createDefaultVideoModeFieldRange(): VideoModeFieldRange {
	return { min: 0, max: Infinity }
}

function normalizeFieldRange(raw?: { min?: number; max?: number }): VideoModeFieldRange {
	return {
		min: Number.isFinite(raw?.min) ? Math.max(0, Number(raw?.min)) : 0,
		max: Number.isFinite(raw?.max) ? Math.max(0, Number(raw?.max)) : Infinity,
	}
}

function countReferenceAssets(assets: VideoReferenceAssetInfo[]): {
	images: number
	videos: number
	audios: number
} {
	return assets.reduce(
		(acc, item) => {
			if (item.assetType === "image") acc.images += 1
			if (item.assetType === "video") acc.videos += 1
			if (item.assetType === "audio") acc.audios += 1
			return acc
		},
		{ images: 0, videos: 0, audios: 0 },
	)
}

function resolveVariantPenalty(
	variant: VideoInputModeVariant,
	counts: { images: number; videos: number; audios: number },
): { penalty: number; supportedPresentKinds: number } {
	const limits = variant.limits || {}
	const fields = [
		{ key: "reference_images" as const, count: counts.images },
		{ key: "reference_videos" as const, count: counts.videos },
		{ key: "reference_audios" as const, count: counts.audios },
	]

	let penalty = 0
	let supportedPresentKinds = 0
	for (const field of fields) {
		const range = normalizeFieldRange(limits[field.key])
		if (field.count > 0 && range.max > 0) {
			supportedPresentKinds += 1
		}
		if (field.count > range.max) {
			penalty += field.count - range.max
		}
		if (field.count < range.min) {
			penalty += range.min - field.count
		}
	}

	return { penalty, supportedPresentKinds }
}

function resolveBestVariant(
	variants: VideoInputModeVariant[] | undefined,
	counts: { images: number; videos: number; audios: number },
): VideoInputModeVariant | undefined {
	if (!variants?.length) return undefined
	// 选择“最接近当前上传状态”的变体：先比较越界惩罚，再比较对当前已上传素材类型的支持度。
	let bestVariant: VideoInputModeVariant | undefined
	let bestPenalty = Number.POSITIVE_INFINITY
	let bestSupportedKinds = -1
	for (const variant of variants) {
		const { penalty, supportedPresentKinds } = resolveVariantPenalty(variant, counts)
		if (
			penalty < bestPenalty ||
			(penalty === bestPenalty && supportedPresentKinds > bestSupportedKinds)
		) {
			bestVariant = variant
			bestPenalty = penalty
			bestSupportedKinds = supportedPresentKinds
		}
	}
	return bestVariant
}

function resolveVariantFieldRange(
	variant: VideoInputModeVariant | undefined,
	field: "reference_images" | "reference_videos" | "reference_audios",
	fallback: VideoModeFieldRange,
): VideoModeFieldRange {
	if (!variant?.limits?.[field]) return fallback
	return normalizeFieldRange(variant.limits[field])
}

function isVariantCompatibleForCounts(
	variant: VideoInputModeVariant,
	counts: { images: number; videos: number; audios: number },
): boolean {
	const imageRange = normalizeFieldRange(variant.limits?.reference_images)
	const videoRange = normalizeFieldRange(variant.limits?.reference_videos)
	const audioRange = normalizeFieldRange(variant.limits?.reference_audios)

	return (
		counts.images <= imageRange.max &&
		counts.videos <= videoRange.max &&
		counts.audios <= audioRange.max
	)
}

export function resolveReferenceAssetLimits(
	modeConfig: VideoInputModeConfig | undefined,
	assets: VideoReferenceAssetInfo[] = [],
): VideoReferenceAssetLimits {
	const counts = countReferenceAssets(assets)
	const hasAnyReferenceAsset = assets.length > 0

	const defaultImages = modeConfig?.supported_fields?.includes("reference_images")
		? normalizeFieldRange({ max: modeConfig.reference_images?.max_count })
		: createDefaultVideoModeFieldRange()
	const defaultVideos = modeConfig?.supported_fields?.includes("reference_videos")
		? createDefaultVideoModeFieldRange()
		: normalizeFieldRange({ max: 0 })
	const defaultAudios = modeConfig?.supported_fields?.includes("reference_audios")
		? createDefaultVideoModeFieldRange()
		: normalizeFieldRange({ max: 0 })

	const activeVariants = hasAnyReferenceAsset ? modeConfig?.variants : undefined
	const selectedVariant = resolveBestVariant(activeVariants, counts)
	const selectedVariantReferenceImages = resolveVariantFieldRange(
		selectedVariant,
		"reference_images",
		defaultImages,
	)
	const selectedVariantReferenceVideos = resolveVariantFieldRange(
		selectedVariant,
		"reference_videos",
		defaultVideos,
	)
	const selectedVariantReferenceAudios = resolveVariantFieldRange(
		selectedVariant,
		"reference_audios",
		defaultAudios,
	)
	const compatibleVariants =
		activeVariants?.filter((variant) => isVariantCompatibleForCounts(variant, counts)) || []

	const referenceImages = {
		min: selectedVariantReferenceImages.min,
		max:
			compatibleVariants.length > 0
				? Math.max(
						...compatibleVariants.map(
							(variant) =>
								resolveVariantFieldRange(variant, "reference_images", defaultImages)
									.max,
						),
					)
				: selectedVariantReferenceImages.max,
	}
	const referenceVideos = {
		min: selectedVariantReferenceVideos.min,
		max:
			compatibleVariants.length > 0
				? Math.max(
						...compatibleVariants.map(
							(variant) =>
								resolveVariantFieldRange(variant, "reference_videos", defaultVideos)
									.max,
						),
					)
				: selectedVariantReferenceVideos.max,
	}
	const referenceAudios = {
		min: selectedVariantReferenceAudios.min,
		max:
			compatibleVariants.length > 0
				? Math.max(
						...compatibleVariants.map(
							(variant) =>
								resolveVariantFieldRange(variant, "reference_audios", defaultAudios)
									.max,
						),
					)
				: selectedVariantReferenceAudios.max,
	}

	const finiteTypeMax = [referenceImages.max, referenceVideos.max, referenceAudios.max].filter(
		(value) => Number.isFinite(value),
	) as number[]
	const fallbackTotalMax =
		finiteTypeMax.length > 0 ? finiteTypeMax.reduce((a, b) => a + b, 0) : Infinity
	const hasVariants = Boolean(modeConfig?.variants?.length)
	// total.max 采用“当前可兼容变体中的最大值”，保证用户在不违反规则前提下仍可继续补充素材。
	const compatibleVariantTotalMax =
		compatibleVariants.length > 0
			? Math.max(
					...compatibleVariants.map((variant) => {
						const imageMax = resolveVariantFieldRange(
							variant,
							"reference_images",
							defaultImages,
						).max
						const videoMax = resolveVariantFieldRange(
							variant,
							"reference_videos",
							defaultVideos,
						).max
						const audioMax = resolveVariantFieldRange(
							variant,
							"reference_audios",
							defaultAudios,
						).max
						const totals = [imageMax, videoMax, audioMax].filter((value) =>
							Number.isFinite(value),
						) as number[]
						return totals.length > 0 ? totals.reduce((a, b) => a + b, 0) : Infinity
					}),
				)
			: fallbackTotalMax
	const total = normalizeFieldRange(
		hasVariants
			? {
					max: hasAnyReferenceAsset
						? compatibleVariantTotalMax
						: (modeConfig?.max_count ?? fallbackTotalMax),
				}
			: {
					max: modeConfig?.max_count ?? fallbackTotalMax,
				},
	)

	return {
		reference_images: referenceImages,
		reference_videos: referenceVideos,
		reference_audios: referenceAudios,
		total,
		variantCode: hasAnyReferenceAsset ? selectedVariant?.code : undefined,
	}
}

export function validateReferenceAssetsByLimits(
	modeConfig: VideoInputModeConfig | undefined,
	assets: VideoReferenceAssetInfo[] = [],
): VideoReferenceAssetValidationIssue[] {
	const limits = resolveReferenceAssetLimits(modeConfig, assets)
	const counts = countReferenceAssets(assets)
	const totalCount = assets.length
	const issues: VideoReferenceAssetValidationIssue[] = []

	if (Number.isFinite(limits.total.max) && totalCount > limits.total.max) {
		issues.push({
			field: "total",
			rule: "max",
			expected: limits.total.max,
			actual: totalCount,
		})
	}
	if (limits.total.min > 0 && totalCount < limits.total.min) {
		issues.push({
			field: "total",
			rule: "min",
			expected: limits.total.min,
			actual: totalCount,
		})
	}

	const checks = [
		{
			field: "reference_images" as const,
			actual: counts.images,
			limit: limits.reference_images,
		},
		{
			field: "reference_videos" as const,
			actual: counts.videos,
			limit: limits.reference_videos,
		},
		{
			field: "reference_audios" as const,
			actual: counts.audios,
			limit: limits.reference_audios,
		},
	]

	for (const check of checks) {
		if (Number.isFinite(check.limit.max) && check.actual > check.limit.max) {
			issues.push({
				field: check.field,
				rule: "max",
				expected: check.limit.max,
				actual: check.actual,
			})
		}
		if (check.limit.min > 0 && check.actual < check.limit.min) {
			issues.push({
				field: check.field,
				rule: "min",
				expected: check.limit.min,
				actual: check.actual,
			})
		}
	}

	return issues
}

export function clampReferenceAssetsToLimits(
	assets: VideoReferenceAssetInfo[],
	modeConfig: VideoInputModeConfig | undefined,
): VideoReferenceAssetInfo[] {
	const limits = resolveReferenceAssetLimits(modeConfig, assets)
	const next: VideoReferenceAssetInfo[] = []
	const typeCount = {
		image: 0,
		video: 0,
		audio: 0,
	}

	for (const item of assets) {
		if (next.length >= limits.total.max) break
		if (
			(item.assetType === "image" && typeCount.image >= limits.reference_images.max) ||
			(item.assetType === "video" && typeCount.video >= limits.reference_videos.max) ||
			(item.assetType === "audio" && typeCount.audio >= limits.reference_audios.max)
		) {
			continue
		}
		next.push(item)
		if (item.assetType === "image") typeCount.image += 1
		if (item.assetType === "video") typeCount.video += 1
		if (item.assetType === "audio") typeCount.audio += 1
	}

	return next
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
		fileName: path.split("/").pop() || path,
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

export function resolveReferenceAssetType(path: string): VideoReferenceAssetKind | null {
	const extension = getLowercaseFileExtension(path)
	if (!extension) return null
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
	return null
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
