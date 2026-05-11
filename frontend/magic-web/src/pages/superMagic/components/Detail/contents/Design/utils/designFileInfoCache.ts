import type { GetFileInfoResponse } from "@/components/CanvasDesign/types.magic"
import { parseExpiresAt, isOssExpired } from "@/components/CanvasDesign/canvas/utils/ossExpiryUtils"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import projectFilesStore from "@/stores/projectFiles"
import { normalizePath } from "./utils"
import {
	getResolvedPathCandidates,
	lookupAttachmentAmongCandidates,
	lookupAttachmentForSingleNormalizedPath,
} from "./designAttachmentPathLookup"
import { GetFileInfoResponseWithFileId } from "./uploadCallbacks"
import { getPreviewFileUrlWatermarkSignature } from "@/utils/aiWatermarkPreviewFileUrlMode"
import type { ImageProcessOptions } from "@/utils/image-processing"
import {
	buildAttachmentsSnapshotKeyFromFlatFiles,
	type DesignAttachmentIndex,
} from "./designAttachmentIndex"

const IMAGE_PROCESS_OPTIONS: { xMagicImageProcess?: ImageProcessOptions } = {
	xMagicImageProcess: {
		format: "webp",
	},
}

// 图片处理大小限制 50MB
const IMAGE_PROCESS_SIZE_LIMIT = 50971420
// 批量请求窗口时间 100ms
const BATCH_REQUEST_WINDOW_MS = 100
// 默认缓存时间 15 分钟
const DEFAULT_TTL_MS = 15 * 60 * 1000
// 缓存存储 key（v3：条目绑定附件快照，路径/更新时间变更导致 URL 失效时强制整批失效）
const FILE_INFO_STORAGE_KEY = "MAGIC:supermagic-design:file-info-cache:v3"
const LEGACY_FILE_INFO_STORAGE_KEY = "MAGIC:supermagic-design:file-info-cache"
const FILE_INFO_CACHE_PAYLOAD_VERSION = 3 as const

/** 是否启用换链结果缓存：为 false 时不读内存命中、不写内存/持久化（可由 setCacheEnabled 切换，用于调试或强制每次拉新 URL） */
let cacheEnabled = true
/** localStorage 冷启动数据是否已灌入内存：ensureStorageCacheLoaded 只执行一次，避免每次 getFileInfo 都解析持久化 JSON */
let storageCacheLoaded = false

interface CacheEntry {
	fileInfo: GetFileInfoResponse
	/** 写入时 getTemporaryDownloadUrl 自动 download_mode 水印语义，与 getPreviewFileUrlWatermarkSignature() 一致 */
	previewWatermarkSignature: string
	/** 当前 designProject 附件列表快照；目录移动时即使 file_id 不变，也要让旧 URL 整批失效 */
	attachmentsSnapshotKey?: string
	// 当接口未返回 expires_at 时，使用写入时间 + DEFAULT_TTL_MS 兜底过期
	cachedAt?: number
	// 记录当前 path 在最近一次解析时对应的 file_id，用于识别“同路径文件被替换”
	resolvedFileId?: string
}

interface PersistedFileInfoCachePayload {
	version: typeof FILE_INFO_CACHE_PAYLOAD_VERSION
	entries: Record<string, CacheEntry>
}

interface BatchRequestItem {
	cacheKey: string
	path: string
	normalizedPath: string
	fileId: string
	fileName: string
	fileSize?: number
	source?: FileItem["source"]
	useImageProcess?: boolean
	attachmentsSnapshotKey?: string
	resolve: (value: GetFileInfoResponse) => void
	reject: (error: Error) => void
}

