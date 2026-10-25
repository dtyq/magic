import type {
	CanvasFileResourceMeta,
	FileUrlRequestPriority,
	GetFileInfoResponse,
} from "@/components/CanvasDesign/public/magic-types"
import {
	parseExpiresAt,
	isOssExpiring,
} from "@/components/CanvasDesign/runtime/resources/offline-cache/ossExpiryUtils"
import {
	normalizePathSeparators,
	stripPathEdgeSlashes,
} from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { GetTemporaryDownloadUrlItem } from "@/pages/superMagic/utils/api"
import {
	clearSharedMediaUrlCache,
	getCachedSharedMediaUrls,
	invalidateSharedMediaUrl,
	requestSharedMediaUrls,
} from "@/pages/superMagic/services/sharedMediaUrlCache"
import projectFilesStore from "@/stores/projectFiles"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { resolveDesignCanvasResourceReference } from "./designResourceReferenceResolver"
import { GetFileInfoResponseWithFileId } from "./uploadCallbacks"
import { getPreviewFileUrlWatermarkSignature } from "@/utils/aiWatermarkPreviewFileUrlMode"
import type { ImageProcessOptions } from "@/utils/image-processing"
import {
	buildAttachmentsSnapshotKeyFromFlatFiles,
	type DesignAttachmentIndex,
} from "./designAttachmentIndex"
const IMAGE_PROCESS_OPTIONS: { xMagicImageProcess?: ImageProcessOptions } = {
	xMagicImageProcess: {
		autoOrient: 1,
		format: "webp",
	},
}
const IMAGE_PROCESS_CACHE_SIGNATURE = "auto-orient-v1"

// 图片处理大小限制 50MB
const IMAGE_PROCESS_SIZE_LIMIT = 50971420
// get-file-url 单次请求上限，避免超大画布一次性提交过大的 file_ids payload
const MAX_GET_FILE_URL_BATCH_SIZE = 100
// identity 级 URL 结果仅保留最近使用的一段工作集，避免跨画布导航后长期累积。
const MAX_FILE_INFO_MEMORY_CACHE_SIZE = 2048
// 默认缓存时间 15 分钟
const DEFAULT_TTL_MS = 15 * 60 * 1000
// 上传已保存但附件树尚未刷回时的短期桥接窗口。
const OPTIMISTIC_UPLOAD_CACHE_TTL_MS = 15 * 1000

/** 是否启用换链结果缓存：为 false 时不读写内存命中，可用于强制每次拉新 URL */
let cacheEnabled = true

interface CacheEntry {
	fileInfo: GetFileInfoResponse
	/** 写入时 getTemporaryDownloadUrl 自动 download_mode 水印语义，与 getPreviewFileUrlWatermarkSignature() 一致 */
	previewWatermarkSignature: string
	// 当接口未返回 expires_at 时，使用写入时间 + DEFAULT_TTL_MS 兜底过期
	cachedAt?: number
	// 记录当前 path 在最近一次解析时对应的 file_id，用于识别“同路径文件被替换”
	resolvedFileId?: string
	// 记录当前 path 在最近一次解析时对应的资源版本，用于识别同 file_id 内容更新。
	resolvedResourceVersion?: string
	// 上传完成但附件快照尚未刷新时，允许短暂命中当前 path。
	allowMissingAttachment?: boolean
	optimisticMissingAttachmentAllowedUntil?: number
}

type FileUrlRendition = "raw" | "image-process"

function getRenditionCacheIdentity(rendition: FileUrlRendition): string {
	return rendition === "image-process"
		? `${rendition}:${IMAGE_PROCESS_CACHE_SIGNATURE}`
		: rendition
}

interface FileUrlRequestGroup {
	baseIdentityKey: string
	fileId: string
	rendition: FileUrlRendition
	designProjectId?: string
	priority: FileUrlRequestPriority
	forceRefresh: boolean
	resourceVersion?: string
	/** Identity captured at the request boundary; never batched across share/session. */
	fileApi?: FileApi
	status: "queued" | "admitted" | "in-flight"
	promise: Promise<GetTemporaryDownloadUrlItem & { url: string }>
	resolve: (value: GetTemporaryDownloadUrlItem & { url: string }) => void
	reject: (error: Error) => void
	settled: boolean
}

interface PendingFileInfoRequest {
	promise: Promise<GetFileInfoResponse>
	fileId: string
	rendition: FileUrlRendition
	token: symbol
	resourceVersion?: string
}

interface ResolvedFileInfoCacheTarget {
	normalizedPath: string
	fileItem: FileItem | null
}

type FileInfoCacheTargetResolution =
	| { status: "resolved"; target: ResolvedFileInfoCacheTarget }
	| {
			status: "ambiguous" | "not-found" | "attachments-pending" | "invalid"
			candidates: string[]
	  }

// 主缓存：key = designProjectId + normalizedRelativePath
const fileInfoRequestCache = new Map<string, PendingFileInfoRequest>()
const fileInfoCache = new Map<string, CacheEntry>()
// URL 请求只按项目、file_id 与实际 rendition 去重；path 仅作为结果订阅方保留自己的元数据缓存。
const fileUrlRequestGroups = new Map<string, FileUrlRequestGroup>()
const activeFileUrlRequestGroups = new Set<FileUrlRequestGroup>()
const forceRefreshRequestTokens = new Map<string, symbol>()
let fileUrlFlushTimer: ReturnType<typeof setTimeout> | null = null
let fileUrlFlushAt: number | null = null
let fileUrlFlushScheduleVersion = 0

function shouldUseImageProcess(fileSize?: number): boolean {
	if (fileSize === undefined || fileSize === null || fileSize <= 0) {
		return false
	}
	return fileSize < IMAGE_PROCESS_SIZE_LIMIT
}

function getStoreFiles(filesList?: FileItem[]): FileItem[] {
	return (filesList || projectFilesStore.workspaceFilesList || []) as FileItem[]
}

function resolveHasAttachmentSnapshot(
	files: readonly FileItem[],
	explicitSnapshotState?: boolean,
): boolean {
	return explicitSnapshotState ?? files.length > 0
}

