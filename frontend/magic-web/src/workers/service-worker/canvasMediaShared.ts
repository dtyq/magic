/**
 * Canvas 媒体缓存共享逻辑。
 *
 * 这个模块只保留原始 Canvas SW 的缓存核心能力：
 * - 虚拟 URL 解析
 * - IndexedDB 元数据维护
 * - CacheStorage 二进制缓存
 * - 按 sourceUrl 回源
 *
 * 它不负责 install / activate / fetch / message 事件注册，
 * 这些生命周期与入口行为统一由主 SW `src/sw.ts` 驱动。
 */

/**
 * 路径规范化会参与 IndexedDB id 与 CacheStorage key；语义变化时必须递增此版本。
 * 主线程离线缓存管理器直接复用这些常量，避免它与 SW 升级不一致。
 */
export const CANVAS_MEDIA_OFFLINE_CACHE_VERSION = 5
const DB_BASE_NAME = "canvas-media-resource-offline-cache"
export const CANVAS_MEDIA_DB_NAME = `${DB_BASE_NAME}-v${CANVAS_MEDIA_OFFLINE_CACHE_VERSION}`
export const CANVAS_MEDIA_CACHE_NAME = `canvas-media-resources-v${CANVAS_MEDIA_OFFLINE_CACHE_VERSION}`
// Every older version is obsolete once the current SW activates. Generate this
// list from the current version so future bumps cannot accidentally leave a
// stale Canvas media namespace behind.
const LEGACY_CANVAS_MEDIA_CACHE_VERSIONS = Array.from(
	{ length: Math.max(0, CANVAS_MEDIA_OFFLINE_CACHE_VERSION - 1) },
	(_, index) => index + 1,
)
const STORE_NAME = "resources"
const DEFAULT_MAX_BYTES = 1024 * 1024 * 1024
export const CANVAS_MEDIA_MAX_ENTRIES = 16_384
export const CANVAS_MEDIA_MAX_METADATA_BYTES = 32 * 1024 * 1024
const PENDING_BODY_MAX_AGE_MS = 60 * 60 * 1000
const BODY_WRITE_TOKEN_HEADER = "X-Magic-Canvas-Body-Write-Token"
/** Idle eviction for current-version Canvas media bodies (SW + host CONFIG). */
export const CANVAS_MEDIA_MAX_IDLE_AGE_MS = 30 * 24 * 60 * 60 * 1000
const DEFAULT_RESOURCE_NAMESPACE = "__global__"
const VIRTUAL_RESOURCE_PATH_SEGMENT = "/canvas-design-media/"
const VIRTUAL_RESOURCE_ROUTE_MARKER = `/sw${VIRTUAL_RESOURCE_PATH_SEGMENT}`
const VIRTUAL_RESOURCE_DESIGN_RESOURCE_SEGMENT = "/design-resource/"
export type CanvasMediaType = "image" | "video" | "audio"

const VIRTUAL_RESOURCE_MEDIA_TYPES = new Set<CanvasMediaType>(["image", "video", "audio"])
const TOUCH_WRITEBACK_INTERVAL_MS = 24 * 60 * 60 * 1000
const TOUCH_FLUSH_IDLE_DELAY_MS = 1000

type CanvasMediaTouch = { id: string; lastAccessedAt: number }
const pendingTouches = new Map<string, CanvasMediaTouch>()
let touchFlushTimer: ReturnType<typeof setTimeout> | null = null
const lastTouchWriteAt = new Map<string, number>()

type FetchResourceBlobResult =
	| { response: Response }
	| {
			blob: Blob
			headers: Headers
			metadata: ReturnType<typeof getResponseMetadata>
			status: number
			statusText: string
	  }

type CanvasMediaEntry = {
	id?: string
	namespace?: string
	path?: string
	mediaType?: CanvasMediaType
	url?: string
	cacheKey?: string
	sourceUrl?: string
	originalUrl?: string
	expiresAt?: number | null
	size?: number
	etag?: string | null
	lastModified?: string | null
	contentLength?: number | null
	contentType?: string | null
	resourceVersion?: string | null
	sourceUpdatedAt?: string | null
	lastAccessedAt?: number
	updatedAt?: number
	pendingBodyToken?: string | null
	pendingBodySize?: number | null
	pendingBodyStartedAt?: number | null
}

let maxBytes = DEFAULT_MAX_BYTES
let maxEntries = CANVAS_MEDIA_MAX_ENTRIES
let maxMetadataBytes = CANVAS_MEDIA_MAX_METADATA_BYTES
let maxIdleAgeMs = CANVAS_MEDIA_MAX_IDLE_AGE_MS
interface InflightResourceRequest {
	identity: string
	promise: Promise<FetchResourceBlobResult>
}