// 主缓存：key = designProjectId + normalizedRelativePath
const fileInfoRequestCache = new Map<string, Promise<GetFileInfoResponse>>()
const fileInfoCache = new Map<string, CacheEntry>()
const namespaceAttachmentsSnapshotCache = new Map<string, string>()
/** 命名空间 → 该空间下出现过的 scoped cacheKey，用于 O(1) 批量失效（辅以存储回填时的 register） */
const scopedCacheKeysByNamespace = new Map<string, Set<string>>()
// path 维度请求去重，避免同一资源在短时间内重复换链
const fileInfoByIdRequestCache = new Map<string, Promise<GetFileInfoResponseWithFileId>>()
// 上传完成但附件列表尚未刷新时，允许宿主层按 file_id 直接换链
const batchQueue: BatchRequestItem[] = []

let batchTimer: NodeJS.Timeout | null = null

function shouldUseImageProcess(fileSize?: number): boolean {
	if (fileSize === undefined || fileSize === null || fileSize <= 0) {
		return false
	}
	return fileSize < IMAGE_PROCESS_SIZE_LIMIT
}

function getCacheStorage(): Storage | null {
	if (typeof window === "undefined") return null

	try {
		return window.localStorage
	} catch {
		return null
	}
}

function getStoreFiles(filesList?: FileItem[]): FileItem[] {
	return (filesList || projectFilesStore.workspaceFilesList || []) as FileItem[]
}

// 画布内只认相对路径；缓存层额外拼上 designProjectId 做命名空间，避免不同设计目录串 key。
function buildScopedPathKey(normalizedPath: string, designProjectId?: string): string {
	const namespace = designProjectId || "__global__"
	return `${namespace}\0${normalizedPath}`
}

function buildNamespaceKey(designProjectId?: string): string {
	return designProjectId || "__global__"
}

function parseScopedPathKey(scopedPathKey: string): {
	namespace: string
	normalizedPath: string
} {
	const separatorIndex = scopedPathKey.indexOf("\0")
	if (separatorIndex < 0) {
		return {
			namespace: "__global__",
			normalizedPath: scopedPathKey,
		}
	}
	return {
		namespace: scopedPathKey.slice(0, separatorIndex),
		normalizedPath: scopedPathKey.slice(separatorIndex + 1),
	}
}

function isCachedFileInfoExpired(entry: CacheEntry): boolean {
	const expiresAtTs = parseExpiresAt(entry.fileInfo.expires_at)
	if (expiresAtTs !== null) {
		return isOssExpired(expiresAtTs)
	}
	if (entry.cachedAt === undefined) {
		return false
	}
	return Date.now() - entry.cachedAt >= DEFAULT_TTL_MS
}

function isPreviewWatermarkSignatureStale(entry: CacheEntry): boolean {
	return entry.previewWatermarkSignature !== getPreviewFileUrlWatermarkSignature()
}

function trackScopedCacheKey(cacheKey: string): void {
	const { namespace } = parseScopedPathKey(cacheKey)
	let set = scopedCacheKeysByNamespace.get(namespace)
	if (!set) {
		set = new Set()
		scopedCacheKeysByNamespace.set(namespace, set)
	}
	set.add(cacheKey)
}

function untrackScopedCacheKey(cacheKey: string): void {
	const { namespace } = parseScopedPathKey(cacheKey)
	scopedCacheKeysByNamespace.get(namespace)?.delete(cacheKey)
}

function buildAttachmentsSnapshotKey(filesList?: FileItem[]): string {
	return buildAttachmentsSnapshotKeyFromFlatFiles(getStoreFiles(filesList))
}

function deleteNamespaceRequestCache(namespace: string): void {
	const tracked = scopedCacheKeysByNamespace.get(namespace)
	if (tracked?.size) {
		tracked.forEach((cacheKey) => {
			fileInfoRequestCache.delete(cacheKey)
		})
	}
	fileInfoRequestCache.forEach((_, cacheKey) => {
		if (parseScopedPathKey(cacheKey).namespace === namespace) {
			fileInfoRequestCache.delete(cacheKey)
		}
	})
}