function resolveFileInfoCacheTarget(
	path: string,
	options: {
		designProjectBasePath?: string
		flatAttachments: FileItem[]
		attachmentIndex?: DesignAttachmentIndex | null
		attachmentsReady?: boolean
	},
): FileInfoCacheTargetResolution {
	const resolution = resolveDesignCanvasResourceReference(path, options)
	if (
		resolution.status !== "resolved" ||
		resolution.resourceKind !== "workspace-file" ||
		!resolution.workspacePath
	) {
		return {
			status: resolution.status === "resolved" ? "invalid" : resolution.status,
			candidates: resolution.candidates,
		}
	}

	const normalizedPath = stripPathEdgeSlashes(normalizePathSeparators(resolution.workspacePath))
	if (!normalizedPath) return { status: "invalid", candidates: resolution.candidates }

	const indexedFileItem = resolution.attachmentId
		? options.attachmentIndex?.byFileId.get(resolution.attachmentId)
		: undefined
	const fileItem =
		indexedFileItem && !indexedFileItem.is_directory
			? indexedFileItem
			: resolution.attachmentId
				? options.flatAttachments.find(
						(item) => !item.is_directory && item.file_id === resolution.attachmentId,
					)
				: undefined

	return {
		status: "resolved",
		target: {
			normalizedPath,
			fileItem: fileItem ?? null,
		},
	}
}

// 画布内只认相对路径；缓存额外按项目和实际 rendition 隔离，避免 raw/WebP URL 互相覆盖。
function buildScopedPathKey(
	normalizedPath: string,
	designProjectId?: string,
	rendition: FileUrlRendition = "raw",
	identityKey = "none",
): string {
	const namespace = designProjectId || "__global__"
	return `${namespace}\0${normalizedPath}\0${identityKey}\0${getRenditionCacheIdentity(rendition)}`
}

function resolveFileUrlRendition(
	useImageProcess: boolean | undefined,
	fileSize: number | undefined,
): FileUrlRendition {
	return useImageProcess === true && shouldUseImageProcess(fileSize) ? "image-process" : "raw"
}

function buildRequestCacheKey(cacheKey: string, rendition: FileUrlRendition): string {
	return `${cacheKey}\0${rendition}`
}

function getPathCacheKeyFromRequestCacheKey(requestCacheKey: string): string {
	const separatorIndex = requestCacheKey.lastIndexOf("\0")
	return separatorIndex < 0 ? requestCacheKey : requestCacheKey.slice(0, separatorIndex)
}

function deletePathRequestCache(cacheKey: string): void {
	fileInfoRequestCache.delete(buildRequestCacheKey(cacheKey, "raw"))
	fileInfoRequestCache.delete(buildRequestCacheKey(cacheKey, "image-process"))
}

function clearPendingPathRequest(requestCacheKey: string, requestToken: symbol): void {
	const pending = fileInfoRequestCache.get(requestCacheKey)
	if (pending?.token === requestToken) {
		fileInfoRequestCache.delete(requestCacheKey)
	}
}

function buildNamespaceKey(designProjectId?: string): string {
	return designProjectId || "__global__"
}

function parseScopedPathKey(scopedPathKey: string): {
	namespace: string
	normalizedPath: string
	rendition: FileUrlRendition
} {
	const parts = scopedPathKey.split("\0")
	if (parts.length < 2) {
		return {
			namespace: "__global__",
			normalizedPath: scopedPathKey,
			rendition: "raw",
		}
	}
	const possibleRendition = parts.at(-1)
	const currentImageProcessIdentity = getRenditionCacheIdentity("image-process")
	const hasRendition =
		possibleRendition === "raw" ||
		possibleRendition === "image-process" ||
		possibleRendition === currentImageProcessIdentity
	return {
		namespace: parts[0] || "__global__",
		normalizedPath: parts
			.slice(1, hasRendition ? (parts.length >= 4 ? -2 : -1) : undefined)
			.join("\0"),
		rendition:
			possibleRendition === "image-process" ||
			possibleRendition === currentImageProcessIdentity
				? "image-process"
				: "raw",
	}
}

function isCachedFileInfoExpired(entry: CacheEntry): boolean {
	const expiresAtTs = parseExpiresAt(entry.fileInfo.expires_at)
	if (expiresAtTs !== null) {
		return isOssExpiring(entry.fileInfo.expires_at)
	}
	if (entry.cachedAt === undefined) {
		return false
	}
	return Date.now() - entry.cachedAt >= DEFAULT_TTL_MS
}

function isOptimisticMissingAttachmentAllowed(entry: CacheEntry): boolean {
	return (
		entry.allowMissingAttachment === true &&
		typeof entry.optimisticMissingAttachmentAllowedUntil === "number" &&
		Date.now() < entry.optimisticMissingAttachmentAllowedUntil
	)
}

function isOptimisticMissingAttachmentExpired(
	entry: CacheEntry,
	fileItem: FileItem | null,
): boolean {
	if (fileItem) return false
	if (entry.allowMissingAttachment !== true) return false
	return !isOptimisticMissingAttachmentAllowed(entry)
}

function isPreviewWatermarkSignatureStale(entry: CacheEntry): boolean {
	return entry.previewWatermarkSignature !== getPreviewFileUrlWatermarkSignature()
}

function buildAttachmentsSnapshotKey(filesList?: FileItem[]): string {
	return buildAttachmentsSnapshotKeyFromFlatFiles(getStoreFiles(filesList))
}

function setMemoryCache(
	cacheKey: string,
	fileInfo: GetFileInfoResponse,
	resolvedFileId?: string,
	previewWatermarkSignature: string = getPreviewFileUrlWatermarkSignature(),
	options?: { allowMissingAttachment?: boolean },
): void {
	const now = Date.now()
	const allowMissingAttachment = options?.allowMissingAttachment === true
	fileInfoCache.delete(cacheKey)
	fileInfoCache.set(cacheKey, {
		fileInfo,
		previewWatermarkSignature,
		resolvedFileId,
		...(fileInfo.resource_version
			? { resolvedResourceVersion: fileInfo.resource_version }
			: {}),
		...(allowMissingAttachment
			? {
					allowMissingAttachment: true,
					optimisticMissingAttachmentAllowedUntil: now + OPTIMISTIC_UPLOAD_CACHE_TTL_MS,
				}
			: {}),
		cachedAt: now,
	})
	trimFileInfoMemoryCache()
}

function deleteMemoryCache(cacheKey: string): void {
	fileInfoCache.delete(cacheKey)
	deletePathRequestCache(cacheKey)
}

function trimFileInfoMemoryCache(): void {
	while (fileInfoCache.size > MAX_FILE_INFO_MEMORY_CACHE_SIZE) {
		const oldestKey = fileInfoCache.keys().next().value
		if (typeof oldestKey !== "string") break
		fileInfoCache.delete(oldestKey)
	}
}

