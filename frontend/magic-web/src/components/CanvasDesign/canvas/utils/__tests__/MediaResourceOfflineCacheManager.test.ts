import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MediaResourceOfflineCacheManager } from "../MediaResourceOfflineCacheManager"

describe("MediaResourceOfflineCacheManager", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		vi.stubEnv("MAGIC_MOCK", "true")
		vi.stubEnv("MAGIC_SW_MODE", "on")

		Object.defineProperty(globalThis, "indexedDB", {
			configurable: true,
			value: {},
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

	it("reuses the current app service worker registration without registering canvas sw", async () => {
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

		const manager = new MediaResourceOfflineCacheManager({
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
			path: "images/example.png",
			url: "https://oss.example.com/images/example.png",
			mediaType: "image",
		})

		expect(register).not.toHaveBeenCalled()
		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "CANVAS_MEDIA_CACHE_REGISTER",
			}),
		)
		expect(result?.url).toContain("/sw/canvas-design-media/")
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

		const manager = new MediaResourceOfflineCacheManager({
			getVirtualResourceScope: () => "workspace/project/design/demo",
		})

		const sourceUrl = "https://oss.example.com/images/example.png"
		const result = await manager.resolveResourceUrl({
			path: "images/example.png",
			url: sourceUrl,
			mediaType: "image",
		})

		expect(result).toBe(sourceUrl)
		expect(postMessage).not.toHaveBeenCalled()
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

		const manager = new MediaResourceOfflineCacheManager({
			getVirtualResourceScope: () => "workspace/project/design/demo",
		})
		const saveEntry = vi.fn().mockResolvedValue(undefined)
		;(manager as unknown as { saveEntry: (entry: unknown) => Promise<void> }).saveEntry =
			saveEntry

		const sourceUrl = "https://oss.example.com/images/example.png"
		const resultPromise = manager.resolveResourceUrl({
			path: "images/example.png",
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

		const manager = new MediaResourceOfflineCacheManager({
			getVirtualResourceScope: () => "workspace/project/design/demo",
		})
		const saveEntry = vi.fn().mockResolvedValue(undefined)
		;(manager as unknown as { saveEntry: (entry: unknown) => Promise<void> }).saveEntry =
			saveEntry

		const sourceUrl = "https://oss.example.com/images/example.png"
		const result = await manager.resolveResourceUrl({
			path: "images/example.png",
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
