import {
	getTemporaryDownloadUrl,
	type GetTemporaryDownloadUrlItem,
} from "@/pages/superMagic/utils/api"
import {
	getFileAccessIdentityKey,
	type FileAccessContext,
} from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import type { ImageProcessOptions } from "@/utils/image-processing"
import { getFileUrlDownloadModeForNoWatermark } from "@/utils/aiWatermarkPreviewFileUrlMode"
import { parseExpiresAt } from "@/components/CanvasDesign/runtime/resources/offline-cache/ossExpiryUtils"
import { SHARED_MEDIA_THUMBNAIL_IMAGE_PROCESS } from "./sharedMediaImageProcess"
import { getSharedMediaResourceScope } from "./sharedMediaResourceScope"
import {
	clearPersistedSharedMediaThumbnailUrls,
	readPersistedSharedMediaThumbnailUrl,
	removePersistedSharedMediaThumbnailUrl,
	removePersistedSharedMediaThumbnailUrlsByFileId,
	removePersistedSharedMediaThumbnailUrlsByScope,
	writePersistedSharedMediaThumbnailUrl,
	type SharedMediaThumbnailSessionIdentity,
} from "./sharedMediaUrlSessionStore"

/** Refresh a temporary URL before the remote object can expire in the consumer. */
export const SHARED_MEDIA_URL_EXPIRY_SAFETY_WINDOW_MS = 30_000
/** Conservative fallback when the URL API omits an explicit expiry. */
export const SHARED_MEDIA_URL_FALLBACK_TTL_MS = 15 * 60 * 1000
const SHARED_MEDIA_URL_CACHE_MAX_ENTRIES = 2048

export type SharedMediaUrlSource = "temporary-download-url" | "attachment-list"

export interface SharedMediaUrlRequest {
	fileId: string
	/** Permission/cache namespace. Defaults to the active user and organization. */
	scope?: string
	fileVersion?: number
	updatedAt?: string
	resourceVersion?: string
	downloadMode?: DownloadImageMode
	isDownload?: boolean
	cache?: boolean
	/** Bypass the local URL entry while retaining the same resource identity key. */
	forceRefresh?: boolean
	imageProcess?: ImageProcessOptions
	/** Allow a usable attachment-list URL to satisfy an image preview request. */
	allowAttachmentListUrl?: boolean
	access?: FileAccessContext
	/** Stable identity supplied by a bound FileApi for cache-only callers. */
	identityKey?: string
}

export type SharedMediaUrlBatchOptions = Omit<
	SharedMediaUrlRequest,
	"fileId" | "fileVersion" | "updatedAt"
> & {
	fileVersions?: ReadonlyMap<string, number> | Record<string, number | undefined>
	fileUpdatedAtMap?: ReadonlyMap<string, string> | Record<string, string | undefined>
	fileResourceVersionMap?: ReadonlyMap<string, string> | Record<string, string | undefined>
}

interface SharedMediaUrlCacheEntry {
	fileId: string
	scope: string
	source: SharedMediaUrlSource
	item: GetTemporaryDownloadUrlItem
	fileVersion?: number
	updatedAt?: string
	resourceVersion?: string
	downloadMode?: DownloadImageMode
	isDownload: boolean
	cache?: boolean
	imageProcess?: ImageProcessOptions
	cachedAt: number
	lastAccessAt: number
}

const sharedMediaUrlCache = new Map<string, SharedMediaUrlCacheEntry>()
const attachmentListIndex = new Map<string, Set<string>>()
interface PendingSharedMediaUrlRequest {
	fileId: string
	promise: Promise<GetTemporaryDownloadUrlItem | null>
	token: symbol
}

const sharedMediaUrlRequests = new Map<string, PendingSharedMediaUrlRequest>()
let sharedMediaUrlCacheEpoch = 0
let currentDefaultScope: string | undefined

function stableSerialize(value: unknown): string {
	if (value === null) return "null"
	if (value === undefined) return "undefined"
	if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, item]) => item !== undefined)
			.sort(([left], [right]) => left.localeCompare(right))
		return `{${entries
			.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
			.join(",")}}`
	}
	// Request options are JSON-shaped, but keep the key total for defensive callers.
	return JSON.stringify(value) ?? "null"
}