function findFileItemByFileId(fileId: string, filesList?: FileItem[]): FileItem | null {
	if (!fileId) return null
	const found = getStoreFiles(filesList).find(
		(item) => !item.is_directory && item.file_id === fileId,
	)
	return found ?? null
}

function buildResourceVersion(parts: {
	resourceVersion?: string | null
	fileId?: string
	updatedAt?: string
	fileSize?: number
}): string {
	const version = normalizeStrongResourceVersion(parts.resourceVersion)
	if (version) return version
	return [parts.fileId || "", parts.updatedAt || "", parts.fileSize ?? ""].join(":")
}

function normalizeStrongResourceVersion(version?: string | null): string | undefined {
	if (typeof version !== "string") return undefined
	const trimmed = version.trim()
	return trimmed || undefined
}

function getFileItemStrongResourceVersion(fileItem: FileItem): string | undefined {
	return (
		normalizeStrongResourceVersion(fileItem.resource_version) ??
		normalizeStrongResourceVersion(fileItem.version)
	)
}

function buildFileResourceVersion(fileItem: FileItem): string {
	return buildResourceVersion({
		resourceVersion: getFileItemStrongResourceVersion(fileItem),
		fileId: fileItem.file_id,
		updatedAt: fileItem.updated_at,
		fileSize: fileItem.file_size,
	})
}

function buildFileResourceMeta(fileItem: FileItem): CanvasFileResourceMeta {
	return {
		status: "exists",
		fileName: fileItem.file_name || fileItem.display_filename || fileItem.filename || "",
		...(fileItem.source !== undefined ? { source: fileItem.source } : {}),
		resourceVersion: buildFileResourceVersion(fileItem),
		updatedAt: fileItem.updated_at ?? null,
		contentLength: fileItem.file_size ?? null,
	}
}

function getOptimisticFileResourceMeta(
	normalizedPath: string,
	designProjectId?: string,
): CanvasFileResourceMeta | null {
	const cacheKey = buildScopedPathKey(normalizedPath, designProjectId)
	const entry = fileInfoCache.get(cacheKey)
	if (!entry) return null
	if (
		isOptimisticMissingAttachmentExpired(entry, null) ||
		isCachedFileInfoExpired(entry) ||
		isPreviewWatermarkSignatureStale(entry)
	) {
		deleteMemoryCache(cacheKey)
		return null
	}
	if (!isOptimisticMissingAttachmentAllowed(entry)) return null

	fileInfoCache.delete(cacheKey)
	fileInfoCache.set(cacheKey, entry)
	return {
		status: "exists",
		fileName: entry.fileInfo.fileName,
		...(entry.fileInfo.source !== undefined ? { source: entry.fileInfo.source } : {}),
		resourceVersion: entry.fileInfo.resource_version ?? null,
		updatedAt: entry.fileInfo.updated_at ?? null,
		contentLength: entry.fileInfo.content_length ?? null,
	}
}

function mergeFileItemMetaIntoFileInfo(
	base: GetFileInfoResponse,
	fileItem: FileItem | null,
): GetFileInfoResponse {
	if (!fileItem) return base
	return {
		...base,
		...(fileItem.source !== undefined ? { source: fileItem.source } : {}),
		resource_version: buildFileResourceVersion(fileItem),
		...(fileItem.updated_at !== undefined ? { updated_at: fileItem.updated_at } : {}),
		...(fileItem.file_size !== undefined ? { content_length: fileItem.file_size } : {}),
	}
}

function shouldInvalidateCachedEntry(
	entry: CacheEntry,
	fileItem: FileItem | null,
	hasFilesContext: boolean,
): boolean {
	// 没有最新附件上下文时，不主动用 resolvedFileId 做失效，避免误删纯内存命中结果。
	if (!hasFilesContext) {
		return false
	}
	if (!fileItem) {
		return !isOptimisticMissingAttachmentAllowed(entry)
	}
	// 同一路径解析出了新的 file_id，说明发生了同名替换，旧 URL 必须丢弃。
	if (entry.resolvedFileId && entry.resolvedFileId !== fileItem.file_id) {
		return true
	}
	const cachedResourceVersion =
		entry.resolvedResourceVersion ??
		normalizeStrongResourceVersion(entry.fileInfo.resource_version)
	if (cachedResourceVersion && cachedResourceVersion !== buildFileResourceVersion(fileItem)) {
		return true
	}
	return false
}

function getCachedEntryStaleReasons(
	entry: CacheEntry,
	fileItem: FileItem | null,
	hasFilesContext: boolean,
): string[] {
	return [
		isCachedFileInfoExpired(entry) ? "expired" : null,
		isPreviewWatermarkSignatureStale(entry) ? "preview-watermark" : null,
		isOptimisticMissingAttachmentExpired(entry, fileItem) ? "optimistic-upload-window" : null,
		shouldInvalidateCachedEntry(entry, fileItem, hasFilesContext)
			? "attachment-mismatch"
			: null,
	].filter((reason): reason is string => Boolean(reason))
}

const FILE_URL_PRIORITY_RANK: Record<FileUrlRequestPriority, number> = {
	critical: 0,
	visible: 1,
	near: 2,
	background: 3,
}

const FILE_URL_FLUSH_DELAY_MS: Record<FileUrlRequestPriority, number> = {
	critical: 0,
	visible: 24,
	near: 120,
	background: 250,
}

function buildFileUrlIdentityKey(
	fileId: string,
	rendition: FileUrlRendition,
	designProjectId?: string,
	resourceVersion?: string,
	fileApi?: FileApi,
): string {
	// The identity suffix keeps share and host-session in-flight groups apart so a
	// batch never mixes file requests bound to different tokens.
	return `${buildNamespaceKey(designProjectId)}\0${fileId}\0${getRenditionCacheIdentity(rendition)}\0${resourceVersion ?? ""}\0${fileApi?.identityKey ?? "none"}`
}

function invalidateFileUrlResultsForFileId(fileId: string, designProjectId?: string): void {
	supersedeFileUrlRequestsForFileId(fileId, designProjectId)
}

