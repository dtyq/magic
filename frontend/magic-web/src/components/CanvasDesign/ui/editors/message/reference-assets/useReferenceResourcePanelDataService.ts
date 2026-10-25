import { useCallback, useRef, useState } from "react"
import { peekProjectAttachmentDragHoverPlainText } from "./projectAttachmentDragHoverBridge"
import type { MentionDataServicePort } from "../../../../public/props"
import type {
	ReferenceAssetFileClass,
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
	ReferenceResourceFileInfo,
	ReferenceResourceTypeFilter,
} from "./reference-resource.types"
import {
	classifyReferenceAssetFile,
	filterReferenceResourcePanelBatchItems,
} from "./referenceResourceSelection"
import { getCanvasResourceReferenceIdentity } from "../../../../runtime/shared/path/canvasResourcePath"
import type {
	CanvasResourceReferenceResolution,
	ResolveCanvasResourceReference,
} from "../../../../public/resource-reference"
import { useCanvasReferenceMentionRuntime } from "./useCanvasReferenceMentionRuntime"
import { CANVAS_REFERENCE_MENTION_ITEM_TYPE } from "./canvasReferenceMention.constants"

interface UseReferenceResourcePanelDataServiceOptions {
	maxReferenceFiles?: number
	currentReferenceFiles?: string[]
	isReferenceFileLimitReached?: boolean
	referenceResourceType: ReferenceResourceTypeFilter
	referenceFileInfos: ReferenceResourceFileInfo[]
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
	/** @deprecated 由 useCanvasReferenceMentionRuntime 统一从 CanvasDesign i18n 派生 */
	projectFilesPathPrefix?: string
	/** @deprecated 由 useCanvasReferenceMentionRuntime 统一从 MagicContext 派生 */
	mentionFileSubtitleParentPrefix?: string
}

export interface ReferenceDropProjectFile {
	path: string
	fileName: string
	fileId?: string
	source?: number
}

export const REFERENCE_RESOURCE_DROP_STATUS = {
	idle: "idle",
	ready: "ready",
	unsupportedType: "unsupported-type",
	limitExceeded: "limit-exceeded",
	notAvailable: "not-available",
	unknown: "unknown",
} as const

export type ReferenceResourceDropStatus =
	(typeof REFERENCE_RESOURCE_DROP_STATUS)[keyof typeof REFERENCE_RESOURCE_DROP_STATUS]

export interface ReferenceResourceDropCheckResult {
	accepted: boolean
	status?: Exclude<ReferenceResourceDropStatus, "idle" | "ready">
}

export interface ReferenceResourceDropOverlayState {
	visible: boolean
	canDrop: boolean
	status: ReferenceResourceDropStatus
}

export interface ReferenceDropMatchableItem {
	path?: string
	disabled?: boolean
}

export interface ReferenceResourceResolutionOptions {
	resolveResourceReference: ResolveCanvasResourceReference
}

interface UseReferenceResourceDropOptions {
	isEnabled: boolean
	checkLocalFiles?: (files: File[]) => ReferenceResourceDropCheckResult
	checkProjectFiles?: (files: ReferenceDropProjectFile[]) => ReferenceResourceDropCheckResult
	/** 传入 dataTransfer 以便在 dragover 阶段根据 items 的 MIME 预判本机文件是否可能被接受 */
	getLocalHoverState?: (dataTransfer: DataTransfer | null) => ReferenceResourceDropCheckResult
	getProjectHoverState?: () => ReferenceResourceDropCheckResult
	onDropLocalFiles?: (files: File[]) => void | Promise<void>
	onDropProjectFiles?: (files: ReferenceDropProjectFile[]) => void | Promise<void>
}

export interface ReferenceResourceDropDragEvents {
	onDragEnter: (event: React.DragEvent) => void
	onDragLeave: (event: React.DragEvent) => void
	onDragOver: (event: React.DragEvent) => void
	onDrop: (event: React.DragEvent) => void
}