const THUMBNAIL_IMAGE_PROCESS_KEY = stableSerialize(SHARED_MEDIA_THUMBNAIL_IMAGE_PROCESS)

function normalizeFileId(fileId: string): string {
	return fileId.trim()
}

function buildAttachmentIndexKey(scope: string, fileId: string): string {
	return `${scope}\0${fileId}`
}

function addAttachmentListIndex(scope: string, fileId: string, requestKey: string): void {
	const indexKey = buildAttachmentIndexKey(scope, fileId)
	const keys = attachmentListIndex.get(indexKey) ?? new Set<string>()
	keys.add(requestKey)
	attachmentListIndex.set(indexKey, keys)
}

function removeAttachmentListIndex(scope: string, fileId: string, requestKey: string): void {
	const indexKey = buildAttachmentIndexKey(scope, fileId)
	const keys = attachmentListIndex.get(indexKey)
	if (!keys) return
	keys.delete(requestKey)
	if (keys.size === 0) attachmentListIndex.delete(indexKey)
}

function removeAttachmentListIndexForScope(scope: string): void {
	for (const indexKey of attachmentListIndex.keys()) {
		if (indexKey.startsWith(`${scope}\0`)) attachmentListIndex.delete(indexKey)
	}
}

function removeCacheEntry(key: string, entry?: SharedMediaUrlCacheEntry): void {
	const resolvedEntry = entry ?? sharedMediaUrlCache.get(key)
	if (resolvedEntry?.source === "attachment-list") {
		removeAttachmentListIndex(resolvedEntry.scope, resolvedEntry.fileId, key)
	}
	if (resolvedEntry) removePersistedThumbnailForEntry(resolvedEntry)
	sharedMediaUrlCache.delete(key)
}

function syncSharedMediaUrlScope(): void {
	const nextScope = getSharedMediaResourceScope()
	if (currentDefaultScope && currentDefaultScope !== nextScope) {
		// A signed URL from the previous account/org must not remain reachable in
		// the shared working set after an auth-context switch. Bump the epoch so
		// old in-flight requests may finish for their original callers but cannot
		// repopulate the cache under the new scope.
		sharedMediaUrlCacheEpoch += 1
		sharedMediaUrlCache.forEach((entry, key) => {
			if (entry.scope === currentDefaultScope) removeCacheEntry(key, entry)
		})
		removePersistedSharedMediaThumbnailUrlsByScope(currentDefaultScope)
		removeAttachmentListIndexForScope(currentDefaultScope)
		sharedMediaUrlRequests.clear()
	}
	currentDefaultScope = nextScope
}

function normalizeScope(scope?: string): string {
	const trimmedScope = scope?.trim()
	if (trimmedScope) return trimmedScope
	syncSharedMediaUrlScope()
	return currentDefaultScope ?? getSharedMediaResourceScope()
}

/**
 * `getTemporaryDownloadUrl` injects the current no-watermark mode when the
 * caller leaves `downloadMode` unset. Include that derived mode in the cache
 * identity as well, otherwise a preference change could reuse a signed URL
 * issued under the previous preview policy.
 */
function resolveEffectiveDownloadMode(
	downloadMode?: DownloadImageMode,
): DownloadImageMode | undefined {
	if (downloadMode !== undefined) return downloadMode
	if (typeof window !== "undefined" && window.location.pathname.includes("magic-share")) {
		return undefined
	}
	return getFileUrlDownloadModeForNoWatermark()
}

function buildRequestKey(
	request: SharedMediaUrlRequest,
	source: SharedMediaUrlSource = "temporary-download-url",
): string {
	return stableSerialize({
		source,
		scope: normalizeScope(request.scope),
		fileId: normalizeFileId(request.fileId),
		fileVersion: request.fileVersion ?? null,
		updatedAt: request.updatedAt ?? null,
		resourceVersion: request.resourceVersion ?? null,
		downloadMode: resolveEffectiveDownloadMode(request.downloadMode) ?? null,
		isDownload: request.isDownload ?? false,
		cache: request.cache ?? null,
		imageProcess: request.imageProcess ?? null,
		identityKey: request.identityKey ?? getFileAccessIdentityKey(request.access),
	})
}

function getBatchMapValue<T>(
	values: ReadonlyMap<string, T> | Record<string, T | undefined> | undefined,
	fileId: string,
): T | undefined {
	if (!values) return undefined
	if (values instanceof Map) return values.get(fileId)
	return (values as Record<string, T | undefined>)[fileId]
}

