/**
 * 画布媒体离线缓存 Service Worker。
 *
 * 根因备忘（曾导致虚拟资源 404）：
 * 1) 路径形态不一致：主线程 postMessage / IndexedDB 写入的 `entry.path` 为 Unicode 明文（及前导 `/`），
 *    而 fetch 事件里的 `request.url` 在部分环境（如 Worker 内 fetch）下 `pathname` 中 `design-resource/` 之后
 *    仍为 percent-encoded（如 `%E6%96%B0%E5%BB%BA...`）。若 `getEntryByPath` 用原始字符串做 `===`，会永远
 *    匹配不到条目 → SW 返回 404。因此统一经 `normalizeResourcePathForLookup` 再比对。
 * 2) 主线程换链须用 `MediaResourceOfflineCacheManager` 的 `isOfflineCacheFeatureOn`（与 `isActiveConsumer` 解耦），
 *    避免 Strict Mode / 路由切换销毁 Canvas 后仍在飞行的换链退回 OSS 直链、与虚拟 URL 策略不一致。
 */
const DB_NAME = "canvas-media-resource-offline-cache"
const DB_VERSION = 2
const LOOKUP_PATH_INDEX = "lookupPath"
const STORE_NAME = "resources"
const CACHE_NAME = "canvas-media-resources-v1"
const DEFAULT_MAX_BYTES = 1024 * 1024 * 1024
const VIRTUAL_RESOURCE_PATH_SEGMENT = "/canvas-design-media/"
const VIRTUAL_RESOURCE_DESIGN_RESOURCE_SEGMENT = "/design-resource/"

let maxBytes = DEFAULT_MAX_BYTES
const inflightResourceMap = new Map()

/**
 * 将 `design-resource/` 之后的资源路径规范成与主线程 IndexedDB `entry.path` 可比较的键。
 * 去掉前导 `/`，并对整段做 `decodeURIComponent`（含中文路径、空格 `%20` 等），避免与明文 Unicode 存储不一致。
 */
function normalizeResourcePathForLookup(path) {
	if (path == null || path === "") return ""
	let p = String(path).replace(/^\/+/g, "")
	try {
		p = decodeURIComponent(p)
	} catch {
		// 非法转义序列时保留原串
	}
	return p
}

function requestToPromise(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

function openDb() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)
		request.onupgradeneeded = (event) => {
			const db = request.result
			const tx = event.target.transaction
			let store
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
			} else {
				store = tx.objectStore(STORE_NAME)
			}

			if (event.oldVersion < 2) {
				if (event.oldVersion >= 1) {
					const migrateRequest = store.openCursor()
					migrateRequest.onsuccess = () => {
						const cursor = migrateRequest.result
						if (cursor) {
							const value = cursor.value
							const lookupPath = normalizeResourcePathForLookup(value.path)
							if (value.lookupPath !== lookupPath) {
								cursor.update({ ...value, lookupPath })
							}
							cursor.continue()
						} else if (!store.indexNames.contains(LOOKUP_PATH_INDEX)) {
							store.createIndex(LOOKUP_PATH_INDEX, LOOKUP_PATH_INDEX, {
								unique: false,
							})
						}
					}
					migrateRequest.onerror = () => reject(migrateRequest.error)
				} else if (!store.indexNames.contains(LOOKUP_PATH_INDEX)) {
					store.createIndex(LOOKUP_PATH_INDEX, LOOKUP_PATH_INDEX, { unique: false })
				}
			}
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

function getResourceId(entry) {
	return `${entry.mediaType}:${entry.path}`
}

function getCacheKey(entry) {
	return entry.cacheKey
}

function getSourceUrl(entry) {
	return entry.sourceUrl || entry.originalUrl || entry.url
}

function getResponseMetadata(response, blobSize) {
	const contentLengthText = response.headers.get("Content-Length")
	const contentLength = Number(contentLengthText)
	return {
		etag: response.headers.get("ETag"),
		lastModified: response.headers.get("Last-Modified"),
		contentLength: Number.isFinite(contentLength) ? contentLength : blobSize,
		contentType: response.headers.get("Content-Type"),
	}
}

