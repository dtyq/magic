import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	CANVAS_MEDIA_CACHE_NAME,
	handleCanvasMediaMessage,
	handleCanvasMediaRequest,
	parseVirtualResourceRequest,
} from "../canvasMediaShared"

type StoredCanvasEntry = {
	id: string
	namespace: string
	path: string
	mediaType: "image" | "video"
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
}

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
	public constructor(private readonly records: Map<string, StoredCanvasEntry>) {}

	public get(key: string): IDBRequest<StoredCanvasEntry | undefined> {
		const request = new FakeIdbRequest<StoredCanvasEntry | undefined>()
		request.succeed(this.records.get(key))
		return request as unknown as IDBRequest<StoredCanvasEntry | undefined>
	}

	public put(value: StoredCanvasEntry): IDBRequest<StoredCanvasEntry> {
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

class FakeDatabase {
	private readonly stores = new Map<string, Map<string, StoredCanvasEntry>>()

	public objectStoreNames = {
		contains: (name: string) => this.stores.has(name),
	}

	public createObjectStore(name: string): FakeObjectStore {
		const store = new Map<string, StoredCanvasEntry>()
		this.stores.set(name, store)
		return new FakeObjectStore(store)
	}

	public transaction(name: string): { objectStore: (storeName: string) => FakeObjectStore } {
		if (!this.stores.has(name)) {
			this.stores.set(name, new Map<string, StoredCanvasEntry>())
		}
		return {
			objectStore: (storeName: string) => {
				const store = this.stores.get(storeName)
				if (!store) {
					throw new Error(`Missing object store: ${storeName}`)
				}
				return new FakeObjectStore(store)
			},
		}
	}
}

class FakeIndexedDbFactory {
	private readonly databases = new Map<string, FakeDatabase>()

	public open(name: string): IDBOpenDBRequest {
		const request = new FakeIdbRequest<IDBDatabase>() as unknown as IDBOpenDBRequest
		queueMicrotask(() => {
			let db = this.databases.get(name)
			const isNew = !db
			if (!db) {
				db = new FakeDatabase()
				this.databases.set(name, db)
			}
			;(request as unknown as FakeIdbRequest<IDBDatabase>).result = db as unknown as IDBDatabase
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

function buildVirtualUrl(path: string): string {
	return `${window.location.origin}/sw/canvas-design-media/workspace/project/design/demo/image/design-resource/${path}`
}

async function saveCanvasEntry(entry: StoredCanvasEntry): Promise<void> {
	const openRequest = indexedDB.open("canvas-media-resource-offline-cache-v1", 1)
	const db = await new Promise<IDBDatabase>((resolve) => {
		openRequest.onsuccess = () => resolve(openRequest.result)
	})
	const store = db.transaction("resources", "readwrite").objectStore("resources")
	await new Promise<void>((resolve) => {
		const request = store.put(entry)
		request.onsuccess = () => resolve()
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
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("parses canvas virtual urls with unicode paths", () => {
		const result = parseVirtualResourceRequest(
			`${window.location.origin}/sw/canvas-design-media/workspace/project/design/demo/image/design-resource/%E6%B5%8B%E8%AF%95%E7%94%BB%E5%B8%83/images/%E7%8C%AB.jpg`,
		)

		expect(result).toEqual({
			namespace: "workspace/project/design/demo",
			mediaType: "image",
			resourcePath: "测试画布/images/猫.jpg",
		})
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
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("network-image", {
				status: 200,
				headers: { "Content-Type": "image/png", ETag: "etag-1" },
			}),
		)

		const response = await handleCanvasMediaRequest(new Request(requestUrl))
		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		const cachedResponse = await cache.match(requestUrl)

		expect(fetchSpy).toHaveBeenCalledWith("https://oss.example.com/images/example.png", {
			cache: "default",
		})
		expect(await response?.text()).toBe("network-image")
		expect(await cachedResponse?.text()).toBe("network-image")
	})

	it("handles cache register message and writes resource metadata", async () => {
		const waitUntil = vi.fn((promise: Promise<unknown>) => promise)
		const event = {
			data: {
				type: "CANVAS_MEDIA_CACHE_REGISTER",
				entry: {
					namespace: "workspace/project/design/demo",
					path: "images/example.png",
					mediaType: "image",
					sourceUrl: "https://oss.example.com/images/example.png",
				},
			},
			waitUntil,
		} as unknown as ExtendableMessageEvent

		const handled = handleCanvasMediaMessage(event)
		await Promise.resolve()
		await Promise.resolve()

		expect(handled).toBe(true)
		expect(waitUntil).toHaveBeenCalledTimes(1)
	})
})