function buildBatchRequest(
	fileId: string,
	options: SharedMediaUrlBatchOptions,
): SharedMediaUrlRequest {
	return {
		fileId,
		scope: options.scope,
		fileVersion: getBatchMapValue(options.fileVersions, fileId),
		updatedAt: getBatchMapValue(options.fileUpdatedAtMap, fileId),
		resourceVersion: getBatchMapValue(options.fileResourceVersionMap, fileId),
		downloadMode: options.downloadMode,
		isDownload: options.isDownload,
		cache: options.cache,
		forceRefresh: options.forceRefresh,
		imageProcess: options.imageProcess,
		allowAttachmentListUrl: options.allowAttachmentListUrl,
		access: options.access,
		identityKey: options.identityKey,
	}
}

function isCacheEntryValid(
	entry: SharedMediaUrlCacheEntry | undefined,
	currentUpdatedAt?: string,
	currentResourceVersion?: string,
): boolean {
	if (!entry?.item.url) return false

	const expiresAt = parseExpiresAt(entry.item.expires_at)
	if (expiresAt !== null) {
		if (expiresAt - Date.now() <= SHARED_MEDIA_URL_EXPIRY_SAFETY_WINDOW_MS) return false
	} else if (Date.now() - entry.cachedAt >= SHARED_MEDIA_URL_FALLBACK_TTL_MS) {
		return false
	}

	if (currentUpdatedAt !== undefined && entry.updatedAt !== currentUpdatedAt) return false
	if (currentResourceVersion !== undefined && entry.resourceVersion !== currentResourceVersion) {
		return false
	}
	return true
}

function isThumbnailExchangeRequest(
	request: SharedMediaUrlRequest,
	source: SharedMediaUrlSource,
): boolean {
	if (source !== "temporary-download-url" || request.isDownload) return false
	return stableSerialize(request.imageProcess ?? null) === THUMBNAIL_IMAGE_PROCESS_KEY
}

function buildThumbnailSessionIdentity(
	request: Pick<
		SharedMediaUrlRequest,
		"fileId" | "scope" | "fileVersion" | "updatedAt" | "resourceVersion" | "downloadMode"
	>,
	scope = normalizeScope(request.scope),
): SharedMediaThumbnailSessionIdentity {
	return {
		scope,
		fileId: normalizeFileId(request.fileId),
		fileVersion: request.fileVersion,
		updatedAt: request.updatedAt,
		resourceVersion: request.resourceVersion,
		downloadMode: resolveEffectiveDownloadMode(request.downloadMode) ?? null,
	}
}

function removePersistedThumbnailForRequest(request: SharedMediaUrlRequest): void {
	if (!isThumbnailExchangeRequest(request, "temporary-download-url")) return
	removePersistedSharedMediaThumbnailUrl(buildThumbnailSessionIdentity(request))
}

function removePersistedThumbnailForEntry(entry: SharedMediaUrlCacheEntry): void {
	if (
		!isThumbnailExchangeRequest(
			{
				fileId: entry.fileId,
				isDownload: entry.isDownload,
				imageProcess: entry.imageProcess,
			},
			entry.source,
		)
	) {
		return
	}
	removePersistedSharedMediaThumbnailUrl({
		scope: entry.scope,
		fileId: entry.fileId,
		fileVersion: entry.fileVersion,
		updatedAt: entry.updatedAt,
		resourceVersion: entry.resourceVersion,
		downloadMode: entry.downloadMode ?? null,
	})
}

function persistThumbnailExchangeEntry(entry: SharedMediaUrlCacheEntry): void {
	if (
		!isThumbnailExchangeRequest(
			{
				fileId: entry.fileId,
				isDownload: entry.isDownload,
				imageProcess: entry.imageProcess,
			},
			entry.source,
		)
	) {
		return
	}
	writePersistedSharedMediaThumbnailUrl({
		identity: {
			scope: entry.scope,
			fileId: entry.fileId,
			fileVersion: entry.fileVersion,
			updatedAt: entry.updatedAt,
			resourceVersion: entry.resourceVersion,
			downloadMode: entry.downloadMode ?? null,
		},
		url: entry.item.url,
		expiresAt: entry.item.expires_at,
		cachedAt: entry.cachedAt,
	})
}