function supersedeFileUrlRequestsForFileId(fileId: string, designProjectId?: string): void {
	if (!fileId) return
	invalidateSharedMediaUrl(fileId)
	const namespace = buildNamespaceKey(designProjectId)
	activeFileUrlRequestGroups.forEach((group) => {
		if (group.fileId !== fileId || buildNamespaceKey(group.designProjectId) !== namespace) {
			return
		}
		// 旧请求继续服务原调用方，但从 canonical map 脱钩，后续调用必须创建新代际。
		if (fileUrlRequestGroups.get(group.baseIdentityKey) === group) {
			fileUrlRequestGroups.delete(group.baseIdentityKey)
		}
	})
}

function getHighestQueuedFileUrlPriority(): FileUrlRequestPriority | null {
	let highestPriority: FileUrlRequestPriority | null = null
	activeFileUrlRequestGroups.forEach((group) => {
		if (group.status !== "queued") return
		if (
			!highestPriority ||
			FILE_URL_PRIORITY_RANK[group.priority] < FILE_URL_PRIORITY_RANK[highestPriority]
		) {
			highestPriority = group.priority
		}
	})
	return highestPriority
}

function clearFileUrlFlushSchedule(): void {
	fileUrlFlushScheduleVersion += 1
	if (fileUrlFlushTimer) {
		clearTimeout(fileUrlFlushTimer)
		fileUrlFlushTimer = null
	}
	fileUrlFlushAt = null
}

function scheduleFileUrlFlush(): void {
	const highestPriority = getHighestQueuedFileUrlPriority()
	if (!highestPriority) return

	const delay = FILE_URL_FLUSH_DELAY_MS[highestPriority]
	const targetAt = Date.now() + delay
	if (fileUrlFlushAt !== null && fileUrlFlushAt <= targetAt) return

	clearFileUrlFlushSchedule()
	fileUrlFlushAt = targetAt
	const scheduleVersion = fileUrlFlushScheduleVersion
	if (delay === 0) {
		queueMicrotask(() => {
			if (scheduleVersion !== fileUrlFlushScheduleVersion) return
			fileUrlFlushAt = null
			void executeFileUrlBatch()
		})
		return
	}

	fileUrlFlushTimer = setTimeout(() => {
		if (scheduleVersion !== fileUrlFlushScheduleVersion) return
		fileUrlFlushTimer = null
		fileUrlFlushAt = null
		void executeFileUrlBatch()
	}, delay)
}

function settleFileUrlRequestGroup(
	group: FileUrlRequestGroup,
	result: (GetTemporaryDownloadUrlItem & { url: string }) | Error,
): void {
	if (group.settled) return
	group.settled = true
	activeFileUrlRequestGroups.delete(group)
	if (fileUrlRequestGroups.get(group.baseIdentityKey) === group) {
		fileUrlRequestGroups.delete(group.baseIdentityKey)
	}
	if (result instanceof Error) {
		group.reject(result)
	} else {
		group.resolve(result)
	}
}

async function requestFileUrlChunk(
	groups: FileUrlRequestGroup[],
	rendition: FileUrlRendition,
): Promise<void> {
	try {
		const fileResourceVersionMap = new Map<string, string>()
		groups.forEach((group) => {
			if (group.resourceVersion !== undefined) {
				fileResourceVersionMap.set(group.fileId, group.resourceVersion)
			}
		})
		const requestUrls = groups[0]?.fileApi?.requestSharedMediaUrls ?? requestSharedMediaUrls
		const downloadUrls = await requestUrls([...new Set(groups.map((group) => group.fileId))], {
			imageProcess:
				rendition === "image-process"
					? IMAGE_PROCESS_OPTIONS.xMagicImageProcess
					: undefined,
			forceRefresh: !cacheEnabled || groups.some((group) => group.forceRefresh),
			fileResourceVersionMap,
			// Every group in a chunk shares one identity (see requestFileUrlGroups),
			// so the bound access is unambiguous.
			identityKey: groups[0]?.fileApi?.identityKey,
		})
		const urlItemByFileId = new Map<string, GetTemporaryDownloadUrlItem & { url: string }>()
		downloadUrls?.forEach((urlItem) => {
			if (urlItem.file_id && urlItem.url) {
				urlItemByFileId.set(urlItem.file_id, { ...urlItem, url: urlItem.url })
			}
		})
		groups.forEach((group) => {
			const urlItem = urlItemByFileId.get(group.fileId)
			settleFileUrlRequestGroup(
				group,
				urlItem ?? new Error(`无法获取文件下载地址: ${group.fileId}`),
			)
		})
	} catch (error) {
		const normalizedError = error instanceof Error ? error : new Error(String(error))
		groups.forEach((group) => settleFileUrlRequestGroup(group, normalizedError))
	}
}

async function requestFileUrlGroups(
	groups: FileUrlRequestGroup[],
	rendition: FileUrlRendition,
): Promise<void> {
	const remainingGroups = new Set(groups)
	while (remainingGroups.size > 0) {
		const orderedGroups = [...remainingGroups]
			.filter((group) => group.status === "admitted" && !group.settled)
			.sort(
				(left, right) =>
					FILE_URL_PRIORITY_RANK[left.priority] - FILE_URL_PRIORITY_RANK[right.priority],
			)
		if (orderedGroups.length === 0) return

		const currentChunk: FileUrlRequestGroup[] = []
		const chunkFileIds = new Set<string>()
		const chunkResourceVersionByFileId = new Map<string, string>()
		const chunkForceRefresh = orderedGroups[0]?.forceRefresh ?? false
		// Never batch groups bound to different identities, or a share request
		// could ride the host session's token and vice versa.
		const chunkAccessKey = orderedGroups[0]?.fileApi?.identityKey ?? "none"
		orderedGroups.forEach((group) => {
			if (group.forceRefresh !== chunkForceRefresh) return
			if ((group.fileApi?.identityKey ?? "none") !== chunkAccessKey) return
			const resourceVersionKey = group.resourceVersion ?? ""
			if (chunkFileIds.has(group.fileId)) {
				if (chunkResourceVersionByFileId.get(group.fileId) !== resourceVersionKey) return
			} else if (chunkFileIds.size >= MAX_GET_FILE_URL_BATCH_SIZE) {
				return
			}
			currentChunk.push(group)
			chunkFileIds.add(group.fileId)
			chunkResourceVersionByFileId.set(group.fileId, resourceVersionKey)
		})
		if (currentChunk.length === 0) return
		currentChunk.forEach((group) => {
			remainingGroups.delete(group)
			group.status = "in-flight"
		})
		await requestFileUrlChunk(currentChunk, rendition)
	}
}