function deleteNamespaceMemoryCache(namespace: string): boolean {
	const tracked = scopedCacheKeysByNamespace.get(namespace)
	let removed = false
	if (tracked?.size) {
		tracked.forEach((cacheKey) => {
			if (fileInfoCache.delete(cacheKey)) removed = true
			fileInfoRequestCache.delete(cacheKey)
		})
		scopedCacheKeysByNamespace.delete(namespace)
		return removed
	}
	const keysToDelete: string[] = []
	fileInfoCache.forEach((_, cacheKey) => {
		if (parseScopedPathKey(cacheKey).namespace === namespace) {
			keysToDelete.push(cacheKey)
		}
	})

	keysToDelete.forEach((cacheKey) => {
		deleteMemoryCache(cacheKey)
	})

	return keysToDelete.length > 0
}

function syncNamespaceAttachmentsSnapshot(namespace: string, attachmentsSnapshotKey: string): void {
	const previousSnapshotKey = namespaceAttachmentsSnapshotCache.get(namespace)
	if (previousSnapshotKey === attachmentsSnapshotKey) return

	namespaceAttachmentsSnapshotCache.set(namespace, attachmentsSnapshotKey)
	if (previousSnapshotKey === undefined) return

	const shouldPersistCache = deleteNamespaceMemoryCache(namespace)
	deleteNamespaceRequestCache(namespace)
	if (shouldPersistCache) {
		persistCacheToStorage()
	}
}

function isAttachmentsSnapshotStale(
	entry: CacheEntry,
	attachmentsSnapshotKey?: string,
	hasFilesContext?: boolean,
): boolean {
	if (!hasFilesContext || attachmentsSnapshotKey === undefined) {
		return false
	}
	return entry.attachmentsSnapshotKey !== attachmentsSnapshotKey
}

function setMemoryCache(
	cacheKey: string,
	fileInfo: GetFileInfoResponse,
	resolvedFileId?: string,
	previewWatermarkSignature: string = getPreviewFileUrlWatermarkSignature(),
	attachmentsSnapshotKey?: string,
): void {
	trackScopedCacheKey(cacheKey)
	fileInfoCache.set(cacheKey, {
		fileInfo,
		previewWatermarkSignature,
		attachmentsSnapshotKey,
		resolvedFileId,
		...(fileInfo.expires_at ? {} : { cachedAt: Date.now() }),
	})
}

function deleteMemoryCache(cacheKey: string): void {
	untrackScopedCacheKey(cacheKey)
	fileInfoCache.delete(cacheKey)
	fileInfoRequestCache.delete(cacheKey)
}

function persistCacheToStorage(): void {
	const storage = getCacheStorage()
	if (!storage) return

	try {
		const payload: PersistedFileInfoCachePayload = {
			version: FILE_INFO_CACHE_PAYLOAD_VERSION,
			entries: Object.fromEntries(fileInfoCache.entries()),
		}
		storage.setItem(FILE_INFO_STORAGE_KEY, JSON.stringify(payload))
	} catch {
		//
	}
}

function clearPersistedCache(): void {
	const storage = getCacheStorage()
	if (!storage) return

	try {
		storage.removeItem(FILE_INFO_STORAGE_KEY)
	} catch {
		//
	}
}

function ensureStorageCacheLoaded(): void {
	if (storageCacheLoaded) return

	storageCacheLoaded = true
	const storage = getCacheStorage()
	if (!storage) return

	try {
		try {
			storage.removeItem(LEGACY_FILE_INFO_STORAGE_KEY)
		} catch {
			//
		}

		const raw = storage.getItem(FILE_INFO_STORAGE_KEY)
		if (!raw) return

		const parsed = JSON.parse(raw) as Partial<PersistedFileInfoCachePayload> | null
		if (!parsed || typeof parsed !== "object") {
			clearPersistedCache()
			return
		}

		if (parsed.version !== FILE_INFO_CACHE_PAYLOAD_VERSION) {
			clearPersistedCache()
			return
		}

		let shouldSyncStorage = false
		for (const [cacheKey, entry] of Object.entries(parsed.entries ?? {})) {
			if (!entry?.fileInfo?.src) {
				shouldSyncStorage = true
				continue
			}

			if (!entry.previewWatermarkSignature) {
				shouldSyncStorage = true
				continue
			}

			if (!entry.attachmentsSnapshotKey) {
				shouldSyncStorage = true
				continue
			}

			if (!entry.fileInfo.expires_at && entry.cachedAt === undefined) {
				shouldSyncStorage = true
				continue
			}

			fileInfoCache.set(cacheKey, entry as CacheEntry)
			trackScopedCacheKey(cacheKey)
			if (isCachedFileInfoExpired(entry as CacheEntry)) {
				deleteMemoryCache(cacheKey)
				shouldSyncStorage = true
			}
		}

		if (shouldSyncStorage) {
			persistCacheToStorage()
		}
	} catch {
		clearPersistedCache()
	}
}