const inflightResourceMap = new Map<string, InflightResourceRequest>()
const activeBodyWriteCounts = new Map<string, number>()

/** 将 Service Worker URL 中的 percent-encoded 路径还原为业务资源路径。 */
export function normalizeResourcePathForLookup(path: string | null | undefined): string {
	if (path == null || path === "") return ""
	let normalizedPath = normalizeResourcePathForStorage(path)
	try {
		normalizedPath = decodeURIComponent(normalizedPath)
	} catch {
		// 非法转义序列时保留原串
	}
	return normalizedPath
}

/** 规范化已解析的业务资源路径，不执行 URL decode。 */
export function normalizeResourcePathForStorage(path: string | null | undefined): string {
	return String(path || "")
		.replace(/\\/g, "/")
		.replace(/^\/+/g, "")
}

/** 规范化命名空间，保证空值收敛到统一全局命名空间。 */
export function normalizeResourceNamespace(namespace: string | null | undefined): string {
	const normalized = normalizeResourcePathForLookup(namespace)
	return normalized || DEFAULT_RESOURCE_NAMESPACE
}

/** 规范化已解析的业务命名空间，不执行 URL decode。 */
export function normalizeResourceNamespaceForStorage(namespace: string | null | undefined): string {
	const normalized = normalizeResourcePathForStorage(namespace)
	return normalized || DEFAULT_RESOURCE_NAMESPACE
}

function stripPathEdgeSlashes(path: string | null | undefined): string {
	return String(path || "")
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
}

function joinUrlPathSegments(...segments: Array<string | null | undefined>): string {
	return segments
		.map((segment, index) => {
			const normalized = String(segment || "").replace(/\\/g, "/")
			if (index === 0) return normalized.replace(/\/+$/g, "")
			return normalized.replace(/^\/+|\/+$/g, "")
		})
		.filter(Boolean)
		.join("/")
}

/**
 * Encode URL path segments without changing the logical resource path.
 *
 * Resource names are user data and may contain URL delimiters such as `#`,
 * `?`, or `%`. Encoding each segment keeps those characters inside the
 * pathname so the browser and Service Worker see the same resource key.
 */
export function encodeResourcePathForUrl(path: string | null | undefined): string {
	return String(path || "")
		.replace(/\\/g, "/")
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/")
}

/** 使用固定虚拟资源协议构造缓存键。 */
function buildVirtualResourceUrl(
	namespace: string | null | undefined,
	mediaType: CanvasMediaType | null | undefined,
	resourcePath: string | null | undefined,
): string {
	return joinUrlPathSegments(
		self.location.origin,
		"sw",
		"canvas-design-media",
		encodeResourcePathForUrl(
			stripPathEdgeSlashes(normalizeResourceNamespaceForStorage(namespace)),
		),
		mediaType,
		"design-resource",
		encodeResourcePathForUrl(normalizeResourcePathForStorage(resourcePath)),
	)
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve()
		transaction.onerror = () => reject(transaction.error)
		transaction.onabort = () => reject(transaction.error)
	})
}

function deleteDatabaseBestEffort(factory: IDBFactory, name: string): Promise<void> {
	return new Promise((resolve) => {
		try {
			const request = factory.deleteDatabase(name)
			const finish = () => resolve()
			request.onsuccess = finish
			request.onerror = finish
			request.onblocked = finish
		} catch {
			resolve()
		}
	})
}

/**
 * Best-effort cleanup for obsolete Canvas media namespaces.
 * Every version older than the current one is removed; the current version is
 * never included and remains available for active Canvas resources.
 */
export async function cleanupLegacyCanvasMediaStorage(options?: {
	indexedDBFactory?: IDBFactory
	cacheStorage?: CacheStorage
}): Promise<void> {
	const indexedDBFactory =
		options?.indexedDBFactory ?? (typeof indexedDB === "undefined" ? undefined : indexedDB)
	const cacheStorage =
		options?.cacheStorage ?? (typeof caches === "undefined" ? undefined : caches)
	const cleanupTasks: Promise<unknown>[] = []

	for (const version of LEGACY_CANVAS_MEDIA_CACHE_VERSIONS) {
		if (indexedDBFactory) {
			cleanupTasks.push(
				deleteDatabaseBestEffort(indexedDBFactory, `${DB_BASE_NAME}-v${version}`),
			)
		}
		if (cacheStorage) {
			cleanupTasks.push(
				Promise.resolve()
					.then(() => cacheStorage.delete(`canvas-media-resources-v${version}`))
					.catch(() => false),
			)
		}
	}

	await Promise.allSettled(cleanupTasks)
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(CANVAS_MEDIA_DB_NAME, CANVAS_MEDIA_OFFLINE_CACHE_VERSION)
		request.onupgradeneeded = () => {
			const db = request.result
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "id" })
			}
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