interface AcceptedDropData {
	kind: "local-files" | "project-files"
	files: File[] | ReferenceDropProjectFile[]
}

interface ResolvedDropState {
	overlayState: ReferenceResourceDropOverlayState
	acceptedDropData: AcceptedDropData | null
}

const DRAG_DATA_TYPE = {
	tab: "tab",
	projectFile: CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile,
	multipleFiles: "multiple_files",
} as const

export function useReferenceResourcePanelDataService(
	options: UseReferenceResourcePanelDataServiceOptions,
): MentionDataServicePort | undefined {
	return useCanvasReferenceMentionRuntime(options).dataService
}

export function useReferenceResourceDrop(options: UseReferenceResourceDropOptions): {
	overlayState: ReferenceResourceDropOverlayState
	dragEvents: ReferenceResourceDropDragEvents
} {
	const {
		isEnabled,
		checkLocalFiles,
		checkProjectFiles,
		getLocalHoverState,
		getProjectHoverState,
		onDropLocalFiles,
		onDropProjectFiles,
	} = options
	const [overlayState, setOverlayState] = useState<ReferenceResourceDropOverlayState>({
		visible: false,
		canDrop: false,
		status: REFERENCE_RESOURCE_DROP_STATUS.idle,
	})
	const dragDepthRef = useRef(0)

	const resetDragState = useCallback(() => {
		dragDepthRef.current = 0
		setOverlayState({
			visible: false,
			canDrop: false,
			status: REFERENCE_RESOURCE_DROP_STATUS.idle,
		})
	}, [])

	const resolveDropState = useCallback(
		(dataTransfer: DataTransfer | null): ResolvedDropState => {
			if (!isEnabled || !dataTransfer) return createUnknownDropState()

			const projectFiles = getProjectFilesFromDataTransfer(dataTransfer)
			if (projectFiles.length > 0) {
				const checkResult = checkProjectFiles?.(projectFiles) ?? {
					accepted: false,
					status: REFERENCE_RESOURCE_DROP_STATUS.unknown,
				}
				if (!checkResult.accepted) {
					return {
						overlayState: createOverlayState(checkResult.status),
						acceptedDropData: null,
					}
				}
				return {
					overlayState: createOverlayState(REFERENCE_RESOURCE_DROP_STATUS.ready),
					acceptedDropData: {
						kind: "project-files",
						files: projectFiles,
					},
				}
			}

			const localFiles = getLocalFilesFromDataTransfer(dataTransfer)
			if (localFiles.length > 0) {
				const checkResult = checkLocalFiles?.(localFiles) ?? {
					accepted: false,
					status: REFERENCE_RESOURCE_DROP_STATUS.unknown,
				}
				if (!checkResult.accepted) {
					return {
						overlayState: createOverlayState(checkResult.status),
						acceptedDropData: null,
					}
				}
				return {
					overlayState: createOverlayState(REFERENCE_RESOURCE_DROP_STATUS.ready),
					acceptedDropData: {
						kind: "local-files",
						files: localFiles,
					},
				}
			}

			const inferredDragKind = inferDragKind(dataTransfer)
			if (inferredDragKind === "project-files") {
				const hoverState = getProjectHoverState?.() ?? {
					accepted: false,
					status: REFERENCE_RESOURCE_DROP_STATUS.unknown,
				}
				return {
					overlayState: hoverState.accepted
						? createOverlayState(REFERENCE_RESOURCE_DROP_STATUS.ready)
						: createOverlayState(hoverState.status),
					acceptedDropData: null,
				}
			}

			if (inferredDragKind === "local-files") {
				const hoverState = getLocalHoverState?.(dataTransfer) ?? {
					accepted: false,
					status: REFERENCE_RESOURCE_DROP_STATUS.unknown,
				}
				return {
					overlayState: hoverState.accepted
						? createOverlayState(REFERENCE_RESOURCE_DROP_STATUS.ready)
						: createOverlayState(hoverState.status),
					acceptedDropData: null,
				}
			}

			if (hasDragContent(dataTransfer)) {
				return createUnknownDropState()
			}

			return {
				overlayState: {
					visible: false,
					canDrop: false,
					status: REFERENCE_RESOURCE_DROP_STATUS.idle,
				},
				acceptedDropData: null,
			}
		},
		[isEnabled, checkLocalFiles, checkProjectFiles, getLocalHoverState, getProjectHoverState],
	)

	const handleDragEnter = useCallback(
		(event: React.DragEvent) => {
			event.preventDefault()
			event.stopPropagation()
			dragDepthRef.current += 1
			setOverlayState(resolveDropState(event.dataTransfer).overlayState)
		},
		[resolveDropState],
	)

	const handleDragLeave = useCallback((event: React.DragEvent) => {
		event.preventDefault()
		event.stopPropagation()
		dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
		if (dragDepthRef.current === 0) {
			setOverlayState({
				visible: false,
				canDrop: false,
				status: REFERENCE_RESOURCE_DROP_STATUS.idle,
			})
		}
	}, [])

	const handleDragOver = useCallback(
		(event: React.DragEvent) => {
			event.preventDefault()
			event.stopPropagation()
			const resolvedDropState = resolveDropState(event.dataTransfer)
			event.dataTransfer.dropEffect = resolvedDropState.overlayState.canDrop ? "copy" : "none"
			setOverlayState(resolvedDropState.overlayState)
		},
		[resolveDropState],
	)

	const handleDrop = useCallback(
		(event: React.DragEvent) => {
			event.preventDefault()
			event.stopPropagation()
			const resolvedDropState = resolveDropState(event.dataTransfer)
			const acceptedDropData = resolvedDropState.acceptedDropData
			resetDragState()
			if (!acceptedDropData) return

			if (acceptedDropData.kind === "project-files") {
				void onDropProjectFiles?.(acceptedDropData.files as ReferenceDropProjectFile[])
				return
			}

			void onDropLocalFiles?.(acceptedDropData.files as File[])
		},
		[onDropLocalFiles, onDropProjectFiles, resetDragState, resolveDropState],
	)

	return {
		overlayState,
		dragEvents: {
			onDragEnter: handleDragEnter,
			onDragLeave: handleDragLeave,
			onDragOver: handleDragOver,
			onDrop: handleDrop,
		},
	}
}