function findFileItemByFileId(fileId: string, filesList?: FileItem[]): FileItem | null {
	if (!fileId) return null
	const found = getStoreFiles(filesList).find(
		(item) => !item.is_directory && item.file_id === fileId,
	)
	return found ?? null
}

function mergeFileItemMetaIntoFileInfo(
	base: GetFileInfoResponse,
	fileItem: FileItem | null,
): GetFileInfoResponse {
	if (!fileItem) return base
	return {
		...base,
		...(fileItem.source !== undefined ? { source: fileItem.source } : {}),
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
		return true
	}
	// 同一路径解析出了新的 file_id，说明发生了同名替换，旧 URL 必须丢弃。
	if (entry.resolvedFileId && entry.resolvedFileId !== fileItem.file_id) {
		return true
	}
	return false
}

// 将短时间内的多个 path 请求合并成一轮 file_id 批量换链，减少接口压力。
async function executeBatchRequest(): Promise<void> {
	if (batchQueue.length === 0) return

	const queue = [...batchQueue]
	batchQueue.length = 0
	batchTimer = null

	const withImageProcess: BatchRequestItem[] = []
	const withoutImageProcess: BatchRequestItem[] = []

	for (const item of queue) {
		if (item.useImageProcess === true && shouldUseImageProcess(item.fileSize)) {
			withImageProcess.push(item)
		} else {
			withoutImageProcess.push(item)
		}
	}

	if (withImageProcess.length > 0) {
		try {
			const fileIds = withImageProcess.map((item) => item.fileId)
			const downloadUrls = await getTemporaryDownloadUrl({
				file_ids: fileIds,
				options: IMAGE_PROCESS_OPTIONS,
			})
			processBatchRequestResults(withImageProcess, downloadUrls)
		} catch (error) {
			withImageProcess.forEach((item) => {
				item.reject(error as Error)
				fileInfoRequestCache.delete(item.cacheKey)
			})
		}
	}

	if (withoutImageProcess.length > 0) {
		try {
			const fileIds = withoutImageProcess.map((item) => item.fileId)
			const downloadUrls = await getTemporaryDownloadUrl({
				file_ids: fileIds,
			})
			processBatchRequestResults(withoutImageProcess, downloadUrls)
		} catch (error) {
			withoutImageProcess.forEach((item) => {
				item.reject(error as Error)
				fileInfoRequestCache.delete(item.cacheKey)
			})
		}
	}
}

