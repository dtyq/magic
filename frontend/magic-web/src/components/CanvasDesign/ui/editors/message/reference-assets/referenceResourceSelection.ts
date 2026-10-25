import {
	SUPPORTED_AUDIO_EXTENSIONS,
	SUPPORTED_IMAGE_EXTENSIONS,
	SUPPORTED_VIDEO_EXTENSIONS,
} from "../../../../runtime/shared/ids"
import type { ResolveCanvasResourceReference } from "../../../../public/resource-reference"
import { getCanvasResourceReferenceIdentity } from "../../../../runtime/shared/path/canvasResourcePath"
import type {
	ReferenceAssetFileClass,
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
	ReferenceResourceTypeFilter,
} from "./reference-resource.types"

interface ReferenceResourcePanelBatchItemLike {
	data: {
		file_id?: string
		file_name?: string
		file_path?: string
		file_extension?: string
	}
}

export function normalizeReferenceComparablePath(
	path?: string,
	resolveResourceReference?: ResolveCanvasResourceReference,
): string {
	return getCanvasResourceReferenceIdentity(path, resolveResourceReference)
}

export function isReferenceResourceCurrentlySelected(
	candidatePaths: Array<string | null | undefined>,
	currentReferenceFiles: string[] = [],
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	if (candidatePaths.length === 0 || currentReferenceFiles.length === 0) return false
	const currentPathSet = new Set(
		currentReferenceFiles
			.map((path) => normalizeReferenceComparablePath(path, resolveResourceReference))
			.filter(Boolean),
	)
	return candidatePaths.some((path) => {
		const normalizedPath = normalizeReferenceComparablePath(
			path || "",
			resolveResourceReference,
		)
		return normalizedPath.length > 0 && currentPathSet.has(normalizedPath)
	})
}

