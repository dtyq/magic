import { Blob as NodeBlob } from "node:buffer"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	CANVAS_MEDIA_CACHE_NAME,
	CANVAS_MEDIA_DB_NAME,
	CANVAS_MEDIA_OFFLINE_CACHE_VERSION,
	cleanupExpiredCanvasMediaStorage,
	cleanupLegacyCanvasMediaStorage,
	encodeResourcePathForUrl,
	handleCanvasMediaMessage,
	handleCanvasMediaRequest,
	parseVirtualResourceRequest,
} from "../canvasMediaShared"

type StoredCanvasEntry = {
	id: string
	namespace: string
	path: string
	mediaType: "image" | "video" | "audio"
	url?: string
	cacheKey?: string
	sourceUrl?: string
	lastAccessedAt?: number
	updatedAt?: number
	size?: number
	etag?: string | null
	lastModified?: string | null
	contentLength?: number | null
	contentType?: string | null
	resourceVersion?: string | null
	sourceUpdatedAt?: string | null
	pendingBodyToken?: string | null
	pendingBodySize?: number | null
	pendingBodyStartedAt?: number | null
}

const TEST_ORIGIN = "https://canvas.test"

class FakeIdbRequest<T> {
	public result!: T
	public error: Error | null = null
	public onsuccess: ((this: IDBRequest<T>, ev: Event) => unknown) | null = null
	public onerror: ((this: IDBRequest<T>, ev: Event) => unknown) | null = null
	public onupgradeneeded:
		| ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown)
		| null = null

	public succeed(result: T): void {
		this.result = result
		queueMicrotask(() => {
			this.onsuccess?.call(this as unknown as IDBRequest<T>, new Event("success"))
		})
	}
}

class FakeObjectStore {
	public constructor(
		private readonly records: Map<string, StoredCanvasEntry>,
		private readonly beforePut?: () => void,
	) {}

	public get(key: string): IDBRequest<StoredCanvasEntry | undefined> {
		const request = new FakeIdbRequest<StoredCanvasEntry | undefined>()
		request.succeed(this.records.get(key))
		return request as unknown as IDBRequest<StoredCanvasEntry | undefined>
	}

	public put(value: StoredCanvasEntry): IDBRequest<StoredCanvasEntry> {
		this.beforePut?.()
		const request = new FakeIdbRequest<StoredCanvasEntry>()
		this.records.set(value.id, value)
		request.succeed(value)
		return request as unknown as IDBRequest<StoredCanvasEntry>
	}

	public getAll(): IDBRequest<StoredCanvasEntry[]> {
		const request = new FakeIdbRequest<StoredCanvasEntry[]>()
		request.succeed([...this.records.values()])
		return request as unknown as IDBRequest<StoredCanvasEntry[]>
	}

	public delete(key: string): IDBRequest<undefined> {
		const request = new FakeIdbRequest<undefined>()
		this.records.delete(key)
		request.succeed(undefined)
		return request as unknown as IDBRequest<undefined>
	}
}

class FakeTransaction {
	public oncomplete: (() => void) | null = null
	public onerror: (() => void) | null = null
	public onabort: (() => void) | null = null

	public constructor(
		private readonly records: Map<string, StoredCanvasEntry>,
		private readonly beforePut?: () => void,
	) {
		queueMicrotask(() => {
			queueMicrotask(() => this.oncomplete?.())
		})
	}

	public objectStore(): FakeObjectStore {
		return new FakeObjectStore(this.records, this.beforePut)
	}
}

class FakeDatabase {
	public failNextPut = false
	private readonly stores = new Map<string, Map<string, StoredCanvasEntry>>()

	public objectStoreNames = {
		contains: (name: string) => this.stores.has(name),
	}

	public createObjectStore(name: string): FakeObjectStore {
		const store = new Map<string, StoredCanvasEntry>()
		this.stores.set(name, store)
		return new FakeObjectStore(store)
	}