function isFileDescriptorAcceptedByAcceptTokens(
	lowerCaseFileName: string,
	lowerCaseMimeType: string,
	acceptTokens: string[],
): boolean {
	return acceptTokens.some((token) => {
		if (token.startsWith(".")) return lowerCaseFileName.endsWith(token)
		if (token.endsWith("/*")) {
			const mimePrefix = token.slice(0, -1)
			return lowerCaseMimeType.startsWith(mimePrefix)
		}
		return lowerCaseMimeType === token
	})
}

export function areFilesAcceptedByAccept(files: File[], accept?: string): boolean {
	if (files.length === 0) return false
	if (!accept?.trim()) return true

	const acceptTokens = accept
		.split(",")
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean)

	if (acceptTokens.length === 0) return true

	return files.every((file) => {
		const lowerCaseFileName = file.name.toLowerCase()
		const lowerCaseMimeType = file.type.toLowerCase()
		return isFileDescriptorAcceptedByAcceptTokens(
			lowerCaseFileName,
			lowerCaseMimeType,
			acceptTokens,
		)
	})
}

/**
 * dragenter/dragover 阶段常见拿不到 File 列表，但 DataTransferItem 上可能有 MIME。
 * 仅当存在非空 type 且可判定与 accept 不符时返回 "rejected"；否则返回 "unknown" 避免误判。
 */