function processBatchRequestResults(
	queue: BatchRequestItem[],
	downloadUrls: Array<{ file_id?: string; url?: string; expires_at?: string }> | null | undefined,
): void {
	if (!downloadUrls?.length) {
		queue.forEach((item) => {
			item.reject(new Error(`无法获取文件下载地址: ${item.path}`))
			fileInfoRequestCache.delete(item.cacheKey)
		})
		return
	}

	const urlItemMap = new Map<string, { url: string; expires_at?: string }>()
	downloadUrls.forEach((urlItem) => {
		if (urlItem.file_id && urlItem.url) {
			urlItemMap.set(urlItem.file_id, {
				url: urlItem.url,
				expires_at: urlItem.expires_at,
			})
		}
	})

	let shouldPersistCache = false
	queue.forEach((item) => {
		const urlItem = urlItemMap.get(item.fileId)
		if (!urlItem?.url) {
			item.reject(new Error(`无法获取文件下载地址: ${item.path}`))
			fileInfoRequestCache.delete(item.cacheKey)
			return
		}

		const result: GetFileInfoResponse = {
			src: urlItem.url,
			fileName: item.fileName,
			...(urlItem.expires_at ? { expires_at: urlItem.expires_at } : {}),
			...(item.source !== undefined ? { source: item.source } : {}),
		}

		if (cacheEnabled) {
			// 缓存仍然按 path 维度存，但会记住本次解析到的 file_id 以便后续失效校验。
			setMemoryCache(
				item.cacheKey,
				result,
				item.fileId,
				getPreviewFileUrlWatermarkSignature(),
				item.attachmentsSnapshotKey,
			)
			shouldPersistCache = true
		}
		fileInfoRequestCache.delete(item.cacheKey)
		item.resolve(result)
	})

	if (shouldPersistCache) {
		persistCacheToStorage()
	}
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
	},
): Promise<GetFileInfoResponse | null> {
	ensureStorageCacheLoaded()

	const candidates = getResolvedPathCandidates(filePath, options?.designProjectBasePath)
	const fallbackCandidate = candidates[0]
	if (!fallbackCandidate) {
		return null
	}

	const namespace = buildNamespaceKey(options?.designProjectId)
	const storeFiles = getStoreFiles(filesList)
	const hasFilesContext = storeFiles.length > 0
	const attachmentsSnapshotKey = hasFilesContext
		? (options?.attachmentsSnapshotKeyOverride ?? buildAttachmentsSnapshotKey(filesList))
		: undefined
	if (attachmentsSnapshotKey !== undefined) {
		syncNamespaceAttachmentsSnapshot(namespace, attachmentsSnapshotKey)
	}
	const shouldBypassCache = options?.forceRefresh === true

	if (!shouldBypassCache && cacheEnabled) {
		for (const candidate of candidates) {
			const cacheKey = buildScopedPathKey(candidate.normalizedPath, options?.designProjectId)
			const cachedEntry = fileInfoCache.get(cacheKey)
			if (!cachedEntry) continue

			const cachedFileItem = lookupAttachmentForSingleNormalizedPath(
				candidate.normalizedPath,
				filePath,
				getStoreFiles(filesList),
				options?.attachmentIndex,
			)
			if (
				isCachedFileInfoExpired(cachedEntry) ||
				isPreviewWatermarkSignatureStale(cachedEntry) ||
				isAttachmentsSnapshotStale(cachedEntry, attachmentsSnapshotKey, hasFilesContext) ||
				shouldInvalidateCachedEntry(cachedEntry, cachedFileItem, hasFilesContext)
			) {
				deleteMemoryCache(cacheKey)
				persistCacheToStorage()
				continue
			}

			return mergeFileItemMetaIntoFileInfo(cachedEntry.fileInfo, cachedFileItem)
		}
	}

	if (!shouldBypassCache) {
		for (const candidate of candidates) {
			const cacheKey = buildScopedPathKey(candidate.normalizedPath, options?.designProjectId)
			const cachedRequest = fileInfoRequestCache.get(cacheKey)
			if (!cachedRequest) continue

			return cachedRequest.then((result) =>
				mergeFileItemMetaIntoFileInfo(
					result,
					lookupAttachmentForSingleNormalizedPath(
						candidate.normalizedPath,
						filePath,
						getStoreFiles(filesList),
						options?.attachmentIndex,
					),
				),
			)
		}
	}

	let lookupResult = lookupAttachmentAmongCandidates(
		candidates,
		filePath,
		getStoreFiles(filesList),
		options?.attachmentIndex,
	)
	if (!lookupResult) {
		if (hasFilesContext) {
			// 附件列表已有快照：当前 path 在列表中不存在即视为不存在，不再阻塞等待
			return null
		}

		// 列表尚未就绪（本地仍为空）：上传/重命名与 workspaceFilesList 填充存在时序，仅在此场景重试
		for (let i = 0; i < 2; i++) {
			await new Promise((resolve) => setTimeout(resolve, 3000))
			lookupResult = lookupAttachmentAmongCandidates(
				candidates,
				filePath,
				getStoreFiles(undefined),
				options?.attachmentIndex,
			)
			if (lookupResult) break
		}
		if (!lookupResult) {
			return null
		}
	}

	const { fileItem, normalizedPath, resolvedPath } = lookupResult
	const cacheKey = buildScopedPathKey(normalizedPath, options?.designProjectId)
	const requestPromise = new Promise<GetFileInfoResponse>((resolve, reject) => {
		batchQueue.push({
			cacheKey,
			path: resolvedPath,
			normalizedPath,
			fileId: fileItem.file_id,
			fileName: fileItem.file_name || fileItem.display_filename || fileItem.filename || "",
			fileSize: fileItem.file_size,
			source: fileItem.source,
			useImageProcess: options?.useImageProcess,
			attachmentsSnapshotKey,
			resolve,
			reject,
		})

		if (!batchTimer) {
			batchTimer = setTimeout(() => {
				executeBatchRequest()
			}, BATCH_REQUEST_WINDOW_MS)
		}
	})

	if (!shouldBypassCache) {
		trackScopedCacheKey(cacheKey)
		fileInfoRequestCache.set(cacheKey, requestPromise)
	}
	return requestPromise
}