async function executeFileUrlBatch(): Promise<void> {
	clearFileUrlFlushSchedule()
	const queuedGroups = [...activeFileUrlRequestGroups]
		.filter((group) => group.status === "queued")
		.sort(
			(left, right) =>
				FILE_URL_PRIORITY_RANK[left.priority] - FILE_URL_PRIORITY_RANK[right.priority],
		)
	if (queuedGroups.length === 0) return
	queuedGroups.forEach((group) => {
		group.status = "admitted"
	})

	const rawGroups = queuedGroups.filter((group) => group.rendition === "raw")
	const imageProcessGroups = queuedGroups.filter((group) => group.rendition === "image-process")
	await Promise.all([
		requestFileUrlGroups(rawGroups, "raw"),
		requestFileUrlGroups(imageProcessGroups, "image-process"),
	])

	if (getHighestQueuedFileUrlPriority()) {
		scheduleFileUrlFlush()
	}
}

function promoteFileUrlRequest(
	fileId: string,
	rendition: FileUrlRendition,
	priority: FileUrlRequestPriority,
	designProjectId?: string,
	resourceVersion?: string,
	fileApi?: FileApi,
): void {
	const group = fileUrlRequestGroups.get(
		buildFileUrlIdentityKey(fileId, rendition, designProjectId, resourceVersion, fileApi),
	)
	if (!group || group.status === "in-flight") return
	if (FILE_URL_PRIORITY_RANK[priority] >= FILE_URL_PRIORITY_RANK[group.priority]) return
	group.priority = priority
	if (group.status === "queued") scheduleFileUrlFlush()
}

function requestFileUrl(options: {
	fileId: string
	rendition: FileUrlRendition
	priority?: FileUrlRequestPriority
	designProjectId?: string
	forceRefresh?: boolean
	resourceVersion?: string
	fileApi?: FileApi
}): Promise<GetTemporaryDownloadUrlItem & { url: string }> {
	const priority = options.priority ?? "visible"
	const baseIdentityKey = buildFileUrlIdentityKey(
		options.fileId,
		options.rendition,
		options.designProjectId,
		options.resourceVersion,
		options.fileApi,
	)
	const existingGroup = fileUrlRequestGroups.get(baseIdentityKey)

	if (options.forceRefresh) {
		invalidateSharedMediaUrl(options.fileId)
		// A queued/admitted group belongs to the previous refresh generation too.
		// Leave it alive for its original callers, but let this caller create a new group.
	} else if (existingGroup) {
		promoteFileUrlRequest(
			options.fileId,
			options.rendition,
			priority,
			options.designProjectId,
			options.resourceVersion,
			options.fileApi,
		)
		return existingGroup.promise
	}

	if (!options.forceRefresh && cacheEnabled) {
		const cachedResult = getCachedSharedMediaUrls({
			fileIds: [options.fileId],
			options: {
				imageProcess:
					options.rendition === "image-process"
						? IMAGE_PROCESS_OPTIONS.xMagicImageProcess
						: undefined,
				fileResourceVersionMap:
					options.resourceVersion === undefined
						? undefined
						: { [options.fileId]: options.resourceVersion },
				identityKey: options.fileApi?.identityKey,
			},
		}).cached.find((item) => item.file_id === options.fileId && item.url)
		if (cachedResult?.url) {
			return Promise.resolve({ ...cachedResult, url: cachedResult.url })
		}
	}
	let resolveRequest!: (value: GetTemporaryDownloadUrlItem & { url: string }) => void
	let rejectRequest!: (error: Error) => void
	const promise = new Promise<GetTemporaryDownloadUrlItem & { url: string }>(
		(resolve, reject) => {
			resolveRequest = resolve
			rejectRequest = reject
		},
	)
	const group: FileUrlRequestGroup = {
		baseIdentityKey,
		fileId: options.fileId,
		rendition: options.rendition,
		designProjectId: options.designProjectId,
		priority,
		forceRefresh: options.forceRefresh === true,
		resourceVersion: options.resourceVersion,
		fileApi: options.fileApi,
		status: "queued",
		promise,
		resolve: resolveRequest,
		reject: rejectRequest,
		settled: false,
	}
	fileUrlRequestGroups.set(baseIdentityKey, group)
	activeFileUrlRequestGroups.add(group)
	scheduleFileUrlFlush()
	return promise
}