function hydrateThumbnailExchangeEntry(
	request: SharedMediaUrlRequest,
	requestKey: string,
): SharedMediaUrlCacheEntry | undefined {
	if (!isThumbnailExchangeRequest(request, "temporary-download-url")) return undefined

	const scope = normalizeScope(request.scope)
	const identity = buildThumbnailSessionIdentity(request, scope)
	const record = readPersistedSharedMediaThumbnailUrl(identity)
	if (!record) return undefined

	const accessedAt = Date.now()
	const entry: SharedMediaUrlCacheEntry = {
		fileId: identity.fileId,
		scope,
		source: "temporary-download-url",
		item: {
			file_id: identity.fileId,
			url: record.url,
			expires_at: record.expiresAt,
		},
		fileVersion: request.fileVersion,
		updatedAt: request.updatedAt,
		resourceVersion: request.resourceVersion,
		downloadMode: resolveEffectiveDownloadMode(request.downloadMode),
		isDownload: request.isDownload ?? false,
		cache: request.forceRefresh ? false : request.cache,
		imageProcess: request.imageProcess,
		cachedAt: record.cachedAt,
		lastAccessAt: accessedAt,
	}
	if (!isCacheEntryValid(entry, request.updatedAt, request.resourceVersion)) {
		removePersistedSharedMediaThumbnailUrl(identity)
		return undefined
	}

	sharedMediaUrlCache.set(requestKey, entry)
	pruneSharedMediaUrlCache()
	return sharedMediaUrlCache.get(requestKey) ?? entry
}

function findResponseItem(
	fileId: string,
	items: GetTemporaryDownloadUrlItem[] | undefined,
): GetTemporaryDownloadUrlItem | null {
	if (!items?.length) return null
	return items.find((item) => String(item.file_id) === fileId) ?? null
}

function matchesAttachmentListFallback(
	entry: SharedMediaUrlCacheEntry,
	request: SharedMediaUrlRequest,
): boolean {
	if (entry.source !== "attachment-list") return false
	if (entry.fileId !== normalizeFileId(request.fileId)) return false
	if (entry.scope !== normalizeScope(request.scope)) return false
	if (request.fileVersion !== undefined && entry.fileVersion !== request.fileVersion) {
		return false
	}
	if (request.updatedAt !== undefined && entry.updatedAt !== request.updatedAt) return false
	if (
		request.resourceVersion !== undefined &&
		entry.resourceVersion !== request.resourceVersion
	) {
		return false
	}
	if (
		resolveEffectiveDownloadMode(request.downloadMode) !== entry.downloadMode ||
		Boolean(request.isDownload) !== entry.isDownload
	) {
		return false
	}
	if (request.cache !== undefined && request.cache !== entry.cache) return false
	return isCacheEntryValid(entry, request.updatedAt, request.resourceVersion)
}

function findAttachmentListFallbackEntry(
	request: SharedMediaUrlRequest,
): SharedMediaUrlCacheEntry | undefined {
	const attachmentKeys = attachmentListIndex.get(
		buildAttachmentIndexKey(normalizeScope(request.scope), normalizeFileId(request.fileId)),
	)
	if (!attachmentKeys?.size) return undefined

	let bestEntry: SharedMediaUrlCacheEntry | undefined
	for (const requestKey of attachmentKeys) {
		const entry = sharedMediaUrlCache.get(requestKey)
		if (!entry || !matchesAttachmentListFallback(entry, request)) continue
		if (!bestEntry || entry.cachedAt > bestEntry.cachedAt) bestEntry = entry
	}
	return bestEntry
}

function getCachedItem(request: SharedMediaUrlRequest): GetTemporaryDownloadUrlItem | null {
	syncSharedMediaUrlScope()

	const requestKey = buildRequestKey(request)
	const cachedEntry = sharedMediaUrlCache.get(requestKey)
	if (isCacheEntryValid(cachedEntry, request.updatedAt, request.resourceVersion)) {
		if (cachedEntry) cachedEntry.lastAccessAt = Date.now()
		return cachedEntry?.item ?? null
	}
	if (cachedEntry) {
		removeCacheEntry(requestKey, cachedEntry)
		removePersistedThumbnailForEntry(cachedEntry)
	}

	const hydratedEntry = hydrateThumbnailExchangeEntry(request, requestKey)
	if (hydratedEntry) return hydratedEntry.item

	if (request.allowAttachmentListUrl && !request.isDownload) {
		const attachmentEntry = findAttachmentListFallbackEntry(request)
		if (attachmentEntry) {
			attachmentEntry.lastAccessAt = Date.now()
			return attachmentEntry.item
		}
	}

	return null
}