export function setFileInfoCache(
	path: string,
	fileInfo: GetFileInfoResponse,
	filesList?: FileItem[],
	designProjectBasePath?: string,
	designProjectId?: string,
	attachmentIndex?: DesignAttachmentIndex | null,
): void {
	ensureStorageCacheLoaded()
	if (!cacheEnabled) return

	const candidates = getResolvedPathCandidates(path, designProjectBasePath)
	const lookupResult = lookupAttachmentAmongCandidates(
		candidates,
		path,
		getStoreFiles(filesList),
		attachmentIndex,
	)
	const targetCandidate = lookupResult ?? candidates[0]
	if (!targetCandidate) return

	const cacheKey = buildScopedPathKey(targetCandidate.normalizedPath, designProjectId)
	const attachmentsSnapshotKey =
		filesList && getStoreFiles(filesList).length > 0
			? (attachmentIndex?.attachmentsSnapshotKey ?? buildAttachmentsSnapshotKey(filesList))
			: undefined
	setMemoryCache(
		cacheKey,
		fileInfo,
		lookupResult?.fileItem.file_id,
		getPreviewFileUrlWatermarkSignature(),
		attachmentsSnapshotKey,
	)
	persistCacheToStorage()
}

export function getFileInfoCache(
	path: string,
	designProjectBasePath?: string,
	designProjectId?: string,
): GetFileInfoResponse | undefined {
	ensureStorageCacheLoaded()

	const candidates = getResolvedPathCandidates(path, designProjectBasePath)

	for (const candidate of candidates) {
		const cacheKey = buildScopedPathKey(candidate.normalizedPath, designProjectId)
		const entry = fileInfoCache.get(cacheKey)
		if (!entry) continue

		if (isCachedFileInfoExpired(entry) || isPreviewWatermarkSignatureStale(entry)) {
			deleteMemoryCache(cacheKey)
			persistCacheToStorage()
			continue
		}

		return entry.fileInfo
	}

	return undefined
}

export function clearFileInfoCache(
	path: string,
	designProjectBasePath?: string,
	designProjectId?: string,
): void {
	ensureStorageCacheLoaded()

	const candidates = getResolvedPathCandidates(path, designProjectBasePath)
	if (candidates.length === 0) return

	candidates.forEach((candidate) => {
		deleteMemoryCache(buildScopedPathKey(candidate.normalizedPath, designProjectId))
	})
	persistCacheToStorage()
}

