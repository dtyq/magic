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

export const CANVAS_MEDIA_CACHE_NAME = "canvas-media-resources-v1"

const OFFLINE_CACHE_VERSION = 1
const DB_BASE_NAME = "canvas-media-resource-offline-cache"
const DB_VERSION = OFFLINE_CACHE_VERSION
const DB_NAME = `${DB_BASE_NAME}-v${OFFLINE_CACHE_VERSION}`
const STORE_NAME = "resources"
const CACHE_BASE_NAME = "canvas-media-resources"
const CACHE_NAME = `${CACHE_BASE_NAME}-v${OFFLINE_CACHE_VERSION}`
const DEFAULT_MAX_BYTES = 1024 * 1024 * 1024
const DEFAULT_RESOURCE_NAMESPACE = "__global__"
const VIRTUAL_RESOURCE_PATH_SEGMENT = "/canvas-design-media/"
const VIRTUAL_RESOURCE_ROUTE_MARKER = `/sw${VIRTUAL_RESOURCE_PATH_SEGMENT}`
const VIRTUAL_RESOURCE_DESIGN_RESOURCE_SEGMENT = "/design-resource/"
const VIRTUAL_RESOURCE_MEDIA_TYPES = new Set(["image", "video"])

type CanvasMediaEntry = {
	id?: string
	namespace?: string
	path?: string
	mediaType?: "image" | "video"
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
	lastAccessedAt?: number
	updatedAt?: number
}

type CanvasMediaRefreshResult = {
	refreshed: boolean
	changed: boolean
	metadata?: ReturnType<typeof getResponseMetadata>
}

let maxBytes = DEFAULT_MAX_BYTES
const inflightResourceMap = new Map<string, Promise<Awaited<ReturnType<typeof fetchResourceBlobOnce>>>>()

/**
 * 将 `design-resource/` 之后的资源路径规范成与主线程 IndexedDB `entry.path` 可比较的键。
 */
export function normalizeResourcePathForLookup(path: string | null | undefined): string {
	if (path == null || path === "") return ""
	let normalizedPath = String(path).replace(/^\/+/g, "")
	try {
		normalizedPath = decodeURIComponent(normalizedPath)
	} catch {
		// 非法转义序列时保留原串
	}
	return normalizedPath
}