export function isReferenceSelectionLimitBlocked(options: {
	candidatePaths: Array<string | null | undefined>
	currentReferenceFiles?: string[]
	isReferenceFileLimitReached?: boolean
	resolveResourceReference?: ResolveCanvasResourceReference
}): boolean {
	const {
		candidatePaths,
		currentReferenceFiles = [],
		isReferenceFileLimitReached = false,
		resolveResourceReference,
	} = options
	if (!isReferenceFileLimitReached || currentReferenceFiles.length === 0) return false
	return !isReferenceResourceCurrentlySelected(
		candidatePaths,
		currentReferenceFiles,
		resolveResourceReference,
	)
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
	mimeType?: string
}): ReferenceAssetFileClass {
	const { filePath, fileName, fileExtension, mimeType } = options
	const normalizedMimeType = mimeType?.toLowerCase().split(";", 1)[0] || ""
	if (normalizedMimeType.startsWith("image/")) return "image"
	if (normalizedMimeType.startsWith("video/")) return "video"
	if (normalizedMimeType.startsWith("audio/")) return "audio"
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
	resolveResourceReference?: ResolveCanvasResourceReference
}): boolean {
	const {
		fileClass,
		assetLimits,
		currentAssetCounts,
		candidatePaths = [],
		currentReferenceFiles = [],
		resolveResourceReference,
	} = options

	// 已选文件不阻断（允许取消选择）
	if (candidatePaths.length > 0 && currentReferenceFiles.length > 0) {
		const currentPathSet = new Set(
			currentReferenceFiles
				.map((p) => normalizeReferenceComparablePath(p, resolveResourceReference))
				.filter(Boolean),
		)
		const isAlreadySelected = candidatePaths.some((path) => {
			const normalized = normalizeReferenceComparablePath(
				path || "",
				resolveResourceReference,
			)
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

export function filterReferenceResourcePanelBatchItems<
	T extends ReferenceResourcePanelBatchItemLike,
>(options: {
	items: T[]
	maxReferenceFiles?: number
	currentReferenceFiles?: string[]
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
	canAcceptNextAsset?: (
		fileClass: ReferenceAssetFileClass,
		currentAssetCounts: ReferenceAssetTypeCounts,
	) => boolean
	maxBatchItems?: number
	resolveResourceReference?: ResolveCanvasResourceReference
}): T[] {
	const {
		items,
		maxReferenceFiles,
		currentReferenceFiles = [],
		assetLimits,
		currentAssetCounts,
		canAcceptNextAsset,
		maxBatchItems,
		resolveResourceReference,
	} = options
	const batchLimit =
		typeof maxBatchItems === "number" ? Math.max(Math.floor(maxBatchItems), 0) : Infinity
	if (items.length === 0 || batchLimit <= 0) return []

	const currentPathSet = new Set(
		currentReferenceFiles
			.map((path) => normalizeReferenceComparablePath(path, resolveResourceReference))
			.filter(Boolean),
	)
	const acceptedPathSet = new Set<string>()
	const acceptedItems: T[] = []
	let nextReferenceFileCount = currentReferenceFiles.length
	const nextAssetCounts = currentAssetCounts ? { ...currentAssetCounts } : undefined

	for (const item of items) {
		if (acceptedItems.length >= batchLimit) break

		const selectionKey = normalizeReferenceComparablePath(
			item.data.file_path || item.data.file_id || item.data.file_name,
			resolveResourceReference,
		)
		if (selectionKey && acceptedPathSet.has(selectionKey)) continue

		const consumesSlot = !selectionKey || !currentPathSet.has(selectionKey)
		if (consumesSlot) {
			const fileClass = classifyReferenceAssetFile({
				filePath: item.data.file_path,
				fileName: item.data.file_name,
				fileExtension: item.data.file_extension,
			})
			if (fileClass === "unknown") continue
			if (maxReferenceFiles !== undefined && nextReferenceFileCount + 1 > maxReferenceFiles) {
				continue
			}

			if (assetLimits && nextAssetCounts) {
				if (canAcceptNextAsset && !canAcceptNextAsset(fileClass, nextAssetCounts)) {
					continue
				}
				if (!canAcceptNextReferenceAsset(fileClass, assetLimits, nextAssetCounts)) {
					continue
				}
				incrementReferenceAssetCount(fileClass, nextAssetCounts)
			}

			nextReferenceFileCount += 1
		}

		if (selectionKey) acceptedPathSet.add(selectionKey)
		acceptedItems.push(item)
	}

	return acceptedItems
}

function canAcceptNextReferenceAsset(
	fileClass: ReferenceAssetFileClass,
	assetLimits: ReferenceAssetPerTypeLimits,
	currentAssetCounts: ReferenceAssetTypeCounts,
): boolean {
	if (fileClass === "unknown") return false

	const nextTotal =
		currentAssetCounts.images + currentAssetCounts.videos + currentAssetCounts.audios + 1
	if (Number.isFinite(assetLimits.total.max) && nextTotal > assetLimits.total.max) return false

	if (
		fileClass === "image" &&
		Number.isFinite(assetLimits.reference_images.max) &&
		currentAssetCounts.images + 1 > assetLimits.reference_images.max
	) {
		return false
	}
	if (
		fileClass === "video" &&
		Number.isFinite(assetLimits.reference_videos.max) &&
		currentAssetCounts.videos + 1 > assetLimits.reference_videos.max
	) {
		return false
	}
	if (
		fileClass === "audio" &&
		Number.isFinite(assetLimits.reference_audios.max) &&
		currentAssetCounts.audios + 1 > assetLimits.reference_audios.max
	) {
		return false
	}

	return true
}

function incrementReferenceAssetCount(
	fileClass: ReferenceAssetFileClass,
	currentAssetCounts: ReferenceAssetTypeCounts,
): void {
	if (fileClass === "image") currentAssetCounts.images += 1
	else if (fileClass === "video") currentAssetCounts.videos += 1
	else if (fileClass === "audio") currentAssetCounts.audios += 1
}