export async function getFileInfoById(
	fileId: string,
	fileName?: string,
	fileSize?: number,
	options?: { useImageProcess?: boolean; filesList?: FileItem[] },
): Promise<GetFileInfoResponseWithFileId> {
	if (!fileId) {
		throw new Error("file_id is required")
	}

	const pendingRequest = fileInfoByIdRequestCache.get(fileId)
	if (pendingRequest) {
		return pendingRequest
	}

	const requestPromise = (async () => {
		try {
			const processOptions =
				options?.useImageProcess === true && shouldUseImageProcess(fileSize)
					? IMAGE_PROCESS_OPTIONS
					: undefined

			const downloadUrls = await getTemporaryDownloadUrl({
				file_ids: [fileId],
				options: processOptions,
			})

			if (!downloadUrls?.length || !downloadUrls[0]?.url) {
				throw new Error(`No URL in response for file_id: ${fileId}`)
			}

			const meta = findFileItemByFileId(fileId, options?.filesList)
			const result: GetFileInfoResponse = mergeFileItemMetaIntoFileInfo(
				{
					src: downloadUrls[0].url,
					fileName:
						fileName ||
						meta?.file_name ||
						meta?.display_filename ||
						meta?.filename ||
						"",
					...(downloadUrls[0].expires_at
						? { expires_at: downloadUrls[0].expires_at }
						: {}),
				},
				meta,
			)

			// 这里只给宿主内部链路使用，返回值保留 file_id，CanvasDesign 本身不消费它。
			return {
				...result,
				file_id: fileId,
			}
		} finally {
			fileInfoByIdRequestCache.delete(fileId)
		}
	})()

	fileInfoByIdRequestCache.set(fileId, requestPromise)
	return requestPromise
}

export function clearAllFileInfoCache(): void {
	ensureStorageCacheLoaded()

	fileInfoCache.clear()
	fileInfoRequestCache.clear()
	fileInfoByIdRequestCache.clear()
	namespaceAttachmentsSnapshotCache.clear()
	batchQueue.length = 0
	if (batchTimer) {
		clearTimeout(batchTimer)
		batchTimer = null
	}
	clearPersistedCache()
}

export function setCacheEnabled(enabled: boolean): void {
	cacheEnabled = enabled
}

export function isCacheEnabled(): boolean {
	return cacheEnabled
}

export function cleanupFileInfoCache(filesList?: FileItem[], designProjectId?: string): void {
	ensureStorageCacheLoaded()

	const namespace = buildNamespaceKey(designProjectId)
	const attachmentsSnapshotKey = buildAttachmentsSnapshotKey(filesList)
	syncNamespaceAttachmentsSnapshot(namespace, attachmentsSnapshotKey)

	const currentFilePaths = new Set<string>()
	const currentFileIds = new Set<string>()

	getStoreFiles(filesList).forEach((item) => {
		if (!item.is_directory && item.relative_file_path) {
			const normalizedPath = normalizePath(item.relative_file_path)
			if (normalizedPath) {
				currentFilePaths.add(normalizedPath)
			}
			if (item.file_id) {
				currentFileIds.add(item.file_id)
			}
		}
	})

	const keysToDelete: string[] = []

	fileInfoCache.forEach((entry, cacheKey) => {
		const parsedKey = parseScopedPathKey(cacheKey)
		if (parsedKey.namespace !== namespace) return

		if (entry.attachmentsSnapshotKey !== attachmentsSnapshotKey) {
			keysToDelete.push(cacheKey)
			return
		}

		// 附件列表里已经不存在这个相对路径，说明缓存已经脱离当前设计目录状态。
		if (!currentFilePaths.has(parsedKey.normalizedPath)) {
			keysToDelete.push(cacheKey)
			return
		}

		// 路径仍在，但对应 file_id 不在当前附件列表中，视为同路径资源已被替换。
		if (entry.resolvedFileId && !currentFileIds.has(entry.resolvedFileId)) {
			keysToDelete.push(cacheKey)
		}
	})

	keysToDelete.forEach((cacheKey) => {
		deleteMemoryCache(cacheKey)
	})

	if (keysToDelete.length > 0) {
		persistCacheToStorage()
	}
}