function hasResourceChanged(previousEntry, metadata) {
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

/** 从虚拟媒体 URL 解析出资源路径；解析结果须经 `normalizeResourcePathForLookup` 再参与 IDB 查找。 */
function parseVirtualResourceRequest(url) {
	const parsedUrl = new URL(url)
	const segmentIndex = parsedUrl.pathname.indexOf(VIRTUAL_RESOURCE_PATH_SEGMENT)
	if (segmentIndex < 0) return null

	const resourceSegmentIndex = parsedUrl.pathname.indexOf(
		VIRTUAL_RESOURCE_DESIGN_RESOURCE_SEGMENT,
		segmentIndex + VIRTUAL_RESOURCE_PATH_SEGMENT.length,
	)
	if (resourceSegmentIndex < 0) return null

	const rawResourcePath = parsedUrl.pathname
		.slice(resourceSegmentIndex + VIRTUAL_RESOURCE_DESIGN_RESOURCE_SEGMENT.length)
		.replace(/^\/+/, "")
	if (!rawResourcePath) return null

	const resourcePath = normalizeResourcePathForLookup(rawResourcePath)
	if (!resourcePath) return null

	return { resourcePath }
}

async function saveEntry(entry) {
	const db = await openDb()
	const transaction = db.transaction(STORE_NAME, "readwrite")
	const store = transaction.objectStore(STORE_NAME)
	const id = getResourceId(entry)
	const existing = await requestToPromise(store.get(id))
	await requestToPromise(
		store.put({
			...existing,
			...entry,
			lookupPath: normalizeResourcePathForLookup(entry.path),
			etag: entry.etag ?? existing?.etag,
			lastModified: entry.lastModified ?? existing?.lastModified,
			contentLength: entry.contentLength ?? existing?.contentLength,
			contentType: entry.contentType ?? existing?.contentType,
			cacheKey: getCacheKey(entry),
			id,
		}),
	)
}

async function getAllEntries() {
	const db = await openDb()
	const transaction = db.transaction(STORE_NAME, "readonly")
	const store = transaction.objectStore(STORE_NAME)
	return requestToPromise(store.getAll())
}

async function getEntryByPath(resourcePath) {
	const needle = normalizeResourcePathForLookup(resourcePath)
	if (!needle) return null
	const db = await openDb()
	const transaction = db.transaction(STORE_NAME, "readonly")
	const store = transaction.objectStore(STORE_NAME)
	if (!store.indexNames.contains(LOOKUP_PATH_INDEX)) {
		const entries = await requestToPromise(store.getAll())
		return (
			entries.find((entry) => normalizeResourcePathForLookup(entry.path) === needle) || null
		)
	}
	const index = store.index(LOOKUP_PATH_INDEX)
	const matches = await requestToPromise(index.getAll(needle))
	return matches[0] || null
}

async function deleteEntry(entry) {
	const db = await openDb()
	const transaction = db.transaction(STORE_NAME, "readwrite")
	const store = transaction.objectStore(STORE_NAME)
	await requestToPromise(store.delete(entry.id))
	const cache = await caches.open(CACHE_NAME)
	await cache.delete(getCacheKey(entry))
}

async function touchEntry(entry, updates = {}) {
	await saveEntry({
		...entry,
		...updates,
		lastAccessedAt: Date.now(),
	})
}

async function enforceMaxBytes(bytesToReserve = 0, protectedResourceId = null) {
	const entries = await getAllEntries()
	let total = entries.reduce((sum, entry) => {
		if (entry.id === protectedResourceId) return sum
		return sum + (entry.size || 0)
	}, 0)
	if (total + bytesToReserve <= maxBytes) return

	const removableEntries = entries
		.filter((entry) => (entry.size || 0) > 0 && entry.id !== protectedResourceId)
		.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

	for (const entry of removableEntries) {
		if (total + bytesToReserve <= maxBytes) break
		await deleteEntry(entry)
		total -= entry.size || 0
	}
}

function parseRange(rangeHeader, size) {
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

async function buildRangeResponse(response, request) {
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

async function putResponseInCache(response, entry, metadata) {
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

function createResponseFromBlobResult(result) {
	return new Response(result.blob, {
		status: result.status,
		statusText: result.statusText,
		headers: new Headers(result.headers),
	})
}

async function fetchResourceBlobOnce(entry) {
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

async function refreshResource(entry) {
	const previousEntry = await getEntryByPath(entry.path.replace(/^\/+/, ""))
	await saveEntry(entry)
	const result = await fetchResourceBlobOnce(entry)
	if (!result.blob) {
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

function respondToMessage(event, data) {
	const port = event.ports?.[0]
	if (!port) return
	port.postMessage(data)
}

self.addEventListener("install", (event) => {
	event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim())
})

self.addEventListener("message", (event) => {
	const data = event.data || {}
	if (data.maxBytes && Number.isFinite(data.maxBytes)) {
		maxBytes = data.maxBytes
	}

	if (data.type === "CANVAS_MEDIA_CACHE_REGISTER" && data.entry) {
		event.waitUntil(saveEntry(data.entry))
		return
	}

	if (data.type === "CANVAS_MEDIA_CACHE_REFRESH" && data.entry) {
		event.waitUntil(
			refreshResource(data.entry)
				.then((result) => {
					respondToMessage(event, {
						type: "CANVAS_MEDIA_CACHE_REFRESH_RESULT",
						...result,
					})
				})
				.catch(() => {
					respondToMessage(event, {
						type: "CANVAS_MEDIA_CACHE_REFRESH_RESULT",
						refreshed: false,
						changed: false,
					})
				}),
		)
		return
	}

	if (data.type === "CANVAS_MEDIA_CACHE_ENFORCE_LIMIT") {
		event.waitUntil(enforceMaxBytes())
	}
})

self.addEventListener("fetch", (event) => {
	const request = event.request
	const virtualRequest = parseVirtualResourceRequest(request.url)
	if (!virtualRequest) return
	if (request.method !== "GET") return

	event.respondWith(
		(async () => {
			const entry = await getEntryByPath(virtualRequest.resourcePath)
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
			if (result.blob) {
				return buildRangeResponse(createResponseFromBlobResult(result), request)
			}
			return buildRangeResponse(result.response, request)
		})().catch(async () => {
			const entry = await getEntryByPath(virtualRequest.resourcePath)
			if (!entry) {
				return new Response(null, { status: 404 })
			}
			const cache = await caches.open(CACHE_NAME)
			const cachedResponse = await cache.match(getCacheKey(entry))
			if (cachedResponse) {
				return buildRangeResponse(cachedResponse, request)
			}
			return Response.error()
		}),
	)
})
