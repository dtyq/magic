import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	activateWaitingServiceWorkerAndReload,
	isCanvasMediaPath,
	markServiceWorkerCacheableResourceUrl,
	registerAppServiceWorker,
} from "../register"

async function flushMicrotasks(times = 4): Promise<void> {
	for (let index = 0; index < times; index += 1) {
		await Promise.resolve()
	}
}

describe("service worker path guards", () => {
	it("skips canvas media virtual resources", () => {
		expect(isCanvasMediaPath("/canvas-design-media/image/a")).toBe(true)
		expect(isCanvasMediaPath("/api/user")).toBe(false)
	})

	it("marks explicit cacheable resources with sw cache query", () => {
		expect(markServiceWorkerCacheableResourceUrl("/dotlottie/dotlottie-player.wasm")).toBe(
			"/dotlottie/dotlottie-player.wasm?swCache=runtime",
		)
		expect(
			markServiceWorkerCacheableResourceUrl("/dotlottie/dotlottie-player.wasm", "build-123"),
		).toBe("/dotlottie/dotlottie-player.wasm?swCache=runtime&swv=build-123")
	})
})

describe("activateWaitingServiceWorkerAndReload", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it("posts SKIP_WAITING and reloads after controllerchange", async () => {
		const postMessage = vi.fn()
		const reload = vi.fn()
		const removeEventListener = vi.fn()
		let controllerChangeHandler: (() => void) | null = null

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				addEventListener: vi.fn((eventName: string, callback: () => void) => {
					if (eventName === "controllerchange") {
						controllerChangeHandler = callback
					}
				}),
				removeEventListener,
			},
		})

		const registration = {
			waiting: { postMessage },
		} as unknown as ServiceWorkerRegistration

		const activationPromise = activateWaitingServiceWorkerAndReload(registration, reload)
		const handler = controllerChangeHandler as (() => void) | null
		if (handler) {
			handler()
		}
		await activationPromise

		expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" })
		expect(removeEventListener).toHaveBeenCalledWith("controllerchange", expect.any(Function))
		expect(reload).toHaveBeenCalledTimes(1)
	})
})

describe("registerAppServiceWorker", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		vi.stubEnv("MAGIC_MOCK", "true")
	})

	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it("passes workbox cdn url and vendor cache hosts in registration url", async () => {
		const register = vi.fn().mockResolvedValue({})

		Object.defineProperty(window, "CONFIG", {
			configurable: true,
			value: {
				MAGIC_CDNHOST: "https://public-cdn.example.com",
				MAGIC_PUBLIC_CDN_URL: "https://assets.example.com/static",
			},
		})

		Object.defineProperty(document, "readyState", {
			configurable: true,
			value: "complete",
		})

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				register,
			},
		})

		registerAppServiceWorker()
		await flushMicrotasks()

		expect(register).toHaveBeenCalledTimes(1)

		const [serviceWorkerUrl, options] = register.mock.calls[0]
		const resolvedUrl = new URL(serviceWorkerUrl as string, window.location.origin)

		expect(resolvedUrl.pathname).toBe("/sw.js")
		expect(resolvedUrl.searchParams.get("workboxCdnUrl")).toBe(
			"https://cdn.jsdelivr.net/npm/workbox-sw@7.4.1/build/workbox-sw.js",
		)
		expect(resolvedUrl.searchParams.get("vendorCacheHosts")).toBe(
			"public-cdn.example.com,assets.example.com,cdn.jsdelivr.net",
		)
		expect(options).toEqual({ scope: "/" })
	})
})