function getResourceId(entry: CanvasMediaEntry): string {
	return joinUrlPathSegments(
		normalizeResourceNamespaceForStorage(entry.namespace),
		entry.mediaType,
		normalizeResourcePathForStorage(entry.path),
	)
}

/** 根据条目生成稳定 cache key，保持与历史虚拟 URL 方案一致。 */
export function getCacheKey(entry: CanvasMediaEntry): string {
	return (
		entry.cacheKey ||
		entry.url ||
		buildVirtualResourceUrl(entry.namespace, entry.mediaType, entry.path)
	)
}

function getSourceUrl(entry: CanvasMediaEntry): string | undefined {
	return entry.sourceUrl || entry.originalUrl || entry.url
}

function getResourceFetchIdentity(entry: CanvasMediaEntry): string {
	return [
		getSourceUrl(entry) || "",
		entry.resourceVersion || "",
		entry.sourceUpdatedAt || "",
	].join("\0")
}

function getResponseMetadata(response: Response, blobSize: number) {
	const contentLengthText = response.headers.get("Content-Length")
	const contentLength = Number(contentLengthText)
	return {
		contentLength: Number.isFinite(contentLength) ? contentLength : blobSize,
	}
}

/** 从虚拟媒体 URL 解析资源定位信息。 */
export function parseVirtualResourceRequest(
	url: string,
): { namespace: string; mediaType: CanvasMediaType; resourcePath: string } | null {
	const parsedUrl = new URL(url)
	const segmentIndex = parsedUrl.pathname.indexOf(VIRTUAL_RESOURCE_ROUTE_MARKER)
	if (segmentIndex < 0) return null

	const resourceSegmentIndex = parsedUrl.pathname.indexOf(
		VIRTUAL_RESOURCE_DESIGN_RESOURCE_SEGMENT,
		segmentIndex + VIRTUAL_RESOURCE_ROUTE_MARKER.length,
	)
	if (resourceSegmentIndex < 0) return null

	const rawResourcePath = parsedUrl.pathname
		.slice(resourceSegmentIndex + VIRTUAL_RESOURCE_DESIGN_RESOURCE_SEGMENT.length)
		.replace(/^\/+/, "")
	if (!rawResourcePath) return null

	const rawNamespaceWithMediaType = parsedUrl.pathname.slice(
		segmentIndex + VIRTUAL_RESOURCE_ROUTE_MARKER.length,
		resourceSegmentIndex,
	)
	const rawNamespaceSegments = rawNamespaceWithMediaType.replace(/^\/+|\/+$/g, "").split("/")
	const mediaType = rawNamespaceSegments.pop()
	if (!mediaType || !VIRTUAL_RESOURCE_MEDIA_TYPES.has(mediaType as CanvasMediaType)) return null

	const rawNamespace = rawNamespaceSegments.join("/")
	const namespace = normalizeResourceNamespace(rawNamespace)
	const resourcePath = normalizeResourcePathForLookup(rawResourcePath)
	if (!resourcePath) return null

	return { namespace, mediaType: mediaType as CanvasMediaType, resourcePath }
}

function hasOwnField(entry: CanvasMediaEntry, field: keyof CanvasMediaEntry): boolean {
	return Object.prototype.hasOwnProperty.call(entry, field)
}

function toStoredCanvasMediaEntry(
	entry: CanvasMediaEntry,
	existing?: CanvasMediaEntry,
): CanvasMediaEntry {
	const namespace = normalizeResourceNamespaceForStorage(entry.namespace ?? existing?.namespace)
	const path = entry.path ?? existing?.path
	const mediaType = entry.mediaType ?? existing?.mediaType
	const merged: CanvasMediaEntry = {
		id: entry.id || existing?.id || getResourceId({ namespace, path, mediaType }),
		namespace,
		path,
		mediaType,
		sourceUrl: entry.sourceUrl || existing?.sourceUrl || existing?.originalUrl || existing?.url,
		expiresAt: hasOwnField(entry, "expiresAt") ? entry.expiresAt : existing?.expiresAt,
		size: hasOwnField(entry, "size") ? entry.size : existing?.size,
		contentLength: hasOwnField(entry, "contentLength")
			? entry.contentLength
			: existing?.contentLength,
		resourceVersion: hasOwnField(entry, "resourceVersion")
			? entry.resourceVersion
			: (existing?.resourceVersion ?? null),
		sourceUpdatedAt: hasOwnField(entry, "sourceUpdatedAt")
			? entry.sourceUpdatedAt
			: (existing?.sourceUpdatedAt ?? null),
		lastAccessedAt: entry.lastAccessedAt ?? existing?.lastAccessedAt ?? Date.now(),
		pendingBodyToken: hasOwnField(entry, "pendingBodyToken")
			? entry.pendingBodyToken
			: (existing?.pendingBodyToken ?? null),
		pendingBodySize: hasOwnField(entry, "pendingBodySize")
			? entry.pendingBodySize
			: (existing?.pendingBodySize ?? null),
		pendingBodyStartedAt: hasOwnField(entry, "pendingBodyStartedAt")
			? entry.pendingBodyStartedAt
			: (existing?.pendingBodyStartedAt ?? null),
	}
	return merged
}