export async function getFileInfoByPath(
	filePath: string,
	filesList?: FileItem[],
	options?: {
		useImageProcess?: boolean
		forceRefresh?: boolean
		designProjectBasePath?: string
		designProjectId?: string
		attachmentIndex?: DesignAttachmentIndex | null
		attachmentsSnapshotKeyOverride?: string
		hasAttachmentSnapshot?: boolean
		priority?: FileUrlRequestPriority
		/** Request identity bound at the React boundary; part of the in-flight key. */
		fileApi?: FileApi
	},
): Promise<GetFileInfoResponse | null> {
	const storeFiles = getStoreFiles(filesList)
	const hasAttachmentSnapshot = resolveHasAttachmentSnapshot(
		storeFiles,
		options?.hasAttachmentSnapshot,
	)
	const targetResolution = resolveFileInfoCacheTarget(filePath, {
		designProjectBasePath: options?.designProjectBasePath,
		flatAttachments: storeFiles,
		attachmentIndex: options?.attachmentIndex,
		attachmentsReady: hasAttachmentSnapshot,
	})
	// 路径歧义、历史附件尚未就绪或非法输入都不能读取任一候选缓存。
	if (targetResolution.status !== "resolved") return null
	const target = targetResolution.target

	const attachmentsSnapshotKey = hasAttachmentSnapshot
		? (options?.attachmentsSnapshotKeyOverride ?? buildAttachmentsSnapshotKey(filesList))
		: undefined
	const shouldBypassCache = options?.forceRefresh === true
	const forceRefreshToken = shouldBypassCache ? Symbol(`force-refresh:${filePath}`) : undefined
	const forceRefreshCacheKeys = new Set<string>()
	const clearForceRefreshTokens = () => {
		if (!forceRefreshToken) return
		forceRefreshCacheKeys.forEach((cacheKey) => {
			if (forceRefreshRequestTokens.get(cacheKey) === forceRefreshToken) {
				forceRefreshRequestTokens.delete(cacheKey)
			}
		})
	}
	if (forceRefreshToken) {
		const renditions: FileUrlRendition[] = target.fileItem
			? [resolveFileUrlRendition(options?.useImageProcess, target.fileItem.file_size)]
			: ["raw", "image-process"]
		renditions.forEach((rendition) => {
			const cacheKey = buildScopedPathKey(
				target.normalizedPath,
				options?.designProjectId,
				rendition,
				options?.fileApi?.identityKey,
			)
			const cachedEntry = fileInfoCache.get(cacheKey)
			if (cachedEntry?.resolvedFileId) {
				invalidateFileUrlResultsForFileId(
					cachedEntry.resolvedFileId,
					options?.designProjectId,
				)
			}
			forceRefreshRequestTokens.set(cacheKey, forceRefreshToken)
			forceRefreshCacheKeys.add(cacheKey)
			deleteMemoryCache(cacheKey)
		})
	}

	if (!shouldBypassCache && cacheEnabled) {
		const cachedFileItem = target.fileItem
		const rendition = resolveFileUrlRendition(
			options?.useImageProcess,
			cachedFileItem?.file_size,
		)
		const cacheKey = buildScopedPathKey(
			target.normalizedPath,
			options?.designProjectId,
			rendition,
			options?.fileApi?.identityKey,
		)
		const cachedEntry = fileInfoCache.get(cacheKey)
		if (cachedEntry) {
			const staleReasons = getCachedEntryStaleReasons(
				cachedEntry,
				cachedFileItem,
				hasAttachmentSnapshot,
			)
			if (staleReasons.length > 0) {
				invalidateFileUrlResultsForFileId(
					cachedEntry.resolvedFileId ?? "",
					options?.designProjectId,
				)
				deleteMemoryCache(cacheKey)
			} else {
				fileInfoCache.delete(cacheKey)
				fileInfoCache.set(cacheKey, cachedEntry)
				return mergeFileItemMetaIntoFileInfo(cachedEntry.fileInfo, cachedFileItem)
			}
		}
	}

	if (!shouldBypassCache) {
		const currentFileItem = target.fileItem
		const rendition = resolveFileUrlRendition(
			options?.useImageProcess,
			currentFileItem?.file_size,
		)
		const cacheKey = buildScopedPathKey(
			target.normalizedPath,
			options?.designProjectId,
			rendition,
			options?.fileApi?.identityKey,
		)
		const requestCacheKey = buildRequestCacheKey(cacheKey, rendition)
		const cachedRequest = fileInfoRequestCache.get(requestCacheKey)
		if (cachedRequest) {
			if (hasAttachmentSnapshot && !currentFileItem) {
				fileInfoRequestCache.delete(requestCacheKey)
			} else if (currentFileItem && cachedRequest.fileId !== currentFileItem.file_id) {
				fileInfoRequestCache.delete(requestCacheKey)
			} else if (
				currentFileItem &&
				cachedRequest.resourceVersion &&
				cachedRequest.resourceVersion !== buildFileResourceVersion(currentFileItem)
			) {
				fileInfoRequestCache.delete(requestCacheKey)
			} else {
				promoteFileUrlRequest(
					cachedRequest.fileId,
					cachedRequest.rendition,
					options?.priority ?? "visible",
					options?.designProjectId,
					cachedRequest.resourceVersion,
					options?.fileApi,
				)

				return cachedRequest.promise.then((result) =>
					mergeFileItemMetaIntoFileInfo(result, currentFileItem),
				)
			}
		}
	}

	let resolvedTarget = target.fileItem
		? {
				normalizedPath: target.normalizedPath,
				fileItem: target.fileItem,
			}
		: null
	if (!resolvedTarget) {
		if (hasAttachmentSnapshot) {
			const latestStoreFiles = getStoreFiles(undefined)
			const latestHasFilesContext = latestStoreFiles.length > 0
			const latestSnapshotKey = latestHasFilesContext
				? buildAttachmentsSnapshotKey(latestStoreFiles)
				: undefined
			if (latestHasFilesContext && latestSnapshotKey !== attachmentsSnapshotKey) {
				const latestResolution = resolveFileInfoCacheTarget(filePath, {
					designProjectBasePath: options?.designProjectBasePath,
					flatAttachments: latestStoreFiles,
					attachmentsReady: true,
				})
				if (latestResolution.status === "resolved" && latestResolution.target.fileItem) {
					resolvedTarget = {
						normalizedPath: latestResolution.target.normalizedPath,
						fileItem: latestResolution.target.fileItem,
					}
				}
			}
			if (!resolvedTarget) {
				// 附件列表已有快照：当前 path 在列表中不存在即视为不存在，不再阻塞等待
				clearForceRefreshTokens()
				return null
			}
		}

		if (!resolvedTarget) {
			// 附件快照尚未就绪：上传/重命名与 workspaceFilesList 填充存在时序，仅在此场景重试
			for (let i = 0; i < 2; i++) {
				await new Promise((resolve) => setTimeout(resolve, 3000))
				const latestStoreFiles = getStoreFiles(undefined)
				const latestResolution = resolveFileInfoCacheTarget(filePath, {
					designProjectBasePath: options?.designProjectBasePath,
					flatAttachments: latestStoreFiles,
					attachmentsReady: resolveHasAttachmentSnapshot(
						latestStoreFiles,
						options?.hasAttachmentSnapshot,
					),
				})
				if (latestResolution.status === "resolved" && latestResolution.target.fileItem) {
					resolvedTarget = {
						normalizedPath: latestResolution.target.normalizedPath,
						fileItem: latestResolution.target.fileItem,
					}
					break
				}
			}
			if (!resolvedTarget) {
				clearForceRefreshTokens()
				return null
			}
		}
	}

	const { fileItem, normalizedPath } = resolvedTarget
	const rendition = resolveFileUrlRendition(options?.useImageProcess, fileItem.file_size)
	const cacheKey = buildScopedPathKey(
		normalizedPath,
		options?.designProjectId,
		rendition,
		options?.fileApi?.identityKey,
	)
	const requestCacheKey = buildRequestCacheKey(cacheKey, rendition)
	const requestToken = forceRefreshToken ?? Symbol(requestCacheKey)
	if (forceRefreshToken && !forceRefreshCacheKeys.has(cacheKey)) {
		forceRefreshRequestTokens.set(cacheKey, requestToken)
		forceRefreshCacheKeys.add(cacheKey)
		deleteMemoryCache(cacheKey)
	}
	const resourceVersion = buildFileResourceVersion(fileItem)
	const requestPromise = requestFileUrl({
		fileId: fileItem.file_id,
		rendition,
		priority: options?.priority,
		designProjectId: options?.designProjectId,
		forceRefresh: shouldBypassCache,
		resourceVersion,
		fileApi: options?.fileApi,
	}).then(
		(urlItem): GetFileInfoResponse => {
			const result: GetFileInfoResponse = {
				src: urlItem.url,
				fileName:
					fileItem.file_name || fileItem.display_filename || fileItem.filename || "",
				...(urlItem.expires_at ? { expires_at: urlItem.expires_at } : {}),
				...(fileItem.source !== undefined ? { source: fileItem.source } : {}),
				...(urlItem.version !== undefined ? { version: urlItem.version } : {}),
				resource_version: buildResourceVersion({
					resourceVersion: getFileItemStrongResourceVersion(fileItem),
					fileId: fileItem.file_id,
					updatedAt: fileItem.updated_at ?? urlItem.updated_at,
					fileSize: fileItem.file_size,
				}),
				...(fileItem.updated_at !== undefined || urlItem.updated_at !== undefined
					? { updated_at: fileItem.updated_at ?? urlItem.updated_at }
					: {}),
				...(fileItem.file_size !== undefined ? { content_length: fileItem.file_size } : {}),
			}

			const isCurrentRequest = shouldBypassCache
				? forceRefreshRequestTokens.get(cacheKey) === requestToken
				: fileInfoRequestCache.get(requestCacheKey)?.token === requestToken
			if (cacheEnabled && isCurrentRequest) {
				setMemoryCache(
					cacheKey,
					result,
					fileItem.file_id,
					getPreviewFileUrlWatermarkSignature(),
				)
			}
			if (!shouldBypassCache) {
				clearPendingPathRequest(requestCacheKey, requestToken)
			} else {
				clearForceRefreshTokens()
			}
			return result
		},
		(error) => {
			if (!shouldBypassCache) {
				clearPendingPathRequest(requestCacheKey, requestToken)
			} else {
				clearForceRefreshTokens()
			}
			throw error
		},
	)

	if (!shouldBypassCache) {
		fileInfoRequestCache.set(requestCacheKey, {
			promise: requestPromise,
			fileId: fileItem.file_id,
			rendition,
			token: requestToken,
			resourceVersion,
		})
	}
	return requestPromise
}