export function inferLocalFileAcceptFromDataTransferItems(
	dataTransfer: DataTransfer,
	accept?: string,
): "accepted" | "rejected" | "unknown" {
	if (!accept?.trim()) return "unknown"

	const acceptTokens = accept
		.split(",")
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean)
	if (acceptTokens.length === 0) return "unknown"

	/** 无文件名时无法匹配「仅扩展名」规则，hover 阶段不据此拒绝以免误判 */
	const mimeAcceptTokens = acceptTokens.filter((token) => !token.startsWith("."))
	if (mimeAcceptTokens.length === 0) return "unknown"

	const fileItems = Array.from(dataTransfer.items || []).filter((item) => item.kind === "file")
	if (fileItems.length === 0) return "unknown"

	let sawConcreteMimeHint = false
	for (const item of fileItems) {
		const mime = item.type?.trim().toLowerCase() ?? ""
		if (!mime) continue
		sawConcreteMimeHint = true
		if (!isFileDescriptorAcceptedByAcceptTokens("", mime, mimeAcceptTokens)) {
			return "rejected"
		}
	}

	return sawConcreteMimeHint ? "accepted" : "unknown"
}

function createOverlayState(
	status: ReferenceResourceDropStatus | undefined,
): ReferenceResourceDropOverlayState {
	const nextStatus = status || REFERENCE_RESOURCE_DROP_STATUS.unknown
	return {
		visible: true,
		canDrop: nextStatus === REFERENCE_RESOURCE_DROP_STATUS.ready,
		status: nextStatus,
	}
}

function createUnknownDropState(): ResolvedDropState {
	return {
		overlayState: createOverlayState(REFERENCE_RESOURCE_DROP_STATUS.unknown),
		acceptedDropData: null,
	}
}

function getProjectFilesFromDataTransfer(dataTransfer: DataTransfer): ReferenceDropProjectFile[] {
	const textPayloads = [
		dataTransfer.getData("text/plain"),
		dataTransfer.getData("application/json"),
	].filter((payload): payload is string => Boolean(payload))

	for (const payload of textPayloads) {
		const projectFiles = parseProjectFilesFromTextPayload(payload)
		if (projectFiles.length > 0) return projectFiles
	}

	/** dragover 阶段 getData 常为空；附件列表 dragstart 会写入 bridge */
	const hoverPeek = peekProjectAttachmentDragHoverPlainText()
	if (hoverPeek) {
		const projectFiles = parseProjectFilesFromTextPayload(hoverPeek)
		if (projectFiles.length > 0) return projectFiles
	}

	return []
}

function parseProjectFilesFromDragData(data: unknown): ReferenceDropProjectFile[] {
	if (!isRecord(data) || typeof data.type !== "string") return []

	if (data.type === DRAG_DATA_TYPE.tab) {
		const tabProjectFile = parseTabProjectFile(data.data)
		return tabProjectFile ? [tabProjectFile] : []
	}

	if (data.type === DRAG_DATA_TYPE.projectFile) {
		const projectFile = parseAttachmentFile(data.data)
		return projectFile ? [projectFile] : []
	}

	if (data.type === DRAG_DATA_TYPE.multipleFiles) {
		if (!Array.isArray(data.data)) return []
		const projectFiles = data.data
			.map((item) => parseAttachmentFile(item))
			.filter((item): item is ReferenceDropProjectFile => Boolean(item))

		if (projectFiles.length !== data.data.length) return []
		return projectFiles
	}

	return []
}