async function updateEntryById(
	id: string,
	update: (current: CanvasMediaEntry) => CanvasMediaEntry | null,
): Promise<CanvasMediaEntry | null> {
	const db = await openDb()
	const transaction = db.transaction(STORE_NAME, "readwrite")
	const transactionDone = transactionToPromise(transaction)
	const store = transaction.objectStore(STORE_NAME)
	const current = await requestToPromise<CanvasMediaEntry | undefined>(store.get(id))
	if (!current) {
		await transactionDone
		return null
	}
	const updated = update(current)
	if (!updated) {
		await transactionDone
		return null
	}
	const stored = toStoredCanvasMediaEntry({ ...updated, id }, current)
	await requestToPromise(store.put(stored))
	await transactionDone
	return stored
}

async function getAllEntries(): Promise<CanvasMediaEntry[]> {
	const db = await openDb()
	const transaction = db.transaction(STORE_NAME, "readonly")
	const store = transaction.objectStore(STORE_NAME)
	return requestToPromise(store.getAll())
}

async function getEntryByPath(
	resourcePath: string,
	namespace: string,
	mediaType: CanvasMediaType,
): Promise<CanvasMediaEntry | null> {
	const normalizedPath = normalizeResourcePathForStorage(resourcePath)
	if (!normalizedPath) return null

	const normalizedNamespace = normalizeResourceNamespaceForStorage(namespace)
	const db = await openDb()
	const transaction = db.transaction(STORE_NAME, "readonly")
	const store = transaction.objectStore(STORE_NAME)
	return (
		(await requestToPromise(
			store.get(joinUrlPathSegments(normalizedNamespace, mediaType, normalizedPath)),
		)) || null
	)
}

async function deleteEntry(entry: CanvasMediaEntry): Promise<void> {
	const db = await openDb()
	const transaction = db.transaction(STORE_NAME, "readwrite")
	const transactionDone = transactionToPromise(transaction)
	const store = transaction.objectStore(STORE_NAME)
	await requestToPromise(store.delete(entry.id as string))
	await transactionDone
	const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
	await cache.delete(getCacheKey(entry))
}

function isEntryIdleExpired(entry: CanvasMediaEntry, now = Date.now()): boolean {
	if (!Number.isFinite(maxIdleAgeMs) || maxIdleAgeMs < 0) return false
	const lastAccessedAt = entry.lastAccessedAt || entry.updatedAt || 0
	return lastAccessedAt > 0 && now - lastAccessedAt > maxIdleAgeMs
}

/** Best-effort maintenance for current-version entries that have been idle too long. */
export async function cleanupExpiredCanvasMediaStorage(): Promise<void> {
	try {
		const entries = await getAllEntries()
		const expiredEntries = entries.filter(
			(entry) => !isBodyWriteActive(entry.id) && isEntryIdleExpired(entry),
		)
		await Promise.allSettled(expiredEntries.map((entry) => deleteEntry(entry)))
	} catch {
		// Cache maintenance must never block Canvas media reads or SW activation.
	}
}

function queueTouch(entry: CanvasMediaEntry): void {
	const now = Date.now()
	const id = String(entry.id || "")
	if (!id) return
	const lastWrittenAt = lastTouchWriteAt.get(id) ?? entry.lastAccessedAt ?? 0
	if (now - lastWrittenAt < TOUCH_WRITEBACK_INTERVAL_MS) return
	pendingTouches.set(id, { id, lastAccessedAt: now })
	if (touchFlushTimer !== null) return
	touchFlushTimer = setTimeout(() => {
		touchFlushTimer = null
		void flushPendingTouches()
	}, TOUCH_FLUSH_IDLE_DELAY_MS)
}