function cacheResolvedItem(
	request: SharedMediaUrlRequest,
	item: GetTemporaryDownloadUrlItem | null,
	epoch = sharedMediaUrlCacheEpoch,
	requestKey?: string,
	requestToken?: symbol,
	source: SharedMediaUrlSource = "temporary-download-url",
): GetTemporaryDownloadUrlItem | null {
	if (!item?.url) return item
	if (epoch !== sharedMediaUrlCacheEpoch) return item
	if (
		requestKey &&
		requestToken &&
		sharedMediaUrlRequests.get(requestKey)?.token !== requestToken
	) {
		return item
	}

	const resolvedRequestKey = buildRequestKey(request, source)
	const cachedAt = Date.now()
	const entry: SharedMediaUrlCacheEntry = {
		fileId: normalizeFileId(request.fileId),
		scope: normalizeScope(request.scope),
		source,
		item,
		fileVersion: request.fileVersion,
		updatedAt: request.updatedAt ?? item.updated_at,
		resourceVersion: request.resourceVersion,
		downloadMode: resolveEffectiveDownloadMode(request.downloadMode),
		isDownload: request.isDownload ?? false,
		cache: request.forceRefresh ? false : request.cache,
		imageProcess: request.imageProcess,
		cachedAt,
		lastAccessAt: cachedAt,
	}
	sharedMediaUrlCache.set(resolvedRequestKey, entry)
	if (source === "attachment-list") {
		addAttachmentListIndex(entry.scope, entry.fileId, resolvedRequestKey)
	}
	if (isThumbnailExchangeRequest(request, source)) {
		persistThumbnailExchangeEntry(entry)
	}
	pruneSharedMediaUrlCache()
	return item
}

function pruneSharedMediaUrlCache(): void {
	for (const [key, entry] of sharedMediaUrlCache) {
		if (!isCacheEntryValid(entry, undefined, undefined)) {
			removeCacheEntry(key, entry)
		}
	}
	if (sharedMediaUrlCache.size <= SHARED_MEDIA_URL_CACHE_MAX_ENTRIES) return

	const oldestEntries = Array.from(sharedMediaUrlCache.entries()).sort(
		([, left], [, right]) => left.lastAccessAt - right.lastAccessAt,
	)
	while (sharedMediaUrlCache.size > SHARED_MEDIA_URL_CACHE_MAX_ENTRIES) {
		const oldest = oldestEntries.shift()
		if (!oldest) break
		removeCacheEntry(oldest[0], oldest[1])
	}
}

function createSingleRequest(
	request: SharedMediaUrlRequest,
	requestKey: string,
): Promise<GetTemporaryDownloadUrlItem | null> {
	const fileId = normalizeFileId(request.fileId)
	const token = Symbol(`shared-media-url:${fileId}`)
	const requestEpoch = sharedMediaUrlCacheEpoch
	const pendingRequest = getTemporaryDownloadUrl({
		file_ids: [fileId],
		file_versions:
			request.fileVersion === undefined ? undefined : { [fileId]: request.fileVersion },
		download_mode: resolveEffectiveDownloadMode(request.downloadMode),
		is_download: request.isDownload,
		cache: request.forceRefresh ? false : request.cache,
		options: request.imageProcess ? { xMagicImageProcess: request.imageProcess } : undefined,
		enableErrorMessagePrompt: false,
		access: request.access,
	})
		.then((items) =>
			cacheResolvedItem(
				request,
				findResponseItem(fileId, items),
				requestEpoch,
				requestKey,
				token,
				"temporary-download-url",
			),
		)
		.catch((error: unknown) => {
			console.warn("[SuperMagic] Failed to resolve shared media URL", {
				fileId,
				error,
			})
			throw error
		})
		.finally(() => {
			if (sharedMediaUrlRequests.get(requestKey)?.token === token) {
				sharedMediaUrlRequests.delete(requestKey)
			}
		})

	sharedMediaUrlRequests.set(requestKey, { fileId, promise: pendingRequest, token })
	return pendingRequest
}