function parseTabProjectFile(data: unknown): ReferenceDropProjectFile | null {
	if (!isRecord(data)) return null
	const fileData = isRecord(data.fileData) ? data.fileData : null
	const isDirectory = fileData?.is_directory === true
	const isSlide =
		Boolean(fileData?.metadata) &&
		isRecord(fileData?.metadata) &&
		fileData.metadata.type === "slide"

	const relativePath =
		typeof fileData?.relative_file_path === "string"
			? fileData.relative_file_path
			: typeof data.filePath === "string"
				? data.filePath
				: null
	const fileName =
		typeof fileData?.file_name === "string"
			? fileData.file_name
			: typeof fileData?.display_filename === "string"
				? fileData.display_filename
				: typeof data.title === "string"
					? data.title
					: null

	if (isDirectory || isSlide) return null

	if (!relativePath || !fileName) return null

	return {
		path: relativePath,
		fileName,
		fileId: typeof fileData?.file_id === "string" ? fileData.file_id : undefined,
		source: typeof fileData?.source === "number" ? fileData.source : undefined,
	}
}

function parseAttachmentFile(data: unknown): ReferenceDropProjectFile | null {
	if (!isRecord(data)) return null
	if (data.is_directory === true) return null

	const relativePath =
		typeof data.relative_file_path === "string"
			? data.relative_file_path
			: typeof data.path === "string"
				? data.path
				: null
	const fileName =
		typeof data.file_name === "string"
			? data.file_name
			: typeof data.filename === "string"
				? data.filename
				: typeof data.display_filename === "string"
					? data.display_filename
					: null

	if (!relativePath || !fileName) return null

	return {
		path: relativePath,
		fileName,
		fileId: typeof data.file_id === "string" ? data.file_id : undefined,
		source: typeof data.source === "number" ? data.source : undefined,
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

function hasDragContent(dataTransfer: DataTransfer) {
	return (
		dataTransfer.types.length > 0 ||
		dataTransfer.items.length > 0 ||
		dataTransfer.files.length > 0
	)
}

function getLocalFilesFromDataTransfer(dataTransfer: DataTransfer): File[] {
	const directFiles = Array.from(dataTransfer.files || [])
	if (directFiles.length > 0) return directFiles

	return Array.from(dataTransfer.items || [])
		.filter((item) => item.kind === "file")
		.map((item) => item.getAsFile())
		.filter((file): file is File => Boolean(file))
}

function parseProjectFilesFromTextPayload(payload: string): ReferenceDropProjectFile[] {
	if (!payload) return []

	try {
		const parsedData = JSON.parse(payload) as unknown
		return parseProjectFilesFromDragData(parsedData)
	} catch {
		return []
	}
}

export function getRemainingReferenceResourceSlots(
	maxReferenceFiles: number | undefined,
	currentReferenceFileCount: number,
): number {
	if (maxReferenceFiles === undefined) return Number.POSITIVE_INFINITY
	return Math.max(maxReferenceFiles - currentReferenceFileCount, 0)
}

function resolveProjectDropFile(
	file: ReferenceDropProjectFile,
	resolveResourceReference: ResolveCanvasResourceReference,
): CanvasResourceReferenceResolution {
	if (file.fileId) {
		return resolveResourceReference({
			namespace: "attachment",
			fileId: file.fileId,
			source: file.source,
		})
	}

	return resolveResourceReference(
		{ namespace: "workspace-path", path: file.path },
		{ requireAttachment: true },
	)
}

export function normalizeProjectDropFilesForStorage(
	files: ReferenceDropProjectFile[],
	options: ReferenceResourceResolutionOptions,
): ReferenceDropProjectFile[] {
	return files.flatMap((file) => {
		const resolution = resolveProjectDropFile(file, options.resolveResourceReference)
		if (resolution.status !== "resolved") return []
		return [{ ...file, path: resolution.storagePath }]
	})
}

export function checkProjectReferenceResourceDrop(options: {
	isDropEnabled: boolean
	files: ReferenceDropProjectFile[]
	matchableItems: ReferenceDropMatchableItem[]
	currentReferenceFiles: string[]
	maxReferenceFiles?: number
	rejectExistingFiles?: boolean
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
	canAcceptNextAsset?: (
		fileClass: ReferenceAssetFileClass,
		currentAssetCounts: ReferenceAssetTypeCounts,
	) => boolean
	resolveResourceReference: ResolveCanvasResourceReference
}): ReferenceResourceDropCheckResult {
	const {
		isDropEnabled,
		files,
		matchableItems,
		currentReferenceFiles,
		maxReferenceFiles,
		rejectExistingFiles = false,
		assetLimits,
		currentAssetCounts,
		canAcceptNextAsset,
		resolveResourceReference,
	} = options
	if (!isDropEnabled) {
		return {
			accepted: false,
			status: REFERENCE_RESOURCE_DROP_STATUS.notAvailable,
		}
	}

	const matchableItemByIdentity = new Map<string, ReferenceDropMatchableItem>()
	for (const item of matchableItems) {
		if (!item.path) continue
		const identity = getCanvasResourceReferenceIdentity(item.path, resolveResourceReference)
		if (!identity) continue
		const existing = matchableItemByIdentity.get(identity)
		if (!existing || (existing.disabled && !item.disabled)) {
			matchableItemByIdentity.set(identity, item)
		}
	}
	const currentReferenceIdentitySet = new Set(
		currentReferenceFiles
			.map((path) => getCanvasResourceReferenceIdentity(path, resolveResourceReference))
			.filter(Boolean),
	)
	const resolvedFiles = files.map((file) => ({
		file,
		resolution: resolveProjectDropFile(file, resolveResourceReference),
	}))
	if (resolvedFiles.some(({ resolution }) => resolution.status !== "resolved")) {
		return {
			accepted: false,
			status: REFERENCE_RESOURCE_DROP_STATUS.notAvailable,
		}
	}

	const resolvedIdentities = resolvedFiles.map(({ resolution }) =>
		resolution.status === "resolved" ? resolution.identity : "",
	)
	const nextNewFileCount = new Set(
		resolvedIdentities.filter((identity) => !currentReferenceIdentitySet.has(identity)),
	).size
	const remainingSlots = getRemainingReferenceResourceSlots(
		maxReferenceFiles,
		currentReferenceFiles.length,
	)

	if ((rejectExistingFiles && nextNewFileCount === 0) || nextNewFileCount > remainingSlots) {
		return {
			accepted: false,
			status: REFERENCE_RESOURCE_DROP_STATUS.limitExceeded,
		}
	}
	if (assetLimits && currentAssetCounts) {
		const acceptedByLimits = filterReferenceResourcePanelBatchItems({
			items: resolvedFiles.map(({ file }) => ({
				data: {
					file_path: file.path,
					file_name: file.fileName,
				},
			})),
			currentReferenceFiles,
			maxReferenceFiles,
			assetLimits,
			currentAssetCounts,
			canAcceptNextAsset,
			resolveResourceReference,
		})
		if (acceptedByLimits.length === 0) {
			return { accepted: false, status: REFERENCE_RESOURCE_DROP_STATUS.limitExceeded }
		}
	}

	const isAccepted = resolvedIdentities.every((identity) => {
		if (rejectExistingFiles && currentReferenceIdentitySet.has(identity)) return false
		const matchableItem = matchableItemByIdentity.get(identity)
		return Boolean(matchableItem && !matchableItem.disabled)
	})

	if (isAccepted) {
		return {
			accepted: true,
		}
	}
	const hasUnavailableFile = resolvedIdentities.some(
		(identity) => !matchableItemByIdentity.has(identity),
	)

	return {
		accepted: false,
		status: hasUnavailableFile
			? REFERENCE_RESOURCE_DROP_STATUS.notAvailable
			: REFERENCE_RESOURCE_DROP_STATUS.unsupportedType,
	}
}

export function checkLocalReferenceResourceDrop(options: {
	isDropEnabled: boolean
	files: File[]
	accept?: string
	currentReferenceFileCount: number
	maxReferenceFiles?: number
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
	canAcceptNextAsset?: (
		fileClass: ReferenceAssetFileClass,
		currentAssetCounts: ReferenceAssetTypeCounts,
	) => boolean
}): ReferenceResourceDropCheckResult {
	const {
		isDropEnabled,
		files,
		accept,
		currentReferenceFileCount,
		maxReferenceFiles,
		assetLimits,
		currentAssetCounts,
		canAcceptNextAsset,
	} = options
	if (!isDropEnabled) {
		return {
			accepted: false,
			status: REFERENCE_RESOURCE_DROP_STATUS.notAvailable,
		}
	}
	const acceptTokens = (accept || "")
		.split(",")
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean)
	const acceptedFiles =
		acceptTokens.length === 0
			? files
			: files.filter((file) =>
					isFileDescriptorAcceptedByAcceptTokens(
						file.name.toLowerCase(),
						file.type.toLowerCase(),
						acceptTokens,
					),
				)
	if (acceptedFiles.length === 0) {
		return {
			accepted: false,
			status: REFERENCE_RESOURCE_DROP_STATUS.unsupportedType,
		}
	}

	if (files.length === 0) {
		return {
			accepted: false,
			status: REFERENCE_RESOURCE_DROP_STATUS.limitExceeded,
		}
	}

	// 按类型细分校验（当 assetLimits 可用时）
	if (assetLimits && currentAssetCounts) {
		const nextCounts = { ...currentAssetCounts }
		let hasPotentiallyAcceptedFile = false
		for (const file of acceptedFiles) {
			const fileClass = classifyReferenceAssetFile({
				fileName: file.name,
				mimeType: file.type,
			})
			const nextTotal = nextCounts.images + nextCounts.videos + nextCounts.audios + 1
			const typeAllowed =
				fileClass === "image"
					? !Number.isFinite(assetLimits.reference_images.max) ||
						nextCounts.images + 1 <= assetLimits.reference_images.max
					: fileClass === "video"
						? !Number.isFinite(assetLimits.reference_videos.max) ||
							nextCounts.videos + 1 <= assetLimits.reference_videos.max
						: fileClass === "audio"
							? !Number.isFinite(assetLimits.reference_audios.max) ||
								nextCounts.audios + 1 <= assetLimits.reference_audios.max
							: false
			if (
				fileClass !== "unknown" &&
				(!canAcceptNextAsset || canAcceptNextAsset(fileClass, nextCounts)) &&
				(!Number.isFinite(assetLimits.total.max) || nextTotal <= assetLimits.total.max) &&
				typeAllowed
			) {
				hasPotentiallyAcceptedFile = true
				if (fileClass === "image") nextCounts.images += 1
				else if (fileClass === "video") nextCounts.videos += 1
				else if (fileClass === "audio") nextCounts.audios += 1
			}
		}
		if (!hasPotentiallyAcceptedFile) {
			return { accepted: false, status: REFERENCE_RESOURCE_DROP_STATUS.limitExceeded }
		}
		return { accepted: true }
	}

	// 兜底：仅按总数判断
	const remainingSlots = getRemainingReferenceResourceSlots(
		maxReferenceFiles,
		currentReferenceFileCount,
	)
	if (files.length <= remainingSlots) {
		return {
			accepted: true,
		}
	}
	return {
		accepted: false,
		status: REFERENCE_RESOURCE_DROP_STATUS.limitExceeded,
	}
}

export function getReferenceResourceHoverState(options: {
	isDropEnabled: boolean
	currentReferenceFileCount: number
	maxReferenceFiles?: number
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
	canAcceptNextAsset?: (
		fileClass: ReferenceAssetFileClass,
		currentAssetCounts: ReferenceAssetTypeCounts,
	) => boolean
}): ReferenceResourceDropCheckResult {
	const {
		isDropEnabled,
		currentReferenceFileCount,
		maxReferenceFiles,
		assetLimits,
		currentAssetCounts,
		canAcceptNextAsset,
	} = options
	if (!isDropEnabled) {
		return {
			accepted: false,
			status: REFERENCE_RESOURCE_DROP_STATUS.notAvailable,
		}
	}

	// 按类型细分判断是否还有任何可用槽位
	if (assetLimits && currentAssetCounts) {
		const totalCurrent =
			currentAssetCounts.images + currentAssetCounts.videos + currentAssetCounts.audios
		if (Number.isFinite(assetLimits.total.max) && totalCurrent >= assetLimits.total.max) {
			return { accepted: false, status: REFERENCE_RESOURCE_DROP_STATUS.limitExceeded }
		}
		const imageRemaining = Number.isFinite(assetLimits.reference_images.max)
			? assetLimits.reference_images.max - currentAssetCounts.images
			: Infinity
		const videoRemaining = Number.isFinite(assetLimits.reference_videos.max)
			? assetLimits.reference_videos.max - currentAssetCounts.videos
			: Infinity
		const audioRemaining = Number.isFinite(assetLimits.reference_audios.max)
			? assetLimits.reference_audios.max - currentAssetCounts.audios
			: Infinity
		const hasAvailableKind = (
			[
				["image", imageRemaining],
				["video", videoRemaining],
				["audio", audioRemaining],
			] as const
		).some(
			([kind, remaining]) =>
				remaining > 0 &&
				(!canAcceptNextAsset || canAcceptNextAsset(kind, currentAssetCounts)),
		)
		if (!hasAvailableKind) {
			return { accepted: false, status: REFERENCE_RESOURCE_DROP_STATUS.limitExceeded }
		}
		return { accepted: true }
	}

	// 兜底：仅按总数判断
	const remainingSlots = getRemainingReferenceResourceSlots(
		maxReferenceFiles,
		currentReferenceFileCount,
	)
	if (remainingSlots <= 0) {
		return {
			accepted: false,
			status: REFERENCE_RESOURCE_DROP_STATUS.limitExceeded,
		}
	}

	return {
		accepted: true,
	}
}

export function getReferenceResourceLocalHoverState(options: {
	isDropEnabled: boolean
	dataTransfer: DataTransfer | null
	accept?: string
	currentReferenceFileCount: number
	maxReferenceFiles?: number
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
	canAcceptNextAsset?: (
		fileClass: ReferenceAssetFileClass,
		currentAssetCounts: ReferenceAssetTypeCounts,
	) => boolean
}): ReferenceResourceDropCheckResult {
	const {
		isDropEnabled,
		dataTransfer,
		accept,
		currentReferenceFileCount,
		maxReferenceFiles,
		assetLimits,
		currentAssetCounts,
		canAcceptNextAsset,
	} = options
	const base = getReferenceResourceHoverState({
		isDropEnabled,
		currentReferenceFileCount,
		maxReferenceFiles,
		assetLimits,
		currentAssetCounts,
		canAcceptNextAsset,
	})
	if (!base.accepted) return base
	if (dataTransfer) {
		const inferred = inferLocalFileAcceptFromDataTransferItems(dataTransfer, accept)
		if (inferred === "rejected") {
			return {
				accepted: false,
				status: REFERENCE_RESOURCE_DROP_STATUS.unsupportedType,
			}
		}
	}
	return base
}

function inferDragKind(dataTransfer: DataTransfer): AcceptedDropData["kind"] | null {
	const dragTypes = Array.from(dataTransfer.types || [])
	const itemKinds = Array.from(dataTransfer.items || []).map((item) => item.kind)
	const itemTypes = Array.from(dataTransfer.items || []).map((item) => item.type)

	if (dragTypes.includes("Files") || itemKinds.includes("file")) {
		return "local-files"
	}

	const hasProjectLikePayload =
		itemKinds.includes("string") &&
		(dragTypes.includes("application/json") ||
			dragTypes.includes("text/plain") ||
			itemTypes.includes("application/json") ||
			itemTypes.includes("text/plain"))

	if (hasProjectLikePayload) {
		return "project-files"
	}

	return null
}