async function flushPendingTouches(touches?: CanvasMediaTouch[]): Promise<void> {
	const updates = touches ?? Array.from(pendingTouches.values())
	if (!touches) pendingTouches.clear()
	if (updates.length === 0) return
	try {
		const db = await openDb()
		const transaction = db.transaction(STORE_NAME, "readwrite")
		const transactionDone = transactionToPromise(transaction)
		const store = transaction.objectStore(STORE_NAME)
		const appliedIds = new Set<string>()
		updates.forEach((update) => {
			const request = store.get(update.id)
			request.onsuccess = () => {
				const current = request.result as CanvasMediaEntry | undefined
				if (!current) return
				const lastWrittenAt = Math.max(
					current.lastAccessedAt || 0,
					lastTouchWriteAt.get(update.id) || 0,
				)
				if (update.lastAccessedAt - lastWrittenAt < TOUCH_WRITEBACK_INTERVAL_MS) return
				store.put(
					toStoredCanvasMediaEntry(
						{ ...current, lastAccessedAt: update.lastAccessedAt },
						current,
					),
				)
				appliedIds.add(update.id)
			}
		})
		await transactionDone
		updates
			.filter((update) => appliedIds.has(update.id))
			.forEach((update) => lastTouchWriteAt.set(update.id, update.lastAccessedAt))
	} catch {
		// Touch metadata is best effort and must not affect media reads.
	}
}

function getAccountedBodySize(entry: CanvasMediaEntry): number {
	return Math.max(entry.size || 0, entry.pendingBodySize || 0)
}

function estimateMetadataBytes(entry: CanvasMediaEntry): number {
	try {
		return JSON.stringify(entry).length * 2
	} catch {
		return 0
	}
}

function isBodyWriteActive(id: string | null | undefined): boolean {
	return !!id && (activeBodyWriteCounts.get(id) ?? 0) > 0
}

function beginActiveBodyWrite(id: string): void {
	activeBodyWriteCounts.set(id, (activeBodyWriteCounts.get(id) ?? 0) + 1)
}

function endActiveBodyWrite(id: string): void {
	const nextCount = (activeBodyWriteCounts.get(id) ?? 1) - 1
	if (nextCount <= 0) activeBodyWriteCounts.delete(id)
	else activeBodyWriteCounts.set(id, nextCount)
}

function hasTimedOutPendingBody(entry: CanvasMediaEntry, now = Date.now()): boolean {
	return (
		!!entry.pendingBodyToken &&
		!!entry.pendingBodyStartedAt &&
		now - entry.pendingBodyStartedAt > PENDING_BODY_MAX_AGE_MS
	)
}

async function reconcilePendingBody(entry: CanvasMediaEntry): Promise<CanvasMediaEntry> {
	const id = String(entry.id || "")
	const token = entry.pendingBodyToken
	if (!id || !token) return entry
	const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
	const response = await cache.match(getCacheKey(entry))
	const tokenMatches =
		response?.headers.get(BODY_WRITE_TOKEN_HEADER) === token &&
		tokenMatchesResourceIdentity(token, entry)
	return (
		(await updateEntryById(id, (current) => {
			if (current.pendingBodyToken !== token) return null
			const canCommitBody = tokenMatches && tokenMatchesResourceIdentity(token, current)
			return {
				...current,
				...(canCommitBody ? { size: current.pendingBodySize ?? current.size } : {}),
				pendingBodyToken: null,
				pendingBodySize: null,
				pendingBodyStartedAt: null,
			}
		})) ?? entry
	)
}

async function enforceStorageLimits(protectedResourceId: string | null = null): Promise<void> {
	const now = Date.now()
	let entries = await getAllEntries()
	const isProtected = (entry: CanvasMediaEntry) =>
		entry.id === protectedResourceId || isBodyWriteActive(entry.id)

	const expiredEntries = entries.filter(
		(entry) => !isProtected(entry) && isEntryIdleExpired(entry, now),
	)
	for (const entry of expiredEntries) await deleteEntry(entry)
	if (expiredEntries.length > 0) {
		const deletedIds = new Set(expiredEntries.map((entry) => entry.id))
		entries = entries.filter((entry) => !deletedIds.has(entry.id))
	}

	for (const entry of entries) {
		if (isProtected(entry) || !hasTimedOutPendingBody(entry, now)) continue
		try {
			const reconciled = await reconcilePendingBody(entry)
			entries = entries.map((candidate) =>
				candidate.id === entry.id ? reconciled : candidate,
			)
		} catch {
			// Pending recovery is best effort; later maintenance can retry it.
		}
	}

	let totalBodyBytes = entries.reduce((sum, entry) => sum + getAccountedBodySize(entry), 0)
	let totalMetadataBytes = entries.reduce((sum, entry) => sum + estimateMetadataBytes(entry), 0)
	let totalEntries = entries.length
	const exceedsLimit = () =>
		totalBodyBytes > maxBytes ||
		totalEntries > maxEntries ||
		totalMetadataBytes > maxMetadataBytes
	const evict = async (candidates: CanvasMediaEntry[]) => {
		for (const entry of candidates) {
			if (!exceedsLimit()) break
			await deleteEntry(entry)
			totalBodyBytes -= getAccountedBodySize(entry)
			totalMetadataBytes -= estimateMetadataBytes(entry)
			totalEntries -= 1
		}
	}
	const byLeastRecentAccess = (a: CanvasMediaEntry, b: CanvasMediaEntry) =>
		(a.lastAccessedAt || a.updatedAt || 0) - (b.lastAccessedAt || b.updatedAt || 0)
	const removableEntries = entries.filter((entry) => !isProtected(entry))
	await evict(
		removableEntries
			.filter((entry) => getAccountedBodySize(entry) <= 0)
			.sort(byLeastRecentAccess),
	)
	await evict(
		removableEntries
			.filter((entry) => getAccountedBodySize(entry) > 0)
			.sort(byLeastRecentAccess),
	)
}