	public transaction(name: string): FakeTransaction {
		if (!this.stores.has(name)) {
			this.stores.set(name, new Map<string, StoredCanvasEntry>())
		}
		const store = this.stores.get(name)
		if (!store) throw new Error(`Missing object store: ${name}`)
		return new FakeTransaction(store, () => {
			if (!this.failNextPut) return
			this.failNextPut = false
			throw new Error("IndexedDB metadata write failed")
		})
	}
}

class FakeIndexedDbFactory {
	private readonly databases = new Map<string, FakeDatabase>()

	public getDatabase(name: string): FakeDatabase | undefined {
		return this.databases.get(name)
	}

	public open(name: string): IDBOpenDBRequest {
		const request = new FakeIdbRequest<IDBDatabase>() as unknown as IDBOpenDBRequest
		queueMicrotask(() => {
			let db = this.databases.get(name)
			const isNew = !db
			if (!db) {
				db = new FakeDatabase()
				this.databases.set(name, db)
			}
			;(request as unknown as FakeIdbRequest<IDBDatabase>).result =
				db as unknown as IDBDatabase
			if (isNew) {
				request.onupgradeneeded?.call(
					request,
					new Event("upgradeneeded") as IDBVersionChangeEvent,
				)
			}
			;(request as unknown as FakeIdbRequest<IDBDatabase>).onsuccess?.call(
				request as unknown as IDBRequest<IDBDatabase>,
				new Event("success"),
			)
		})
		return request
	}
}

class FakeCache {
	private readonly entries = new Map<string, Response>()

	public async match(key: string): Promise<Response | undefined> {
		const response = this.entries.get(key)
		return response?.clone()
	}

	public async put(key: string, response: Response): Promise<void> {
		this.entries.set(key, response.clone())
	}

	public async delete(key: string): Promise<boolean> {
		return this.entries.delete(key)
	}
}

class FakeCacheStorage {
	private readonly caches = new Map<string, FakeCache>()

	public async open(name: string): Promise<FakeCache> {
		if (!this.caches.has(name)) {
			this.caches.set(name, new FakeCache())
		}
		return this.caches.get(name) as FakeCache
	}
}

function buildVirtualUrl(
	path: string,
	mediaType: StoredCanvasEntry["mediaType"] = "image",
): string {
	return `${TEST_ORIGIN}/sw/canvas-design-media/workspace/project/design/demo/${mediaType}/design-resource/${encodeResourcePathForUrl(path)}`
}