export async function getFileResourceMetaByPath(
	filePath: string,
	filesList?: FileItem[],
	options?: {
		designProjectBasePath?: string
		designProjectId?: string
		attachmentIndex?: DesignAttachmentIndex | null
		hasAttachmentSnapshot?: boolean
	},
): Promise<CanvasFileResourceMeta> {
	const storeFiles = getStoreFiles(filesList)
	const hasAttachmentSnapshot = resolveHasAttachmentSnapshot(
		storeFiles,
		options?.hasAttachmentSnapshot,
	)
	const targetResolution = resolveFileInfoCacheTarget(filePath, {
		designProjectBasePath: options?.designProjectBasePath,
		flatAttachments: storeFiles,
		attachmentIndex: options?.attachmentIndex,
		attachmentsReady: hasAttachmentSnapshot,
	})
	if (targetResolution.status !== "resolved") {
		return targetResolution.status === "not-found" &&
			hasAttachmentSnapshot &&
			targetResolution.candidates.length === 1
			? { status: "deleted" }
			: { status: "unknown" }
	}
	const target = targetResolution.target

	let fileItem = target.fileItem

	if (!fileItem && hasAttachmentSnapshot) {
		const latestStoreFiles = getStoreFiles(undefined)
		const latestHasFilesContext = latestStoreFiles.length > 0
		if (latestHasFilesContext && latestStoreFiles !== storeFiles) {
			const latestResolution = resolveFileInfoCacheTarget(filePath, {
				designProjectBasePath: options?.designProjectBasePath,
				flatAttachments: latestStoreFiles,
				attachmentsReady: true,
			})
			if (latestResolution.status === "resolved") {
				fileItem = latestResolution.target.fileItem
			}
		}
	}

	if (!fileItem) {
		const optimisticMeta = getOptimisticFileResourceMeta(
			target.normalizedPath,
			options?.designProjectId,
		)
		if (optimisticMeta) return optimisticMeta
		const result = hasAttachmentSnapshot
			? { status: "deleted" as const }
			: { status: "unknown" as const }
		return result
	}

	return buildFileResourceMeta(fileItem)
}

export function setFileInfoCache(
	path: string,
	fileInfo: GetFileInfoResponse,
	filesList?: FileItem[],
	designProjectBasePath?: string,
	designProjectId?: string,
	attachmentIndex?: DesignAttachmentIndex | null,
	options?: { allowMissingAttachment?: boolean; hasAttachmentSnapshot?: boolean },
): void {
	if (!cacheEnabled) return

	const storeFiles = getStoreFiles(filesList)
	const hasAttachmentSnapshot = resolveHasAttachmentSnapshot(
		storeFiles,
		options?.hasAttachmentSnapshot,
	)
	const targetResolution = resolveFileInfoCacheTarget(path, {
		designProjectBasePath,
		flatAttachments: storeFiles,
		attachmentIndex,
		attachmentsReady: hasAttachmentSnapshot,
	})
	if (targetResolution.status !== "resolved") return
	const targetCandidate = targetResolution.target

	const cacheKey = buildScopedPathKey(targetCandidate.normalizedPath, designProjectId)
	const fileInfoFileId = (fileInfo as { file_id?: unknown }).file_id
	const resolvedFileId =
		targetCandidate.fileItem?.file_id ??
		(typeof fileInfoFileId === "string"
			? fileInfoFileId
			: typeof fileInfoFileId === "number"
				? String(fileInfoFileId)
				: undefined)
	// 手动 prime 代表当前 path 的新一代结果；先使两个 rendition 的旧 path 请求、
	// completed identity URL 失效，避免旧 in-flight response 回写覆盖新 URL。
	;(["raw", "image-process"] as FileUrlRendition[]).forEach((rendition) => {
		const renditionCacheKey = buildScopedPathKey(
			targetCandidate.normalizedPath,
			designProjectId,
			rendition,
		)
		const cachedEntry = fileInfoCache.get(renditionCacheKey)
		supersedeFileUrlRequestsForFileId(
			cachedEntry?.resolvedFileId ?? resolvedFileId ?? "",
			designProjectId,
		)
		deleteMemoryCache(renditionCacheKey)
	})
	setMemoryCache(
		cacheKey,
		mergeFileItemMetaIntoFileInfo(fileInfo, targetCandidate.fileItem),
		resolvedFileId,
		getPreviewFileUrlWatermarkSignature(),
		{ allowMissingAttachment: options?.allowMissingAttachment },
	)
}

