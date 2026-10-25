import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	MediaResourceOfflineCacheManager,
	type MediaResourceOfflineCacheManagerOptions,
} from "../offline-cache/MediaResourceOfflineCacheManager"
import { createTestResourceReferenceResolver } from "../../../public/__tests__/testResourceReferenceResolver"

const resolveResourceReference = createTestResourceReferenceResolver()

function createOfflineCacheManager(options?: MediaResourceOfflineCacheManagerOptions) {
	return new MediaResourceOfflineCacheManager({
		getResolveResourceReference: () => resolveResourceReference,
		...options,
	})
}

describe("MediaResourceOfflineCacheManager", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		vi.stubEnv("MAGIC_MOCK", "true")
		vi.stubEnv("MAGIC_SW_MODE", "on")

		Object.defineProperty(globalThis, "indexedDB", {
			configurable: true,
			value: new IDBFactory(),
		})
		Object.defineProperty(globalThis, "caches", {
			configurable: true,
			value: {
				delete: vi.fn().mockResolvedValue(true),
				keys: vi.fn().mockResolvedValue([]),
			},
		})
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllEnvs()
	})

	it("uses canonical workspace paths as cache locators without crossing canvas boundaries", () => {
		const manager = createOfflineCacheManager()
		const resolveStoredResourcePath = (
			manager as unknown as {
				resolveStoredResourcePath: (path: string) => string | undefined
			}
		).resolveStoredResourcePath.bind(manager)

		expect(resolveStoredResourcePath("./images/x.png")).toBe("/画布A/images/x.png")
		expect(resolveStoredResourcePath("/画布A/images/x.png")).toBe("/画布A/images/x.png")
		expect(resolveStoredResourcePath("/images/x.png")).toBe("/images/x.png")
		expect(resolveStoredResourcePath("/画布B/images/x.png")).toBe("/画布B/images/x.png")
	})

	it("fails closed before cache lookup when a resource reference is unresolved", () => {
		const ambiguousResolver = createTestResourceReferenceResolver({
			attachmentPathsByFileId: {
				"file-current": "/画布A/images/x.png",
				"file-root": "/images/x.png",
			},
		})
		const manager = createOfflineCacheManager({
			getResolveResourceReference: () => ambiguousResolver,
		})
		const resolveStoredResourcePath = (
			manager as unknown as {
				resolveStoredResourcePath: (path: string) => string | undefined
			}
		).resolveStoredResourcePath.bind(manager)

		expect(resolveStoredResourcePath("images/x.png")).toBeUndefined()
		expect(
			(
				new MediaResourceOfflineCacheManager() as unknown as {
					resolveStoredResourcePath: (path: string) => string | undefined
				}
			).resolveStoredResourcePath("./images/x.png"),
		).toBeUndefined()
	})

	it("keeps asset URLs out of workspace and persistent media caches", async () => {
		const manager = createOfflineCacheManager()
		const resolveStoredResourcePath = (
			manager as unknown as {
				resolveStoredResourcePath: (path: string) => string | undefined
			}
		).resolveStoredResourcePath.bind(manager)

		expect(resolveStoredResourcePath("asset://asset-1")).toBeUndefined()
		await expect(
			manager.rememberResolvedResource({
				path: "asset://asset-1",
				url: "https://assets.test/signed.png",
				mediaType: "image",
			}),
		).resolves.toBeNull()
		await expect(
			manager.resolveResourceUrl({
				path: "asset://asset-1",
				url: "https://assets.test/signed.png",
				mediaType: "image",
			}),
		).resolves.toBe("https://assets.test/signed.png")
		await expect(manager.getCachedResource("asset://asset-1", "image")).resolves.toBeNull()
	})

	it("reuses the current app service worker and does not send duplicate metadata to it", async () => {
		const register = vi.fn()
		const postMessage = vi.fn()
		const controller = {
			scriptURL: `${window.location.origin}/sw.js`,
			postMessage,
		} as unknown as ServiceWorker
		const registration = {
			active: controller,
			scope: "/",
		} as unknown as ServiceWorkerRegistration

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				controller,
				ready: Promise.resolve(registration),
				register,
				getRegistrations: vi.fn().mockResolvedValue([registration]),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
		})

		const manager = createOfflineCacheManager({
			getVirtualResourceScope: () => "workspace/project/design/demo",
		})

		;(manager as unknown as { saveEntry: (entry: unknown) => Promise<void> }).saveEntry = vi
			.fn()
			.mockResolvedValue(undefined)
		;(
			manager as unknown as {
				getEntry: (path: string, mediaType: "image" | "video") => Promise<null>
			}
		).getEntry = vi.fn().mockResolvedValue(null)

		const result = await manager.rememberResolvedResource({
			path: "./images/example.png",
			url: "https://oss.example.com/images/example.png",
			mediaType: "image",
		})

		expect(register).not.toHaveBeenCalled()
		expect(postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "CANVAS_MEDIA_CACHE_REGISTER" }),
		)
		expect(result?.url).toContain("/sw/canvas-design-media/")
	})

	it("encodes URL delimiters in virtual resource paths", async () => {
		const postMessage = vi.fn()
		const controller = {
			scriptURL: `${window.location.origin}/sw.js`,
			postMessage,
		} as unknown as ServiceWorker
		const registration = {
			active: controller,
			scope: "/",
		} as unknown as ServiceWorkerRegistration

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				controller,
				ready: Promise.resolve(registration),
				register: vi.fn(),
				getRegistrations: vi.fn().mockResolvedValue([registration]),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
		})

		const manager = createOfflineCacheManager({
			getVirtualResourceScope: () => "workspace/project/design/demo#1",
		})
		;(manager as unknown as { saveEntry: (entry: unknown) => Promise<void> }).saveEntry = vi
			.fn()
			.mockResolvedValue(undefined)
		;(manager as unknown as { getEntry: () => Promise<null> }).getEntry = vi
			.fn()
			.mockResolvedValue(null)

		const result = await manager.rememberResolvedResource({
			path: "./images/真丝系列#13 娃娃领?x%25.png",
			url: "https://oss.example.com/images/source.png",
			mediaType: "image",
		})

		expect(result?.url).toContain("%2313%20")
		expect(result?.url).toContain("%3Fx%2525.png")
		expect(result?.url).toContain("demo%231/image/")
		expect(new URL(result?.url ?? "").hash).toBe("")
		expect(new URL(result?.url ?? "").search).toBe("")
	})

	it("batches metadata in one transaction and keeps the last value for the same resource", async () => {
		const postMessage = vi.fn()
		const controller = { postMessage } as unknown as ServiceWorker
		const registration = { active: controller } as unknown as ServiceWorkerRegistration
		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				controller,
				ready: Promise.resolve(registration),
			},
		})
		const manager = createOfflineCacheManager({
			getVirtualResourceScope: () => "workspace/project/design/demo",
		})
		const db = await (manager as unknown as { openDb: () => Promise<IDBDatabase> }).openDb()
		const transactionSpy = vi.spyOn(db, "transaction")

		await Promise.all([
			manager.rememberResolvedResource({
				path: "./images/example.png",
				url: "https://oss.example.com/images/example-v1.png",
				mediaType: "image",
				resourceVersion: "v1",
			}),
			manager.rememberResolvedResource({
				path: "./images/example.png",
				url: "https://oss.example.com/images/example-v2.png",
				mediaType: "image",
				resourceVersion: "v2",
			}),
			manager.rememberResolvedResource({
				path: "./images/other.png",
				url: "https://oss.example.com/images/other.png",
				mediaType: "image",
			}),
		])

		const writeTransactions = transactionSpy.mock.calls.filter(
			([, mode]) => mode === "readwrite",
		)
		expect(writeTransactions).toHaveLength(1)
		const transaction = db.transaction("resources", "readonly")
		const request = transaction.objectStore("resources").getAll()
		const records = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
			request.onsuccess = () => resolve(request.result as Array<Record<string, unknown>>)
			request.onerror = () => reject(request.error)
		})
		expect(records).toHaveLength(2)
		expect(records).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					sourceUrl: "https://oss.example.com/images/example-v2.png",
					resourceVersion: "v2",
				}),
			]),
		)
		expect(records[0]).not.toHaveProperty("url")
		expect(records[0]).not.toHaveProperty("cacheKey")
		expect(records[0]).not.toHaveProperty("updatedAt")
		expect(postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "CANVAS_MEDIA_CACHE_REGISTER" }),
		)
	})

	it("deduplicates CONFIG per worker and coalesces trailing maintenance", async () => {
		const postMessage = vi.fn()
		const controller = { postMessage } as unknown as ServiceWorker
		const registration = { active: controller } as unknown as ServiceWorkerRegistration
		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				controller,
				ready: Promise.resolve(registration),
			},
		})
		const first = createOfflineCacheManager()
		const second = createOfflineCacheManager()

		await Promise.all([
			first.rememberResolvedResource({
				path: "./images/first.png",
				url: "https://oss.example.com/images/first.png",
				mediaType: "image",
			}),
			second.rememberResolvedResource({
				path: "./images/second.png",
				url: "https://oss.example.com/images/second.png",
				mediaType: "image",
			}),
		])
		expect(
			postMessage.mock.calls.filter(
				([message]) => message.type === "CANVAS_MEDIA_CACHE_CONFIG",
			),
		).toHaveLength(1)
		expect(
			postMessage.mock.calls.filter(
				([message]) => message.type === "CANVAS_MEDIA_CACHE_ENFORCE_LIMIT",
			),
		).toHaveLength(0)
		await vi.waitFor(
			() => {
				expect(
					postMessage.mock.calls.filter(
						([message]) => message.type === "CANVAS_MEDIA_CACHE_ENFORCE_LIMIT",
					),
				).toHaveLength(1)
			},
			{ timeout: 2000 },
		)
	})

	it("falls back to the source url when app service worker mode is disabled", async () => {
		vi.stubEnv("MAGIC_SW_MODE", "off")
		const register = vi.fn()
		const postMessage = vi.fn()
		const controller = {
			scriptURL: `${window.location.origin}/sw.js`,
			postMessage,
		} as unknown as ServiceWorker
		const registration = {
			active: controller,
			scope: "/",
		} as unknown as ServiceWorkerRegistration

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				controller,
				ready: Promise.resolve(registration),
				register,
				getRegistrations: vi.fn().mockResolvedValue([registration]),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
		})

		const manager = createOfflineCacheManager({
			getVirtualResourceScope: () => "workspace/project/design/demo",
		})

		const sourceUrl = "https://oss.example.com/images/example.png"
		const result = await manager.resolveResourceUrl({
			path: "./images/example.png",
			url: sourceUrl,
			mediaType: "image",
		})

		expect(result).toBe(sourceUrl)
		expect(postMessage).not.toHaveBeenCalled()
	})

	it("does not reuse old virtual cache entries when app service worker mode is disabled", async () => {
		vi.stubEnv("MAGIC_SW_MODE", "off")
		const postMessage = vi.fn()
		const controller = {
			scriptURL: `${window.location.origin}/sw.js`,
			postMessage,
		} as unknown as ServiceWorker

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				controller,
				ready: Promise.resolve({
					active: controller,
					scope: "/",
				} as unknown as ServiceWorkerRegistration),
				register: vi.fn(),
				getRegistrations: vi.fn().mockResolvedValue([]),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
		})

		const openCache = vi.fn()
		Object.defineProperty(globalThis, "caches", {
			configurable: true,
			value: {
				delete: vi.fn().mockResolvedValue(true),
				keys: vi.fn().mockResolvedValue([]),
				open: openCache,
			},
		})

		const manager = createOfflineCacheManager({
			getVirtualResourceScope: () => "workspace/project/design/demo",
		})
		const result = await manager.getCachedResource("./images/example.png", "image")

		expect(result).toBeNull()
		expect(openCache).not.toHaveBeenCalled()
		expect(postMessage).not.toHaveBeenCalled()
	})

	it("returns the source url on resolve and only registers offline metadata in background", async () => {
		const postMessage = vi.fn()
		const controller = {
			scriptURL: `${window.location.origin}/sw.js`,
			postMessage,
		} as unknown as ServiceWorker
		const registration = {
			active: controller,
			scope: "/",
		} as unknown as ServiceWorkerRegistration

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				controller,
				ready: Promise.resolve(registration),
				register: vi.fn(),
				getRegistrations: vi.fn().mockResolvedValue([registration]),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
		})

		const manager = createOfflineCacheManager({
			getVirtualResourceScope: () => "workspace/project/design/demo",
		})
		;(manager as unknown as { saveEntry: (entry: unknown) => Promise<void> }).saveEntry = vi
			.fn()
			.mockResolvedValue(undefined)
		;(
			manager as unknown as {
				getEntry: (path: string, mediaType: "image" | "video") => Promise<null>
			}
		).getEntry = vi.fn().mockResolvedValue(null)
		const sourceUrl = "https://oss.example.com/images/example.png"
		const result = await manager.resolveResourceUrl({
			path: "./images/example.png",
			url: sourceUrl,
			mediaType: "image",
		})

		expect(result).toBe(sourceUrl)
		await vi.waitFor(() => {
			expect(manager.getSnapshot()).toEqual(
				expect.objectContaining({
					resolveDirectCount: 1,
					backgroundRegisterQueuedCount: 1,
					backgroundRegisterCompletedCount: 1,
				}),
			)
		})
		expect(postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "CANVAS_MEDIA_CACHE_REGISTER" }),
		)
	})

	it("batches cache-hit access touch after the writeback interval", async () => {
		vi.useFakeTimers()
		try {
			const manager = createOfflineCacheManager({
				getVirtualResourceScope: () => "workspace/project/design/demo",
			})
			const entry = {
				namespace: "workspace/project/design/demo",
				path: "/画布A/images/example.png",
				url: "https://canvas.test/sw/canvas-design-media/workspace/project/design/demo/image/design-resource/画布A/images/example.png",
				cacheKey: "cache-key",
				mediaType: "image" as const,
				lastAccessedAt: 0,
				updatedAt: 0,
			}
			;(
				manager as unknown as { canUseServiceWorkerCache: () => boolean }
			).canUseServiceWorkerCache = () => true
			;(manager as unknown as { getEntry: () => Promise<typeof entry> }).getEntry = vi
				.fn()
				.mockResolvedValue(entry)
			const postMessage = vi.fn().mockResolvedValue(undefined)
			;(
				manager as unknown as {
					postMessageToServiceWorker: (message: unknown) => Promise<void>
				}
			).postMessageToServiceWorker = postMessage
			Object.defineProperty(globalThis, "caches", {
				configurable: true,
				value: {
					open: vi.fn().mockResolvedValue({
						match: vi.fn().mockResolvedValue(new Response("cached")),
					}),
				},
			})

			await Promise.all([
				manager.getCachedResource("./images/example.png", "image"),
				manager.getCachedResource("./images/example.png", "image"),
			])
			expect(postMessage).not.toHaveBeenCalled()
			await vi.advanceTimersByTimeAsync(1000)
			await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1))
			expect(postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "CANVAS_MEDIA_CACHE_TOUCH_BATCH",
				}),
			)
			manager.destroy()
		} finally {
			vi.useRealTimers()
		}
	})

	it("falls back to the source url when service worker ready does not settle", async () => {
		vi.useFakeTimers()
		const ready = new Promise<ServiceWorkerRegistration>(() => undefined)
		const registration = {
			active: {
				scriptURL: `${window.location.origin}/sw.js`,
				postMessage: vi.fn(),
			},
			scope: "/",
		} as unknown as ServiceWorkerRegistration

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				controller: null,
				ready,
				register: vi.fn(),
				getRegistrations: vi.fn().mockResolvedValue([registration]),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
		})

		const manager = createOfflineCacheManager({
			getVirtualResourceScope: () => "workspace/project/design/demo",
		})
		const saveEntry = vi.fn().mockResolvedValue(undefined)
		;(manager as unknown as { saveEntry: (entry: unknown) => Promise<void> }).saveEntry =
			saveEntry

		const sourceUrl = "https://oss.example.com/images/example.png"
		const resultPromise = manager.resolveResourceUrl({
			path: "./images/example.png",
			url: sourceUrl,
			mediaType: "image",
		})

		await vi.advanceTimersByTimeAsync(2000)

		await expect(resultPromise).resolves.toBe(sourceUrl)
		expect(saveEntry).not.toHaveBeenCalled()
	})

	it("falls back to the source url when the page is not controlled by service worker", async () => {
		const postMessage = vi.fn()
		const active = {
			scriptURL: `${window.location.origin}/sw.js`,
			postMessage,
		} as unknown as ServiceWorker
		const registration = {
			active,
			scope: "/",
		} as unknown as ServiceWorkerRegistration

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				controller: null,
				ready: Promise.resolve(registration),
				register: vi.fn(),
				getRegistrations: vi.fn().mockResolvedValue([registration]),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
		})

		const manager = createOfflineCacheManager({
			getVirtualResourceScope: () => "workspace/project/design/demo",
		})
		const saveEntry = vi.fn().mockResolvedValue(undefined)
		;(manager as unknown as { saveEntry: (entry: unknown) => Promise<void> }).saveEntry =
			saveEntry

		const sourceUrl = "https://oss.example.com/images/example.png"
		const result = await manager.resolveResourceUrl({
			path: "./images/example.png",
			url: sourceUrl,
			mediaType: "image",
		})

		expect(result).toBe(sourceUrl)
		expect(saveEntry).not.toHaveBeenCalled()
		expect(postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: "CANVAS_MEDIA_CACHE_REGISTER",
			}),
		)
	})
})