async function enforceBodyByteLimit(protectedResourceId: string): Promise<void> {
	const entries = await getAllEntries()
	let totalBodyBytes = entries.reduce((sum, entry) => sum + getAccountedBodySize(entry), 0)
	if (totalBodyBytes <= maxBytes) return
	const removableEntries = entries
		.filter(
			(entry) =>
				entry.id !== protectedResourceId &&
				!isBodyWriteActive(entry.id) &&
				getAccountedBodySize(entry) > 0,
		)
		.sort(
			(a, b) =>
				(a.lastAccessedAt || a.updatedAt || 0) - (b.lastAccessedAt || b.updatedAt || 0),
		)
	for (const entry of removableEntries) {
		if (totalBodyBytes <= maxBytes) break
		await deleteEntry(entry)
		totalBodyBytes -= getAccountedBodySize(entry)
	}
}

function parseRange(rangeHeader: string | null, size: number) {
	const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || "")
	if (!match) return null

	const startText = match[1]
	const endText = match[2]
	let start = startText ? Number(startText) : 0
	let end = endText ? Number(endText) : size - 1

	if (!startText && endText) {
		const suffixLength = Number(endText)
		start = Math.max(size - suffixLength, 0)
		end = size - 1
	}

	if (
		!Number.isFinite(start) ||
		!Number.isFinite(end) ||
		start < 0 ||
		end < start ||
		start >= size
	) {
		return null
	}

	return {
		start,
		end: Math.min(end, size - 1),
	}
}

function createResponseFromBlobResult(result: {
	blob: Blob
	status: number
	statusText: string
	headers: Headers
}) {
	return new Response(result.blob, {
		status: result.status,
		statusText: result.statusText,
		headers: new Headers(result.headers),
	})
}

