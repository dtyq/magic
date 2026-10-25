import { beforeEach, describe, expect, it, vi } from "vitest"
import { bindServiceWorkerEvents } from "../sw-runtime"

const mocks = vi.hoisted(() => ({
	cleanupLegacyCanvasMediaStorage: vi.fn().mockResolvedValue(undefined),
	cleanupExpiredCanvasMediaStorage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../canvasMediaShared", () => ({
	cleanupLegacyCanvasMediaStorage: mocks.cleanupLegacyCanvasMediaStorage,
	cleanupExpiredCanvasMediaStorage: mocks.cleanupExpiredCanvasMediaStorage,
	handleCanvasMediaMessage: vi.fn(),
	handleCanvasMediaRequest: vi.fn(),
}))

vi.mock("../cache-runtime", () => ({
	enforceAppStaticExpirationAfterPrecache: vi.fn(),
	precacheStaticAssetsOnInstall: vi.fn(),
	warmUpStaticAssetsOnIdle: vi.fn(),
}))

vi.mock("../sw-constants", () => ({
	CANVAS_MEDIA_SCOPE_PREFIX: "/sw/canvas-design-media/",
	getManagedCacheNamePrefix: () => "magic-web-",
	MANAGED_APP_CACHE_NAMES: [],
}))

vi.mock("../warmup-tuning", () => ({
	normalizeWarmUpOptions: vi.fn(() => ({ batchSize: 1, intervalMs: 0 })),
}))

describe("service worker canvas media activation", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		Object.defineProperty(globalThis, "caches", {
			configurable: true,
			value: {
				keys: vi.fn().mockResolvedValue([]),
				delete: vi.fn().mockResolvedValue(true),
			},
		})
	})

	it("removes legacy template image buckets during activation", async () => {
		const listeners = new Map<string, (event: ExtendableEvent) => void>()
		const sw = {
			clients: { claim: vi.fn().mockResolvedValue(undefined) },
			addEventListener: vi.fn((type: string, handler: (event: ExtendableEvent) => void) => {
				listeners.set(type, handler)
			}),
		} as unknown as ServiceWorkerGlobalScope
		const cacheKeys = [
			"magic-web-slides-template-image-assets-v1",
			"magic-web-featured-slides-template-image-assets-v1",
		]
		vi.mocked(caches.keys).mockResolvedValue(cacheKeys)

		bindServiceWorkerEvents(sw, { cacheRegistration: null })
		const waitUntil = vi.fn()
		listeners.get("activate")?.({ waitUntil } as unknown as ExtendableEvent)
		await (waitUntil.mock.calls[0]?.[0] as Promise<void>)

		expect(caches.delete).toHaveBeenCalledWith(cacheKeys[0])
		expect(caches.delete).toHaveBeenCalledWith(cacheKeys[1])
	})

	it("runs legacy Canvas media cleanup during activate", async () => {
		const listeners = new Map<string, (event: ExtendableEvent) => void>()
		const sw = {
			clients: { claim: vi.fn().mockResolvedValue(undefined) },
			addEventListener: vi.fn((type: string, handler: (event: ExtendableEvent) => void) => {
				listeners.set(type, handler)
			}),
		} as unknown as ServiceWorkerGlobalScope
		bindServiceWorkerEvents(sw, { cacheRegistration: null })

		const waitUntil = vi.fn()
		listeners.get("activate")?.({ waitUntil } as unknown as ExtendableEvent)
		const activation = waitUntil.mock.calls[0]?.[0] as Promise<void>
		await activation

		expect(mocks.cleanupLegacyCanvasMediaStorage).toHaveBeenCalledTimes(1)
		expect(mocks.cleanupExpiredCanvasMediaStorage).toHaveBeenCalledTimes(1)
	})
})
