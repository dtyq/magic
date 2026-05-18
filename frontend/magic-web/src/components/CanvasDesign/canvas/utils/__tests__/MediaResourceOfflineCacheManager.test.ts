import { beforeEach, describe, expect, it, vi } from "vitest"
import { MediaResourceOfflineCacheManager } from "../MediaResourceOfflineCacheManager"

describe("MediaResourceOfflineCacheManager", () => {
	beforeEach(() => {
		vi.restoreAllMocks()

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

		;(manager as unknown as { saveEntry: (entry: unknown) => Promise<void> }).saveEntry =
			vi.fn().mockResolvedValue(undefined)
		;(manager as unknown as {
			getEntry: (
				path: string,
				mediaType: "image" | "video",
			) => Promise<null>
		}).getEntry = vi.fn().mockResolvedValue(null)

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
})