export async function getFileInfoById(
	fileId: string,
	fileName?: string,
	fileSize?: number,
	options?: {
		useImageProcess?: boolean
		filesList?: FileItem[]
		priority?: FileUrlRequestPriority
		designProjectId?: string
		/** Request identity bound at the React boundary; part of the in-flight key. */
		fileApi?: FileApi
	},
): Promise<GetFileInfoResponseWithFileId> {
	if (!fileId) {
		throw new Error("file_id is required")
	}

	const meta = findFileItemByFileId(fileId, options?.filesList)
	const effectiveFileSize = meta?.file_size ?? fileSize
	const rendition = resolveFileUrlRendition(options?.useImageProcess, effectiveFileSize)
	const resourceVersion = meta
		? buildFileResourceVersion(meta)
		: effectiveFileSize !== undefined
			? buildResourceVersion({ fileId, fileSize: effectiveFileSize })
			: undefined
	const urlItem = await requestFileUrl({
		fileId,
		rendition,
		priority: options?.priority ?? "critical",
		designProjectId: options?.designProjectId,
		resourceVersion,
		fileApi: options?.fileApi,
	})
	const result: GetFileInfoResponse = mergeFileItemMetaIntoFileInfo(
		{
			src: urlItem.url,
			fileName: fileName || meta?.file_name || meta?.display_filename || meta?.filename || "",
			...(urlItem.expires_at ? { expires_at: urlItem.expires_at } : {}),
			...(urlItem.version !== undefined ? { version: urlItem.version } : {}),
			...(urlItem.updated_at ? { updated_at: urlItem.updated_at } : {}),
		},
		meta,
	)

	// 这里只给宿主内部链路使用，返回值保留 file_id，CanvasDesign 本身不消费它。
	const contentLength = result.content_length ?? meta?.file_size ?? fileSize
	const updatedAt = meta?.updated_at ?? result.updated_at ?? urlItem.updated_at
	return {
		...result,
		file_id: fileId,
		resource_version:
			result.resource_version ??
			buildResourceVersion({
				fileId,
				updatedAt,
				fileSize: meta?.file_size ?? fileSize,
			}),
		...(contentLength !== undefined ? { content_length: contentLength } : {}),
	}
}

export function clearAllFileInfoCache(): void {
	clearSharedMediaUrlCache()

	fileInfoCache.clear()
	fileInfoRequestCache.clear()
	forceRefreshRequestTokens.clear()
	clearFileUrlFlushSchedule()
	activeFileUrlRequestGroups.forEach((group) => {
		settleFileUrlRequestGroup(group, new Error("File URL request cancelled"))
	})
	fileUrlRequestGroups.clear()
	activeFileUrlRequestGroups.clear()
}

export function setCacheEnabled(enabled: boolean): void {
	cacheEnabled = enabled
}

export function isCacheEnabled(): boolean {
	return cacheEnabled
}

export function cleanupFileInfoCache(
	filesList?: FileItem[],
	designProjectId?: string,
	options?: { hasAttachmentSnapshot?: boolean },
): void {
	const storeFiles = getStoreFiles(filesList)
	const hasAttachmentSnapshot = resolveHasAttachmentSnapshot(
		storeFiles,
		options?.hasAttachmentSnapshot,
	)
	if (!hasAttachmentSnapshot) {
		return
	}

	const namespace = buildNamespaceKey(designProjectId)

	const currentFilePaths = new Set<string>()
	const currentFileIdByPath = new Map<string, string>()
	const currentResourceVersionByPath = new Map<string, string>()

	storeFiles.forEach((item) => {
		if (!item.is_directory && item.relative_file_path) {
			const normalizedPath = stripPathEdgeSlashes(
				normalizePathSeparators(item.relative_file_path),
			)
			if (normalizedPath) {
				currentFilePaths.add(normalizedPath)
				if (item.file_id) {
					currentFileIdByPath.set(normalizedPath, item.file_id)
					currentResourceVersionByPath.set(normalizedPath, buildFileResourceVersion(item))
				}
			}
		}
	})

	const keysToDelete: string[] = []
	fileInfoRequestCache.forEach((pending, requestCacheKey) => {
		const cacheKey = getPathCacheKeyFromRequestCacheKey(requestCacheKey)
		const parsedKey = parseScopedPathKey(cacheKey)
		if (parsedKey.namespace !== namespace) return
		if (
			currentFileIdByPath.get(parsedKey.normalizedPath) !== pending.fileId ||
			(pending.resourceVersion &&
				currentResourceVersionByPath.get(parsedKey.normalizedPath) !==
					pending.resourceVersion)
		) {
			fileInfoRequestCache.delete(requestCacheKey)
		}
	})

	fileInfoCache.forEach((entry, cacheKey) => {
		const parsedKey = parseScopedPathKey(cacheKey)
		if (parsedKey.namespace !== namespace) return

		// 附件列表里已经不存在这个相对路径，说明缓存已经脱离当前设计目录状态。
		if (!currentFilePaths.has(parsedKey.normalizedPath)) {
			if (isOptimisticMissingAttachmentAllowed(entry)) {
				return
			}
			invalidateFileUrlResultsForFileId(entry.resolvedFileId ?? "", designProjectId)
			keysToDelete.push(cacheKey)
			return
		}

		// 路径仍在，但当前 path 对应的 file_id 已变化，视为同路径资源被替换。
		if (
			entry.resolvedFileId &&
			currentFileIdByPath.get(parsedKey.normalizedPath) !== entry.resolvedFileId
		) {
			invalidateFileUrlResultsForFileId(entry.resolvedFileId, designProjectId)
			keysToDelete.push(cacheKey)
			return
		}
		if (
			currentResourceVersionByPath.has(parsedKey.normalizedPath) &&
			entry.resolvedResourceVersion &&
			entry.resolvedResourceVersion !==
				currentResourceVersionByPath.get(parsedKey.normalizedPath)
		) {
			invalidateFileUrlResultsForFileId(entry.resolvedFileId ?? "", designProjectId)
			keysToDelete.push(cacheKey)
		}
	})

	keysToDelete.forEach((cacheKey) => {
		deleteMemoryCache(cacheKey)
	})
}
