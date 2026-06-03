import {
	SUPPORTED_AUDIO_EXTENSIONS,
	SUPPORTED_IMAGE_EXTENSIONS,
	SUPPORTED_VIDEO_EXTENSIONS,
} from "../../../canvas/utils/utils"
import type {
	ReferenceAssetFileClass,
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
	ReferenceResourceTypeFilter,
} from "./reference-resource.types"

export function normalizeReferenceComparablePath(path?: string): string {
	if (!path) return ""
	return path.trim().replace(/\\/g, "/").replace(/^\/+/, "")
}

export function isReferenceResourceCurrentlySelected(
	candidatePaths: Array<string | null | undefined>,
	currentReferenceFiles: string[] = [],
): boolean {
	if (candidatePaths.length === 0 || currentReferenceFiles.length === 0) return false
	const currentPathSet = new Set(
		currentReferenceFiles.map((path) => normalizeReferenceComparablePath(path)).filter(Boolean),
	)
	return candidatePaths.some((path) => {
		const normalizedPath = normalizeReferenceComparablePath(path || "")
		return normalizedPath.length > 0 && currentPathSet.has(normalizedPath)
	})
}

export function isReferenceSelectionLimitBlocked(options: {
	candidatePaths: Array<string | null | undefined>
	currentReferenceFiles?: string[]
	isReferenceFileLimitReached?: boolean
}): boolean {
	const {
		candidatePaths,
		currentReferenceFiles = [],
		isReferenceFileLimitReached = false,
	} = options
	if (!isReferenceFileLimitReached || currentReferenceFiles.length === 0) return false
	return !isReferenceResourceCurrentlySelected(candidatePaths, currentReferenceFiles)
}

export function isReferenceResourceTypeAllowed(options: {
	filePath?: string
	fileName?: string
	fileExtension?: string
	referenceResourceType?: ReferenceResourceTypeFilter
}): boolean {
	const { filePath, fileName, fileExtension, referenceResourceType } = options
	if (!referenceResourceType) return true
	if (Array.isArray(referenceResourceType)) {
		return referenceResourceType.some((type) =>
			isReferenceResourceTypeAllowed({
				filePath,
				fileName,
				fileExtension,
				referenceResourceType: type,
			}),
		)
	}
	const normalizedExtension = normalizeReferenceExtension(
		fileExtension || filePath || fileName || "",
	)
	if (!normalizedExtension) return false
	if (referenceResourceType === "file") {
		return (
			SUPPORTED_IMAGE_EXTENSIONS.includes(
				normalizedExtension as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number],
			) ||
			SUPPORTED_VIDEO_EXTENSIONS.includes(
				normalizedExtension as (typeof SUPPORTED_VIDEO_EXTENSIONS)[number],
			) ||
			SUPPORTED_AUDIO_EXTENSIONS.includes(
				normalizedExtension as (typeof SUPPORTED_AUDIO_EXTENSIONS)[number],
			)
		)
	}
	if (referenceResourceType === "image") {
		return SUPPORTED_IMAGE_EXTENSIONS.includes(
			normalizedExtension as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number],
		)
	}
	if (referenceResourceType === "video") {
		return SUPPORTED_VIDEO_EXTENSIONS.includes(
			normalizedExtension as (typeof SUPPORTED_VIDEO_EXTENSIONS)[number],
		)
	}
	if (referenceResourceType === "audio") {
		return SUPPORTED_AUDIO_EXTENSIONS.includes(
			normalizedExtension as (typeof SUPPORTED_AUDIO_EXTENSIONS)[number],
		)
	}
	return true
}

function normalizeReferenceExtension(extensionOrPath: string): string {
	const normalizedValue = extensionOrPath.toLowerCase().trim()
	if (!normalizedValue) return ""

	const normalizedPath = normalizedValue.replace(/\\/g, "/")
	const hasPathSeparator = normalizedPath.includes("/")
	const lastSegment = normalizedPath.split("/").filter(Boolean).pop() || normalizedPath
	const lastDotIndex = lastSegment.lastIndexOf(".")

	if (lastDotIndex >= 0 && lastDotIndex < lastSegment.length - 1) {
		return lastSegment.slice(lastDotIndex)
	}
	if (!hasPathSeparator && normalizedValue.startsWith(".")) return normalizedValue
	if (!hasPathSeparator && /^[a-z0-9]+$/i.test(normalizedValue)) {
		return `.${normalizedValue}`
	}
	return ""
}

/**
 * 根据文件扩展名/路径，判断文件属于哪个资源大类（image / video / audio / unknown）。
 */
export function classifyReferenceAssetFile(options: {
	filePath?: string
	fileName?: string
	fileExtension?: string
}): ReferenceAssetFileClass {
	const { filePath, fileName, fileExtension } = options
	const ext = normalizeReferenceExtension(fileExtension || filePath || fileName || "")
	if (!ext) return "unknown"
	if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number]))
		return "image"
	if (SUPPORTED_VIDEO_EXTENSIONS.includes(ext as (typeof SUPPORTED_VIDEO_EXTENSIONS)[number]))
		return "video"
	if (SUPPORTED_AUDIO_EXTENSIONS.includes(ext as (typeof SUPPORTED_AUDIO_EXTENSIONS)[number]))
		return "audio"
	return "unknown"
}

/**
 * 当 assetLimits 存在时，检查文件对应的资源类型是否已超出容量（总数或单类型）。
 * 若文件已在 currentReferenceFiles 中（已选），则不阻断。
 */
export function isReferenceAssetTypeCapacityBlocked(options: {
	fileClass: ReferenceAssetFileClass
	assetLimits: ReferenceAssetPerTypeLimits
	currentAssetCounts: ReferenceAssetTypeCounts
	candidatePaths?: Array<string | null | undefined>
	currentReferenceFiles?: string[]
}): boolean {
	const {
		fileClass,
		assetLimits,
		currentAssetCounts,
		candidatePaths = [],
		currentReferenceFiles = [],
	} = options

	// 已选文件不阻断（允许取消选择）
	if (candidatePaths.length > 0 && currentReferenceFiles.length > 0) {
		const currentPathSet = new Set(
			currentReferenceFiles.map((p) => normalizeReferenceComparablePath(p)).filter(Boolean),
		)
		const isAlreadySelected = candidatePaths.some((path) => {
			const normalized = normalizeReferenceComparablePath(path || "")
			return normalized.length > 0 && currentPathSet.has(normalized)
		})
		if (isAlreadySelected) return false
	}

	const totalCurrent =
		currentAssetCounts.images + currentAssetCounts.videos + currentAssetCounts.audios

	// 总数已满
	if (Number.isFinite(assetLimits.total.max) && totalCurrent >= assetLimits.total.max) return true

	// 该类型槽位已满
	if (
		fileClass === "image" &&
		Number.isFinite(assetLimits.reference_images.max) &&
		currentAssetCounts.images >= assetLimits.reference_images.max
	)
		return true
	if (
		fileClass === "video" &&
		Number.isFinite(assetLimits.reference_videos.max) &&
		currentAssetCounts.videos >= assetLimits.reference_videos.max
	)
		return true
	if (
		fileClass === "audio" &&
		Number.isFinite(assetLimits.reference_audios.max) &&
		currentAssetCounts.audios >= assetLimits.reference_audios.max
	)
		return true

	return false
}