function getIdentityFingerprint(identity: string): string {
	let hash = 2166136261
	for (let index = 0; index < identity.length; index += 1) {
		hash ^= identity.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return (hash >>> 0).toString(36)
}

function createBodyWriteToken(entry: CanvasMediaEntry): string {
	const randomPart =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
	return `${getIdentityFingerprint(getResourceFetchIdentity(entry))}.${randomPart}`
}

function tokenMatchesResourceIdentity(token: string, entry: CanvasMediaEntry): boolean {
	return token.startsWith(`${getIdentityFingerprint(getResourceFetchIdentity(entry))}.`)
}

async function getReadableCachedResponse(
	cache: Cache,
	entry: CanvasMediaEntry,
): Promise<Response | undefined> {
	const response = await cache.match(getCacheKey(entry))
	if (!response) return undefined
	const bodyToken = response.headers.get(BODY_WRITE_TOKEN_HEADER)
	if (entry.pendingBodyToken) {
		if (
			bodyToken !== entry.pendingBodyToken ||
			!tokenMatchesResourceIdentity(entry.pendingBodyToken, entry)
		) {
			return undefined
		}
		void updateEntryById(String(entry.id || ""), (current) => {
			const currentToken = current.pendingBodyToken
			if (!currentToken || currentToken !== entry.pendingBodyToken) return null
			return {
				...current,
				...(tokenMatchesResourceIdentity(currentToken, current)
					? { size: current.pendingBodySize ?? current.size }
					: {}),
				pendingBodyToken: null,
				pendingBodySize: null,
				pendingBodyStartedAt: null,
			}
		}).catch(() => undefined)
		return response
	}
	if (bodyToken && !tokenMatchesResourceIdentity(bodyToken, entry)) return undefined
	return response
}

function stripInternalBodyHeaders(response: Response): Response {
	if (!response.headers.has(BODY_WRITE_TOKEN_HEADER)) return response
	const headers = new Headers(response.headers)
	headers.delete(BODY_WRITE_TOKEN_HEADER)
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}

async function buildRangeResponse(response: Response, request: Request): Promise<Response> {
	const range = request.headers.get("range")
	if (!range) return response

	// CacheStorage/Response may originate from a different realm (notably SW and test runtimes).
	// ArrayBuffer slicing avoids Blob-brand mismatches while preserving the existing full-body
	// cache plus 206 response contract used by video and audio seeking.
	const bodyBuffer = await response.arrayBuffer()
	const parsedRange = parseRange(range, bodyBuffer.byteLength)
	if (!parsedRange) {
		return new Response(null, {
			status: 416,
			headers: {
				"Content-Range": `bytes */${bodyBuffer.byteLength}`,
			},
		})
	}

	const body = bodyBuffer.slice(parsedRange.start, parsedRange.end + 1)
	const headers = new Headers(response.headers)
	headers.set("Accept-Ranges", "bytes")
	headers.set("Content-Length", String(body.byteLength))
	headers.set(
		"Content-Range",
		`bytes ${parsedRange.start}-${parsedRange.end}/${bodyBuffer.byteLength}`,
	)

	return new Response(body, {
		status: 206,
		statusText: "Partial Content",
		headers,
	})
}

async function putResponseInCache(
	response: Response,
	entry: CanvasMediaEntry,
	metadata: ReturnType<typeof getResponseMetadata>,
	bodySize: number,
): Promise<void> {
	if (!response.ok) return
	if (bodySize > maxBytes) return

	const resourceId = getResourceId(entry)
	const token = createBodyWriteToken(entry)
	const pendingStartedAt = Date.now()
	let pendingPrepared = false
	let pendingEntry: CanvasMediaEntry | null = null
	beginActiveBodyWrite(resourceId)
	try {
		pendingEntry = await updateEntryById(resourceId, (current) => {
			if (getResourceFetchIdentity(current) !== getResourceFetchIdentity(entry)) return null
			pendingPrepared = true
			return {
				...current,
				pendingBodyToken: token,
				pendingBodySize: bodySize,
				pendingBodyStartedAt: pendingStartedAt,
			}
		})
	} catch (error) {
		endActiveBodyWrite(resourceId)
		throw error
	}
	if (!pendingPrepared) {
		endActiveBodyWrite(resourceId)
		return
	}

	try {
		await enforceBodyByteLimit(resourceId)
	} catch {
		await updateEntryById(resourceId, (current) =>
			current.pendingBodyToken === token
				? {
						...current,
						pendingBodyToken: null,
						pendingBodySize: null,
						pendingBodyStartedAt: null,
					}
				: null,
		).catch(() => undefined)
		endActiveBodyWrite(resourceId)
		return
	}

	const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
	const cacheKey = getCacheKey(pendingEntry ?? entry)
	const previousResponse = await cache.match(cacheKey)
	try {
		const cacheHeaders = new Headers(response.headers)
		cacheHeaders.set(BODY_WRITE_TOKEN_HEADER, token)
		await cache.put(
			cacheKey,
			new Response(response.clone().body, {
				status: response.status,
				statusText: response.statusText,
				headers: cacheHeaders,
			}),
		)
		let committed = false
		await updateEntryById(resourceId, (current) => {
			if (
				current.pendingBodyToken !== token ||
				getResourceFetchIdentity(current) !== getResourceFetchIdentity(entry)
			) {
				return null
			}
			committed = true
			return {
				...current,
				...metadata,
				size: bodySize,
				lastAccessedAt: Date.now(),
				pendingBodyToken: null,
				pendingBodySize: null,
				pendingBodyStartedAt: null,
			}
		})
		if (!committed) throw new Error("Canvas media generation changed during body write")
	} catch (error) {
		try {
			if (previousResponse) await cache.put(cacheKey, previousResponse)
			else await cache.delete(cacheKey)
		} catch {
			// Rollback is best effort; preserve the original metadata error.
		}
		await updateEntryById(resourceId, (current) =>
			current.pendingBodyToken === token
				? {
						...current,
						pendingBodyToken: null,
						pendingBodySize: null,
						pendingBodyStartedAt: null,
					}
				: null,
		).catch(() => undefined)
		throw error
	} finally {
		endActiveBodyWrite(resourceId)
	}
	void enforceStorageLimits().catch(() => undefined)
}

async function isCurrentResourceGeneration(entry: CanvasMediaEntry): Promise<boolean> {
	try {
		const current = await getEntryByPath(
			String(entry.path || "").replace(/^\/+/, ""),
			normalizeResourceNamespaceForStorage(entry.namespace),
			entry.mediaType as CanvasMediaType,
		)
		return !!current && getResourceFetchIdentity(current) === getResourceFetchIdentity(entry)
	} catch {
		return false
	}
}

async function fetchResourceBlobOnce(entry: CanvasMediaEntry): Promise<FetchResourceBlobResult> {
	const cacheKey = getCacheKey(entry)
	const identity = getResourceFetchIdentity(entry)
	const existingRequest = inflightResourceMap.get(cacheKey)
	if (existingRequest?.identity === identity) return existingRequest.promise

	const promise = (async () => {
		const sourceUrl = getSourceUrl(entry)
		if (!sourceUrl) {
			return {
				response: new Response(null, { status: 404 }),
			}
		}

		const response = await fetch(sourceUrl, { cache: "default" })
		if (!response.ok) return { response }

		const blob = await response.blob()
		const metadata = getResponseMetadata(response, blob.size)
		const result = {
			blob,
			headers: new Headers(response.headers),
			metadata,
			status: response.status,
			statusText: response.statusText,
		}
		if (await isCurrentResourceGeneration(entry)) {
			await putResponseInCache(
				createResponseFromBlobResult(result),
				entry,
				metadata,
				result.blob.size,
			).catch(() => undefined)
		}
		return result
	})().finally(() => {
		const currentRequest = inflightResourceMap.get(cacheKey)
		if (currentRequest?.identity === identity && currentRequest.promise === promise) {
			inflightResourceMap.delete(cacheKey)
		}
	})

	inflightResourceMap.set(cacheKey, { identity, promise })
	return promise
}

/** 处理 Canvas 虚拟资源请求，保持与历史独立 SW 相同的缓存/回源行为。 */
export async function handleCanvasMediaRequest(request: Request): Promise<Response | null> {
	const virtualRequest = parseVirtualResourceRequest(request.url)
	if (!virtualRequest) return null
	if (request.method !== "GET") return null

	try {
		const entry = await getEntryByPath(
			virtualRequest.resourcePath,
			virtualRequest.namespace,
			virtualRequest.mediaType,
		)
		if (!entry) {
			return new Response(null, { status: 404 })
		}

		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		const cachedResponse = await getReadableCachedResponse(cache, entry)
		if (cachedResponse) {
			queueTouch(entry)
			return buildRangeResponse(stripInternalBodyHeaders(cachedResponse), request)
		}

		const result = await fetchResourceBlobOnce(entry)
		if ("response" in result) return buildRangeResponse(result.response, request)
		return buildRangeResponse(createResponseFromBlobResult(result), request)
	} catch {
		const entry = await getEntryByPath(
			virtualRequest.resourcePath,
			virtualRequest.namespace,
			virtualRequest.mediaType,
		)
		if (!entry) {
			return new Response(null, { status: 404 })
		}
		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		const cachedResponse = await getReadableCachedResponse(cache, entry)
		if (cachedResponse) {
			return buildRangeResponse(stripInternalBodyHeaders(cachedResponse), request)
		}
		return Response.error()
	}
}

/** 主 SW 收到 Canvas 消息后的统一处理入口。 */
export function handleCanvasMediaMessage(event: ExtendableMessageEvent): boolean {
	const data = event.data || {}
	if (data.maxBytes && Number.isFinite(data.maxBytes)) {
		maxBytes = data.maxBytes
	}
	if (data.maxIdleAgeMs !== undefined && Number.isFinite(data.maxIdleAgeMs)) {
		maxIdleAgeMs = Math.max(0, data.maxIdleAgeMs)
	}
	if (data.maxEntries !== undefined && Number.isFinite(data.maxEntries)) {
		maxEntries = Math.max(1, data.maxEntries)
	}
	if (data.maxMetadataBytes !== undefined && Number.isFinite(data.maxMetadataBytes)) {
		maxMetadataBytes = Math.max(1, data.maxMetadataBytes)
	}

	if (data.type === "CANVAS_MEDIA_CACHE_CONFIG") {
		return true
	}

	if (data.type === "CANVAS_MEDIA_CACHE_TOUCH_BATCH" && Array.isArray(data.touches)) {
		event.waitUntil(flushPendingTouches(data.touches))
		return true
	}

	if (data.type === "CANVAS_MEDIA_CACHE_ENFORCE_LIMIT") {
		event.waitUntil(enforceStorageLimits())
		return true
	}

	return false
}