export function resolveSharedMediaUrl(
	request: SharedMediaUrlRequest,
): Promise<GetTemporaryDownloadUrlItem | null> {
	syncSharedMediaUrlScope()

	const fileId = normalizeFileId(request.fileId)
	if (!fileId) return Promise.resolve(null)

	const normalizedRequest = { ...request, fileId }
	const requestKey = buildRequestKey(normalizedRequest)
	if (!normalizedRequest.forceRefresh) {
		const cachedItem = getCachedItem(normalizedRequest)
		if (cachedItem) return Promise.resolve(cachedItem)

		const existingRequest = sharedMediaUrlRequests.get(requestKey)
		if (existingRequest) return existingRequest.promise
	} else {
		const cachedEntry = sharedMediaUrlCache.get(requestKey)
		removeCacheEntry(requestKey, cachedEntry)
		removePersistedThumbnailForRequest(normalizedRequest)
	}

	return createSingleRequest(normalizedRequest, requestKey)
}

export function getCachedSharedMediaUrl(
	request: SharedMediaUrlRequest,
	source: SharedMediaUrlSource = "temporary-download-url",
): GetTemporaryDownloadUrlItem | null {
	syncSharedMediaUrlScope()

	const normalizedRequest = { ...request, fileId: normalizeFileId(request.fileId) }
	if (!normalizedRequest.fileId) return null

	const requestKey = buildRequestKey(normalizedRequest, source)
	const cachedEntry = sharedMediaUrlCache.get(requestKey)
	if (
		!isCacheEntryValid(
			cachedEntry,
			normalizedRequest.updatedAt,
			normalizedRequest.resourceVersion,
		)
	) {
		if (cachedEntry) {
			removeCacheEntry(requestKey, cachedEntry)
			removePersistedThumbnailForEntry(cachedEntry)
		}
		if (source !== "temporary-download-url") return null
		return hydrateThumbnailExchangeEntry(normalizedRequest, requestKey)?.item ?? null
	}
	if (cachedEntry) cachedEntry.lastAccessAt = Date.now()
	return cachedEntry?.item ?? null
}

export function getCachedSharedMediaUrls(params: {
	fileIds: string[]
	options?: SharedMediaUrlBatchOptions
}): {
	cached: GetTemporaryDownloadUrlItem[]
	missing: string[]
} {
	syncSharedMediaUrlScope()

	const cached: GetTemporaryDownloadUrlItem[] = []
	const missing: string[] = []
	const options = params.options ?? {}

	for (const rawFileId of params.fileIds) {
		const fileId = normalizeFileId(rawFileId)
		if (!fileId) continue

		const item = getCachedItem(buildBatchRequest(fileId, options))
		if (item) cached.push(item)
		else missing.push(fileId)
	}

	return { cached, missing }
}

export function seedSharedMediaUrls(params: {
	items: GetTemporaryDownloadUrlItem[]
	options?: SharedMediaUrlBatchOptions
	source?: SharedMediaUrlSource
}): void {
	syncSharedMediaUrlScope()

	const options = params.options ?? {}
	const source = params.source ?? "temporary-download-url"
	for (const item of params.items) {
		const fileId = normalizeFileId(String(item.file_id || ""))
		if (!fileId) continue
		const request = buildBatchRequest(fileId, options)
		cacheResolvedItem(
			source === "attachment-list" ? { ...request, imageProcess: undefined } : request,
			item,
			sharedMediaUrlCacheEpoch,
			undefined,
			undefined,
			source,
		)
	}
}