/** 规范化命名空间，保证空值收敛到统一全局命名空间。 */
export function normalizeResourceNamespace(namespace: string | null | undefined): string {
	const normalized = normalizeResourcePathForLookup(namespace)
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

/** 使用固定虚拟资源协议构造缓存键，保持与历史方案兼容。 */
function buildVirtualResourceUrl(
	namespace: string | null | undefined,
	mediaType: "image" | "video" | null | undefined,
	resourcePath: string | null | undefined,
): string {
	return joinUrlPathSegments(
		self.location.origin,
		"sw",
		"canvas-design-media",
		stripPathEdgeSlashes(normalizeResourceNamespace(namespace)),
		mediaType,
		"design-resource",
		normalizeResourcePathForLookup(resourcePath),
	)
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)
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
		normalizeResourceNamespace(entry.namespace),
		entry.mediaType,
		normalizeResourcePathForLookup(entry.path),
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

function getResponseMetadata(response: Response, blobSize: number) {
	const contentLengthText = response.headers.get("Content-Length")
	const contentLength = Number(contentLengthText)
	return {
		etag: response.headers.get("ETag"),
		lastModified: response.headers.get("Last-Modified"),
		contentLength: Number.isFinite(contentLength) ? contentLength : blobSize,
		contentType: response.headers.get("Content-Type"),
	}
}

function hasResourceChanged(
	previousEntry: CanvasMediaEntry | null,
	metadata: ReturnType<typeof getResponseMetadata>,
): boolean {
	if (!previousEntry) return true
	if (previousEntry.etag && metadata.etag) return previousEntry.etag !== metadata.etag
	if (previousEntry.lastModified && metadata.lastModified) {
		return previousEntry.lastModified !== metadata.lastModified
	}
	if (previousEntry.contentLength && metadata.contentLength) {
		if (previousEntry.contentLength !== metadata.contentLength) return true
		if (previousEntry.contentType && metadata.contentType) {
			return previousEntry.contentType !== metadata.contentType
		}
		return false
	}
	return true
}

/** 从虚拟媒体 URL 解析资源定位信息。 */
export function parseVirtualResourceRequest(
	url: string,
): { namespace: string; mediaType: "image" | "video"; resourcePath: string } | null {
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
	if (!mediaType || !VIRTUAL_RESOURCE_MEDIA_TYPES.has(mediaType)) return null

	const rawNamespace = rawNamespaceSegments.join("/")
	const namespace = normalizeResourceNamespace(rawNamespace)
	const resourcePath = normalizeResourcePathForLookup(rawResourcePath)
	if (!resourcePath) return null

	return { namespace, mediaType, resourcePath }
}

async function saveEntry(entry: CanvasMediaEntry): Promise<void> {
	const db = await openDb()
	const transaction = db.transaction(STORE_NAME, "readwrite")
	const store = transaction.objectStore(STORE_NAME)
	const namespace = normalizeResourceNamespace(entry.namespace)
	const id = getResourceId(entry)
	const existing = await requestToPromise<CanvasMediaEntry | undefined>(store.get(id))

	await requestToPromise(
		store.put({
			id,
			namespace,
			path: entry.path,
			sourceUrl:
				entry.sourceUrl || existing?.sourceUrl || existing?.originalUrl || existing?.url,
			mediaType: entry.mediaType,
			expiresAt: entry.expiresAt ?? existing?.expiresAt,
			size: entry.size ?? existing?.size,
			etag: entry.etag ?? existing?.etag,
			lastModified: entry.lastModified ?? existing?.lastModified,
			contentLength: entry.contentLength ?? existing?.contentLength,
			contentType: entry.contentType ?? existing?.contentType,
			lastAccessedAt: entry.lastAccessedAt ?? existing?.lastAccessedAt ?? Date.now(),
			updatedAt: entry.updatedAt ?? existing?.updatedAt ?? Date.now(),
		}),
	)
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
	mediaType: "image" | "video",
): Promise<CanvasMediaEntry | null> {
	const normalizedPath = normalizeResourcePathForLookup(resourcePath)
	if (!normalizedPath) return null

	const normalizedNamespace = normalizeResourceNamespace(namespace)
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
	const store = transaction.objectStore(STORE_NAME)
	await requestToPromise(store.delete(entry.id as string))
	const cache = await caches.open(CACHE_NAME)
	await cache.delete(getCacheKey(entry))
}

async function touchEntry(entry: CanvasMediaEntry, updates: Partial<CanvasMediaEntry> = {}): Promise<void> {
	await saveEntry({
		...entry,
		...updates,
		lastAccessedAt: Date.now(),
	})
}

async function enforceMaxBytes(
	bytesToReserve = 0,
	protectedResourceId: string | null = null,
): Promise<void> {
	const entries = await getAllEntries()
	let total = entries.reduce((sum, entry) => {
		if (entry.id === protectedResourceId) return sum
		return sum + (entry.size || 0)
	}, 0)
	if (total + bytesToReserve <= maxBytes) return

	const removableEntries = entries
		.filter((entry) => (entry.size || 0) > 0 && entry.id !== protectedResourceId)
		.sort((a, b) => (a.lastAccessedAt || 0) - (b.lastAccessedAt || 0))

	for (const entry of removableEntries) {
		if (total + bytesToReserve <= maxBytes) break
		await deleteEntry(entry)
		total -= entry.size || 0
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

async function buildRangeResponse(response: Response, request: Request): Promise<Response> {
	const range = request.headers.get("range")
	if (!range) return response

	const blob = await response.blob()
	const parsedRange = parseRange(range, blob.size)
	if (!parsedRange) {
		return new Response(null, {
			status: 416,
			headers: {
				"Content-Range": `bytes */${blob.size}`,
			},
		})
	}

	const body = blob.slice(parsedRange.start, parsedRange.end + 1)
	const headers = new Headers(response.headers)
	headers.set("Accept-Ranges", "bytes")
	headers.set("Content-Length", String(body.size))
	headers.set("Content-Range", `bytes ${parsedRange.start}-${parsedRange.end}/${blob.size}`)

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
): Promise<void> {
	if (!response.ok) return
	const responseForSize = response.clone()
	const blob = await responseForSize.blob()
	if (blob.size > maxBytes) return

	await enforceMaxBytes(blob.size, getResourceId(entry))
	const cache = await caches.open(CACHE_NAME)
	await cache.put(getCacheKey(entry), response.clone())
	await touchEntry(entry, {
		...metadata,
		size: blob.size,
		updatedAt: Date.now(),
	})
	await enforceMaxBytes()
}

async function fetchResourceBlobOnce(entry: CanvasMediaEntry) {
	const cacheKey = getCacheKey(entry)
	const existingPromise = inflightResourceMap.get(cacheKey)
	if (existingPromise) return existingPromise

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
		await putResponseInCache(createResponseFromBlobResult(result), entry, metadata).catch(
			() => undefined,
		)
		return result
	})().finally(() => {
		inflightResourceMap.delete(cacheKey)
	})

	inflightResourceMap.set(cacheKey, promise)
	return promise
}

/** 刷新单条 Canvas 资源缓存，并返回“是否刷新/是否内容变化”的结果。 */
export async function refreshCanvasMediaResource(entry: CanvasMediaEntry): Promise<CanvasMediaRefreshResult> {
	const previousEntry = await getEntryByPath(
		String(entry.path || "").replace(/^\/+/, ""),
		normalizeResourceNamespace(entry.namespace),
		entry.mediaType as "image" | "video",
	)
	await saveEntry(entry)
	const result = await fetchResourceBlobOnce(entry)
	if (!("blob" in result) || !result.blob) {
		return {
			refreshed: false,
			changed: false,
		}
	}

	return {
		refreshed: true,
		changed: hasResourceChanged(previousEntry, result.metadata),
		metadata: result.metadata,
	}
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

		const cache = await caches.open(CACHE_NAME)
		const cachedResponse = await cache.match(getCacheKey(entry))
		if (cachedResponse) {
			await touchEntry(entry)
			return buildRangeResponse(cachedResponse, request)
		}

		const result = await fetchResourceBlobOnce(entry)
		if ("blob" in result && result.blob) {
			return buildRangeResponse(createResponseFromBlobResult(result), request)
		}

		return buildRangeResponse(result.response, request)
	} catch {
		const entry = await getEntryByPath(
			virtualRequest.resourcePath,
			virtualRequest.namespace,
			virtualRequest.mediaType,
		)
		if (!entry) {
			return new Response(null, { status: 404 })
		}
		const cache = await caches.open(CACHE_NAME)
		const cachedResponse = await cache.match(getCacheKey(entry))
		if (cachedResponse) {
			return buildRangeResponse(cachedResponse, request)
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

	if (data.type === "CANVAS_MEDIA_CACHE_REGISTER" && data.entry) {
		event.waitUntil(saveEntry(data.entry))
		return true
	}

	if (data.type === "CANVAS_MEDIA_CACHE_REFRESH" && data.entry) {
		event.waitUntil(
			refreshCanvasMediaResource(data.entry)
				.then((result) => {
					const port = event.ports?.[0]
					port?.postMessage({
						type: "CANVAS_MEDIA_CACHE_REFRESH_RESULT",
						...result,
					})
				})
				.catch(() => {
					const port = event.ports?.[0]
					port?.postMessage({
						type: "CANVAS_MEDIA_CACHE_REFRESH_RESULT",
						refreshed: false,
						changed: false,
					})
				}),
		)
		return true
	}

	if (data.type === "CANVAS_MEDIA_CACHE_ENFORCE_LIMIT") {
		event.waitUntil(enforceMaxBytes())
		return true
	}

	return false
}