function buildBodyToken(entry: StoredCanvasEntry, suffix = "test-token"): string {
	const identity = [
		entry.sourceUrl || "",
		entry.resourceVersion || "",
		entry.sourceUpdatedAt || "",
	].join("\0")
	let hash = 2166136261
	for (let index = 0; index < identity.length; index += 1) {
		hash ^= identity.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return `${(hash >>> 0).toString(36)}.${suffix}`
}

async function dispatchCanvasMessage(data: Record<string, unknown>): Promise<boolean> {
	const waitUntil = vi.fn((promise: Promise<unknown>) => promise)
	const event = { data, waitUntil } as unknown as ExtendableMessageEvent
	const handled = handleCanvasMediaMessage(event)
	await waitUntil.mock.results[0]?.value
	return handled
}

async function saveCanvasEntry(
	entry: StoredCanvasEntry,
	options?: { dbName?: string; dbVersion?: number },
): Promise<void> {
	const openRequest = indexedDB.open(
		options?.dbName ?? CANVAS_MEDIA_DB_NAME,
		options?.dbVersion ?? CANVAS_MEDIA_OFFLINE_CACHE_VERSION,
	)
	const db = await new Promise<IDBDatabase>((resolve) => {
		openRequest.onsuccess = () => resolve(openRequest.result)
	})
	const store = db.transaction("resources", "readwrite").objectStore("resources")
	await new Promise<void>((resolve) => {
		const request = store.put(entry)
		request.onsuccess = () => resolve()
	})
}

async function readCanvasEntry(id: string): Promise<StoredCanvasEntry | undefined> {
	const openRequest = indexedDB.open(CANVAS_MEDIA_DB_NAME, CANVAS_MEDIA_OFFLINE_CACHE_VERSION)
	const db = await new Promise<IDBDatabase>((resolve) => {
		openRequest.onsuccess = () => resolve(openRequest.result)
	})
	const store = db.transaction("resources", "readonly").objectStore("resources")
	return new Promise<StoredCanvasEntry | undefined>((resolve) => {
		const request = store.get(id)
		request.onsuccess = () => resolve(request.result)
	})
}

describe("canvasMediaShared", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "indexedDB", {
			configurable: true,
			value: new FakeIndexedDbFactory(),
		})
		Object.defineProperty(globalThis, "caches", {
			configurable: true,
			value: new FakeCacheStorage(),
		})
		handleCanvasMediaMessage({
			data: {
				type: "CANVAS_MEDIA_CACHE_CONFIG",
				maxBytes: 1024 * 1024 * 1024,
				maxEntries: 16_384,
				maxMetadataBytes: 32 * 1024 * 1024,
				maxIdleAgeMs: 30 * 24 * 60 * 60 * 1000,
			},
			waitUntil: vi.fn(),
		} as unknown as ExtendableMessageEvent)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("uses a new cache namespace when path key semantics change", () => {
		expect(CANVAS_MEDIA_OFFLINE_CACHE_VERSION).toBe(5)
		expect(CANVAS_MEDIA_DB_NAME).toBe("canvas-media-resource-offline-cache-v5")
		expect(CANVAS_MEDIA_CACHE_NAME).toBe("canvas-media-resources-v5")
	})

	it("deletes only legacy Canvas media IndexedDB and CacheStorage namespaces", async () => {
		const deletedDatabases: string[] = []
		const indexedDBFactory = {
			deleteDatabase: vi.fn((name: string) => {
				deletedDatabases.push(name)
				const request = new FakeIdbRequest<undefined>()
				request.succeed(undefined)
				return request as unknown as IDBOpenDBRequest
			}),
		} as unknown as IDBFactory
		const cacheStorage = {
			delete: vi.fn().mockResolvedValue(true),
		} as unknown as CacheStorage

		await cleanupLegacyCanvasMediaStorage({ indexedDBFactory, cacheStorage })

		expect(deletedDatabases).toEqual(
			Array.from(
				{ length: CANVAS_MEDIA_OFFLINE_CACHE_VERSION - 1 },
				(_, index) => `canvas-media-resource-offline-cache-v${index + 1}`,
			),
		)
		expect(cacheStorage.delete).toHaveBeenCalledTimes(CANVAS_MEDIA_OFFLINE_CACHE_VERSION - 1)
		for (let version = 1; version < CANVAS_MEDIA_OFFLINE_CACHE_VERSION; version += 1) {
			expect(cacheStorage.delete).toHaveBeenNthCalledWith(
				version,
				`canvas-media-resources-v${version}`,
			)
		}
		expect(deletedDatabases).not.toContain(CANVAS_MEDIA_DB_NAME)
		expect(cacheStorage.delete).not.toHaveBeenCalledWith(CANVAS_MEDIA_CACHE_NAME)
	})

	it("does not reject cache initialization when legacy cleanup fails", async () => {
		const indexedDBFactory = {
			deleteDatabase: vi.fn(() => {
				throw new Error("deleteDatabase unavailable")
			}),
		} as unknown as IDBFactory
		const cacheStorage = {
			delete: vi.fn().mockRejectedValue(new Error("cache delete failed")),
		} as unknown as CacheStorage

		await expect(
			cleanupLegacyCanvasMediaStorage({ indexedDBFactory, cacheStorage }),
		).resolves.toBeUndefined()
	})

	it("cleans idle current-version entries and their CacheStorage bodies", async () => {
		const requestUrl = buildVirtualUrl("images/idle.png")
		const staleEntry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/image/images/idle.png",
			namespace: "workspace/project/design/demo",
			path: "images/idle.png",
			mediaType: "image",
			cacheKey: requestUrl,
			sourceUrl: "https://oss.example.com/images/idle.png",
			lastAccessedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
			updatedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
			size: 12,
		}
		await saveCanvasEntry(staleEntry)
		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		await cache.put(requestUrl, new Response("stale-image"))

		await cleanupExpiredCanvasMediaStorage()

		expect(await readCanvasEntry(staleEntry.id)).toBeUndefined()
		expect(await cache.match(requestUrl)).toBeUndefined()
	})

	it("does not read metadata from the incompatible v1 path-key namespace", async () => {
		const requestUrl = buildVirtualUrl("images/example.png")
		await saveCanvasEntry(
			{
				id: "workspace/project/design/demo/image/./images/example.png",
				namespace: "workspace/project/design/demo",
				path: "./images/example.png",
				mediaType: "image",
				cacheKey: requestUrl,
				sourceUrl: "https://oss.example.com/images/example.png",
			},
			{ dbName: "canvas-media-resource-offline-cache-v1", dbVersion: 1 },
		)

		const response = await handleCanvasMediaRequest(new Request(requestUrl))

		expect(response?.status).toBe(404)
	})

	it("parses canvas virtual urls with unicode paths", () => {
		const result = parseVirtualResourceRequest(
			`${TEST_ORIGIN}/sw/canvas-design-media/workspace/project/design/demo/image/design-resource/%E6%B5%8B%E8%AF%95%E7%94%BB%E5%B8%83/images/%E7%8C%AB.jpg`,
		)

		expect(result).toEqual({
			namespace: "workspace/project/design/demo",
			mediaType: "image",
			resourcePath: "测试画布/images/猫.jpg",
		})
	})

	it("encodes URL delimiters in path segments and restores them during lookup", () => {
		const resourcePath = "images/真丝系列#13 娃娃领?x%25.png"
		const requestUrl = buildVirtualUrl(resourcePath)
		expect(parseVirtualResourceRequest(requestUrl)?.resourcePath).toBe(resourcePath)

		expect(requestUrl).toContain("%2313%20")
		expect(requestUrl).toContain("%3Fx%2525.png")
		expect(parseVirtualResourceRequest(requestUrl)).toEqual({
			namespace: "workspace/project/design/demo",
			mediaType: "image",
			resourcePath,
		})
	})

	it("serves cached resources whose filenames contain URL delimiters", async () => {
		const resourcePath = "images/真丝系列#13 娃娃领?x%25.png"
		const requestUrl = buildVirtualUrl(resourcePath)
		const entry: StoredCanvasEntry = {
			id: `workspace/project/design/demo/image/${resourcePath}`,
			namespace: "workspace/project/design/demo",
			path: resourcePath,
			mediaType: "image",
			cacheKey: requestUrl,
			sourceUrl: "https://oss.example.com/images/source.png",
		}

		await saveCanvasEntry(entry)
		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		await cache.put(requestUrl, new Response("cached-delimited-image", { status: 200 }))

		const response = await handleCanvasMediaRequest(new Request(requestUrl))

		expect(response?.status).toBe(200)
		expect(await response?.text()).toBe("cached-delimited-image")
	})

	it("parses audio virtual urls without changing the v5 cache namespace", () => {
		expect(parseVirtualResourceRequest(buildVirtualUrl("audios/voice.mp3", "audio"))).toEqual({
			namespace: "workspace/project/design/demo",
			mediaType: "audio",
			resourcePath: "audios/voice.mp3",
		})
		expect(CANVAS_MEDIA_OFFLINE_CACHE_VERSION).toBe(5)
	})

	it("returns cached canvas response when cache entry exists", async () => {
		const requestUrl = buildVirtualUrl("images/example.png")
		const entry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/image/images/example.png",
			namespace: "workspace/project/design/demo",
			path: "images/example.png",
			mediaType: "image",
			cacheKey: requestUrl,
			sourceUrl: "https://oss.example.com/images/example.png",
		}
		await saveCanvasEntry(entry)
		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		await cache.put(requestUrl, new Response("cached-image", { status: 200 }))

		const response = await handleCanvasMediaRequest(new Request(requestUrl))

		expect(response).not.toBeNull()
		expect(await response?.text()).toBe("cached-image")
	})

	it("fetches sourceUrl and stores response when cache misses", async () => {
		const requestUrl = buildVirtualUrl("images/example.png")
		const entry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/image/images/example.png",
			namespace: "workspace/project/design/demo",
			path: "images/example.png",
			mediaType: "image",
			cacheKey: requestUrl,
			sourceUrl: "https://oss.example.com/images/example.png",
		}
		await saveCanvasEntry(entry)
		const networkBlob = new NodeBlob(["network-image"], { type: "image/png" })
		const networkResponse = new Response(networkBlob, {
			status: 200,
			headers: { "Content-Type": "image/png", ETag: "etag-1" },
		})
		Object.defineProperty(networkResponse, "blob", {
			value: vi.fn(async () => networkBlob),
		})
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(networkResponse)

		const response = await handleCanvasMediaRequest(new Request(requestUrl))
		const cachedResponse = await handleCanvasMediaRequest(new Request(requestUrl))

		expect(fetchSpy).toHaveBeenCalledWith("https://oss.example.com/images/example.png", {
			cache: "default",
		})
		expect(await response?.text()).toBe("network-image")
		expect(await cachedResponse?.text()).toBe("network-image")
		expect(fetchSpy).toHaveBeenCalledTimes(1)
	})

	it("accounts a pending body before CacheStorage put and commits compact metadata", async () => {
		const requestUrl = buildVirtualUrl("images/two-phase.png")
		const entry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/image/images/two-phase.png",
			namespace: "workspace/project/design/demo",
			path: "images/two-phase.png",
			mediaType: "image",
			cacheKey: requestUrl,
			sourceUrl: "https://oss.example.com/images/two-phase.png",
			etag: "legacy-etag",
			contentType: "image/png",
			updatedAt: 1,
		}
		await saveCanvasEntry(entry)
		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		const originalPut = cache.put.bind(cache)
		const cachePut = vi.spyOn(cache, "put").mockImplementation(async (key, response) => {
			const pending = await readCanvasEntry(entry.id)
			expect(pending).toEqual(
				expect.objectContaining({
					pendingBodySize: 12,
					pendingBodyStartedAt: expect.any(Number),
					pendingBodyToken: expect.any(String),
				}),
			)
			return originalPut(key, response)
		})
		const networkBlob = new NodeBlob(["network-body"], { type: "image/png" })
		const networkResponse = new Response(networkBlob, { status: 200 })
		Object.defineProperty(networkResponse, "blob", {
			value: vi.fn(async () => networkBlob),
		})
		vi.spyOn(globalThis, "fetch").mockResolvedValue(networkResponse)

		await handleCanvasMediaRequest(new Request(requestUrl))

		expect(cachePut).toHaveBeenCalledTimes(1)
		const stored = await readCanvasEntry(entry.id)
		expect(stored).toEqual(
			expect.objectContaining({
				size: 12,
				pendingBodyToken: null,
				pendingBodySize: null,
				pendingBodyStartedAt: null,
			}),
		)
		expect(stored).not.toHaveProperty("cacheKey")
		expect(stored).not.toHaveProperty("etag")
		expect(stored).not.toHaveProperty("contentType")
		expect(stored).not.toHaveProperty("updatedAt")
	})

	it("does not persist an older body after resource metadata advances", async () => {
		const requestUrl = buildVirtualUrl("images/generation.png")
		const entry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/image/images/generation.png",
			namespace: "workspace/project/design/demo",
			path: "images/generation.png",
			mediaType: "image",
			cacheKey: requestUrl,
			sourceUrl: "https://oss.example.com/images/generation-v1.png",
			resourceVersion: "generation-v1",
		}
		await saveCanvasEntry(entry)

		let resolveResponse!: (response: Response) => void
		const responsePromise = new Promise<Response>((resolve) => {
			resolveResponse = resolve
		})
		vi.spyOn(globalThis, "fetch").mockReturnValue(responsePromise)
		const requestPromise = handleCanvasMediaRequest(new Request(requestUrl))
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

		await saveCanvasEntry({
			...entry,
			sourceUrl: "https://oss.example.com/images/generation-v2.png",
			resourceVersion: "generation-v2",
		})
		const networkBlob = new NodeBlob(["generation-v1"], { type: "image/png" })
		const networkResponse = new Response(networkBlob, { status: 200 })
		Object.defineProperty(networkResponse, "blob", {
			value: vi.fn(async () => networkBlob),
		})
		resolveResponse(networkResponse)

		const response = await requestPromise
		expect(response).not.toBeNull()
		expect(await response?.text()).toBe("generation-v1")
		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		expect(await cache.match(requestUrl)).toBeUndefined()
	})

	it("rolls back a newly cached body when metadata persistence fails", async () => {
		const requestUrl = buildVirtualUrl("images/metadata-failure.png")
		const entry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/image/images/metadata-failure.png",
			namespace: "workspace/project/design/demo",
			path: "images/metadata-failure.png",
			mediaType: "image",
			cacheKey: requestUrl,
			sourceUrl: "https://oss.example.com/images/metadata-failure.png",
		}
		await saveCanvasEntry(entry)
		const database = (indexedDB as unknown as FakeIndexedDbFactory).getDatabase(
			CANVAS_MEDIA_DB_NAME,
		)
		if (!database) throw new Error("Test database was not initialized")
		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		const originalPut = cache.put.bind(cache)
		vi.spyOn(cache, "put").mockImplementation(async (key, response) => {
			await originalPut(key, response)
			database.failNextPut = true
		})

		const networkBlob = new NodeBlob(["network-image"], { type: "image/png" })
		const networkResponse = new Response(networkBlob, {
			status: 200,
			headers: { "Content-Type": "image/png" },
		})
		Object.defineProperty(networkResponse, "blob", {
			value: vi.fn(async () => networkBlob),
		})
		vi.spyOn(globalThis, "fetch").mockResolvedValue(networkResponse)

		const response = await handleCanvasMediaRequest(new Request(requestUrl))

		expect(await response?.text()).toBe("network-image")
		expect(await cache.match(requestUrl)).toBeUndefined()
		expect(await readCanvasEntry(entry.id)).toEqual(
			expect.objectContaining({
				pendingBodyToken: null,
				pendingBodySize: null,
				pendingBodyStartedAt: null,
			}),
		)
	})

	it("caches an audio body and serves byte ranges for playback seeking", async () => {
		const requestUrl = buildVirtualUrl("audios/voice.mp3", "audio")
		const entry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/audio/audios/voice.mp3",
			namespace: "workspace/project/design/demo",
			path: "audios/voice.mp3",
			mediaType: "audio",
			cacheKey: requestUrl,
			sourceUrl: "https://oss.example.com/audios/voice.mp3",
		}
		await saveCanvasEntry(entry)
		const networkBlob = new NodeBlob(["0123456789"], { type: "audio/mpeg" })
		const networkResponse = new Response(networkBlob, {
			status: 200,
			headers: { "Content-Type": "audio/mpeg" },
		})
		Object.defineProperty(networkResponse, "blob", {
			value: vi.fn(async () => networkBlob),
		})
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(networkResponse)
		const rangeResponse = await handleCanvasMediaRequest(
			new Request(requestUrl, { headers: { Range: "bytes=2-5" } }),
		)
		expect(rangeResponse?.status).toBe(206)
		expect(rangeResponse?.headers.get("Content-Range")).toBe("bytes 2-5/10")
		expect(await rangeResponse?.text()).toBe("2345")
		expect(fetchSpy).toHaveBeenCalledTimes(1)

		const invalidRangeResponse = await handleCanvasMediaRequest(
			new Request(requestUrl, { headers: { Range: "bytes=20-30" } }),
		)
		expect(invalidRangeResponse?.status).toBe(416)
	})

	it("finalizes a stale pending body when its CacheStorage token matches", async () => {
		const requestUrl = buildVirtualUrl("images/recover.png")
		const entry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/image/images/recover.png",
			namespace: "workspace/project/design/demo",
			path: "images/recover.png",
			mediaType: "image",
			cacheKey: requestUrl,
			sourceUrl: "https://oss.example.com/images/recover.png",
			lastAccessedAt: Date.now(),
			pendingBodySize: 14,
			pendingBodyStartedAt: Date.now() - 2 * 60 * 60 * 1000,
		}
		entry.pendingBodyToken = buildBodyToken(entry)
		await saveCanvasEntry(entry)
		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		await cache.put(
			requestUrl,
			new Response("recovered-body", {
				headers: { "X-Magic-Canvas-Body-Write-Token": entry.pendingBodyToken },
			}),
		)

		expect(await dispatchCanvasMessage({ type: "CANVAS_MEDIA_CACHE_ENFORCE_LIMIT" })).toBe(true)
		expect(await readCanvasEntry(entry.id)).toEqual(
			expect.objectContaining({
				size: 14,
				pendingBodyToken: null,
				pendingBodySize: null,
				pendingBodyStartedAt: null,
			}),
		)
	})

	it("clears stale pending accounting without deleting the resource mapping", async () => {
		const entry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/image/images/missing-pending.png",
			namespace: "workspace/project/design/demo",
			path: "images/missing-pending.png",
			mediaType: "image",
			sourceUrl: "https://oss.example.com/images/missing-pending.png",
			lastAccessedAt: Date.now(),
			pendingBodySize: 100,
			pendingBodyStartedAt: Date.now() - 2 * 60 * 60 * 1000,
		}
		entry.pendingBodyToken = buildBodyToken(entry)
		await saveCanvasEntry(entry)

		await dispatchCanvasMessage({ type: "CANVAS_MEDIA_CACHE_ENFORCE_LIMIT" })

		expect(await readCanvasEntry(entry.id)).toEqual(
			expect.objectContaining({
				sourceUrl: entry.sourceUrl,
				pendingBodyToken: null,
				pendingBodySize: null,
				pendingBodyStartedAt: null,
			}),
		)
	})

	it("counts fresh pending bodies against the byte budget", async () => {
		const now = Date.now()
		const readyUrl = buildVirtualUrl("images/ready.png")
		const pendingUrl = buildVirtualUrl("images/pending.png")
		const readyEntry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/image/images/ready.png",
			namespace: "workspace/project/design/demo",
			path: "images/ready.png",
			mediaType: "image",
			cacheKey: readyUrl,
			sourceUrl: "https://oss.example.com/images/ready.png",
			lastAccessedAt: now - 1,
			size: 8,
		}
		const pendingEntry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/image/images/pending.png",
			namespace: "workspace/project/design/demo",
			path: "images/pending.png",
			mediaType: "image",
			cacheKey: pendingUrl,
			sourceUrl: "https://oss.example.com/images/pending.png",
			lastAccessedAt: now,
			pendingBodySize: 8,
			pendingBodyStartedAt: Date.now(),
		}
		pendingEntry.pendingBodyToken = buildBodyToken(pendingEntry)
		await saveCanvasEntry(readyEntry)
		await saveCanvasEntry(pendingEntry)
		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		await cache.put(readyUrl, new Response("12345678"))

		await dispatchCanvasMessage({ type: "CANVAS_MEDIA_CACHE_CONFIG", maxBytes: 10 })
		await dispatchCanvasMessage({ type: "CANVAS_MEDIA_CACHE_ENFORCE_LIMIT" })

		expect(await readCanvasEntry(readyEntry.id)).toBeUndefined()
		expect(await cache.match(readyUrl)).toBeUndefined()
		expect(await readCanvasEntry(pendingEntry.id)).toBeDefined()
	})

	it("evicts metadata-only LRU entries before body-backed entries", async () => {
		const now = Date.now()
		const bodyUrl = buildVirtualUrl("images/body.png")
		const bodyEntry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/image/images/body.png",
			namespace: "workspace/project/design/demo",
			path: "images/body.png",
			mediaType: "image",
			cacheKey: bodyUrl,
			sourceUrl: "https://oss.example.com/images/body.png",
			lastAccessedAt: now - 2,
			size: 4,
		}
		const oldestMetadata: StoredCanvasEntry = {
			...bodyEntry,
			id: "workspace/project/design/demo/image/images/metadata-old.png",
			path: "images/metadata-old.png",
			cacheKey: buildVirtualUrl("images/metadata-old.png"),
			size: 0,
			lastAccessedAt: now - 1,
		}
		const newestMetadata: StoredCanvasEntry = {
			...oldestMetadata,
			id: "workspace/project/design/demo/image/images/metadata-new.png",
			path: "images/metadata-new.png",
			cacheKey: buildVirtualUrl("images/metadata-new.png"),
			lastAccessedAt: now,
		}
		await Promise.all([
			saveCanvasEntry(bodyEntry),
			saveCanvasEntry(oldestMetadata),
			saveCanvasEntry(newestMetadata),
		])
		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		await cache.put(bodyUrl, new Response("body"))

		await dispatchCanvasMessage({ type: "CANVAS_MEDIA_CACHE_CONFIG", maxEntries: 2 })
		await dispatchCanvasMessage({ type: "CANVAS_MEDIA_CACHE_ENFORCE_LIMIT" })

		expect(await readCanvasEntry(oldestMetadata.id)).toBeUndefined()
		expect(await readCanvasEntry(bodyEntry.id)).toBeDefined()
		expect(await cache.match(bodyUrl)).toBeDefined()
	})

	it("enforces the metadata serialization budget", async () => {
		const entry: StoredCanvasEntry = {
			id: "workspace/project/design/demo/image/images/metadata-budget.png",
			namespace: "workspace/project/design/demo",
			path: "images/metadata-budget.png",
			mediaType: "image",
			sourceUrl: "https://oss.example.com/images/metadata-budget.png",
			lastAccessedAt: Date.now(),
		}
		await saveCanvasEntry(entry)

		await dispatchCanvasMessage({
			type: "CANVAS_MEDIA_CACHE_CONFIG",
			maxMetadataBytes: 1,
		})
		await dispatchCanvasMessage({ type: "CANVAS_MEDIA_CACHE_ENFORCE_LIMIT" })

		expect(await readCanvasEntry(entry.id)).toBeUndefined()
	})

	it("accepts batched cache-hit touch messages", async () => {
		const waitUntil = vi.fn((promise: Promise<unknown>) => promise)
		const event = {
			data: {
				type: "CANVAS_MEDIA_CACHE_TOUCH_BATCH",
				touches: [],
			},
			waitUntil,
		} as unknown as ExtendableMessageEvent

		expect(handleCanvasMediaMessage(event)).toBe(true)
		expect(waitUntil).toHaveBeenCalledTimes(1)
		await waitUntil.mock.results[0]?.value
	})

	it("updates metadata for a non-empty touch batch and suppresses touches within 24 hours", async () => {
		const id = "workspace/project/design/touch-batch/image/images/touch.png"
		const initialAccess = 0
		const firstTouch = 2 * 24 * 60 * 60 * 1000
		await saveCanvasEntry({
			id,
			namespace: "workspace/project/design/touch-batch",
			path: "images/touch.png",
			mediaType: "image",
			lastAccessedAt: initialAccess,
			updatedAt: initialAccess,
		})

		const dispatchTouch = async (lastAccessedAt: number) => {
			const waitUntil = vi.fn((promise: Promise<unknown>) => promise)
			const event = {
				data: {
					type: "CANVAS_MEDIA_CACHE_TOUCH_BATCH",
					touches: [{ id, lastAccessedAt }],
				},
				waitUntil,
			} as unknown as ExtendableMessageEvent
			expect(handleCanvasMediaMessage(event)).toBe(true)
			await waitUntil.mock.results[0]?.value
		}

		await dispatchTouch(firstTouch)
		expect((await readCanvasEntry(id))?.lastAccessedAt).toBe(firstTouch)

		await dispatchTouch(firstTouch + 60 * 60 * 1000)
		expect((await readCanvasEntry(id))?.lastAccessedAt).toBe(firstTouch)
	})
})