export function requestSharedMediaUrls(
	fileIds: string[],
	options: SharedMediaUrlBatchOptions = {},
): Promise<GetTemporaryDownloadUrlItem[]> {
	syncSharedMediaUrlScope()

	const requests = Array.from(
		new Map(
			fileIds
				.map((rawFileId) => normalizeFileId(rawFileId))
				.filter(Boolean)
				.map((fileId) => [fileId, buildBatchRequest(fileId, options)] as const),
		).values(),
	)
	if (requests.length === 0) return Promise.resolve([])

	const itemPromises = new Map<string, Promise<GetTemporaryDownloadUrlItem | null>>()
	const missing: Array<{ request: SharedMediaUrlRequest; requestKey: string }> = []

	for (const request of requests) {
		const requestKey = buildRequestKey(request)
		if (!request.forceRefresh) {
			const cachedItem = getCachedItem(request)
			if (cachedItem) {
				itemPromises.set(requestKey, Promise.resolve(cachedItem))
				continue
			}

			const existingRequest = sharedMediaUrlRequests.get(requestKey)
			if (existingRequest) itemPromises.set(requestKey, existingRequest.promise)
			else missing.push({ request, requestKey })
		} else {
			const cachedEntry = sharedMediaUrlCache.get(requestKey)
			removeCacheEntry(requestKey, cachedEntry)
			removePersistedThumbnailForRequest(request)
			missing.push({ request, requestKey })
		}
	}

	if (missing.length > 0) {
		const requestEpoch = sharedMediaUrlCacheEpoch
		const fileVersions: Record<string, number> = {}
		missing.forEach(({ request }) => {
			if (request.fileVersion !== undefined) {
				fileVersions[request.fileId] = request.fileVersion
			}
		})
		const batchRequest = getTemporaryDownloadUrl({
			file_ids: missing.map(({ request }) => request.fileId),
			file_versions: Object.keys(fileVersions).length > 0 ? fileVersions : undefined,
			download_mode: resolveEffectiveDownloadMode(options.downloadMode),
			is_download: options.isDownload,
			cache: options.forceRefresh ? false : options.cache,
			options: options.imageProcess
				? { xMagicImageProcess: options.imageProcess }
				: undefined,
			enableErrorMessagePrompt: false,
			access: options.access,
		})

		for (const { request, requestKey } of missing) {
			const token = Symbol(`shared-media-url:${request.fileId}`)
			const itemPromise = batchRequest
				.then((items) =>
					cacheResolvedItem(
						request,
						findResponseItem(request.fileId, items),
						requestEpoch,
						requestKey,
						token,
						"temporary-download-url",
					),
				)
				.finally(() => {
					if (sharedMediaUrlRequests.get(requestKey)?.token === token) {
						sharedMediaUrlRequests.delete(requestKey)
					}
				})
			sharedMediaUrlRequests.set(requestKey, {
				fileId: request.fileId,
				promise: itemPromise,
				token,
			})
			itemPromises.set(requestKey, itemPromise)
		}
	}

	return Promise.all(
		requests.map(
			(request) => itemPromises.get(buildRequestKey(request)) ?? Promise.resolve(null),
		),
	).then((items) =>
		items.filter((item): item is GetTemporaryDownloadUrlItem => Boolean(item?.url)),
	)
}

export function invalidateSharedMediaUrlEntry(
	request: SharedMediaUrlRequest,
	source: SharedMediaUrlSource = "temporary-download-url",
): void {
	const normalizedFileId = normalizeFileId(request.fileId)
	if (!normalizedFileId) return
	const requestKey = buildRequestKey({ ...request, fileId: normalizedFileId }, source)
	const cachedEntry = sharedMediaUrlCache.get(requestKey)
	removeCacheEntry(requestKey, cachedEntry)
	if (source === "temporary-download-url") {
		removePersistedThumbnailForRequest({ ...request, fileId: normalizedFileId })
	}
}

export function invalidateSharedMediaUrl(fileId: string): void {
	const normalizedFileId = normalizeFileId(fileId)
	if (!normalizedFileId) return

	for (const [key, entry] of sharedMediaUrlCache) {
		if (entry.fileId === normalizedFileId) removeCacheEntry(key, entry)
	}
	for (const [key, request] of sharedMediaUrlRequests) {
		if (request.fileId === normalizedFileId) sharedMediaUrlRequests.delete(key)
	}
	removePersistedSharedMediaThumbnailUrlsByFileId(normalizedFileId)
}

/** Test and lifecycle escape hatch; it does not cancel already-running requests. */
export function clearSharedMediaUrlCache(): void {
	sharedMediaUrlCacheEpoch += 1
	sharedMediaUrlCache.clear()
	attachmentListIndex.clear()
	sharedMediaUrlRequests.clear()
	currentDefaultScope = undefined
	clearPersistedSharedMediaThumbnailUrls()
}

export const sharedMediaUrlCacheTestUtils = {
	buildRequestKey,
	isCacheEntryValid,
	getCacheSize: () => sharedMediaUrlCache.size,
}
