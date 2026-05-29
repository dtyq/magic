import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	activateWaitingServiceWorkerAndReload,
	markServiceWorkerCacheableResourceUrl,
	registerAppServiceWorker,
} from "../register"

async function flushMicrotasks(times = 4): Promise<void> {
	for (let index = 0; index < times; index += 1) {
		await Promise.resolve()
	}
}

describe("service worker path guards", () => {
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
		vi.stubEnv("MAGIC_SW_MODE", "on")
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
			"https://public-cdn.example.com/workbox/7.4.1/workbox-sw.js",
		)
		expect(resolvedUrl.searchParams.get("vendorCacheHosts")).toBe(
			"public-cdn.example.com,assets.example.com,cdn.jsdelivr.net",
		)
		expect(options).toEqual({ scope: "/" })
	})

	it("still registers in development when force enable flag is true", async () => {
		const register = vi.fn().mockResolvedValue({})
		vi.stubEnv("MAGIC_MOCK", "false")
		vi.stubEnv("MAGIC_FORCE_ENABLE_SW_IN_DEV", "true")

		Object.defineProperty(document, "readyState", {
			configurable: true,
			value: "complete",
		})

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				register,
				getRegistrations: vi.fn().mockResolvedValue([]),
			},
		})

		registerAppServiceWorker()
		await flushMicrotasks()

		expect(register).toHaveBeenCalledTimes(1)
	})

	it("does not register by default and unregisters existing app service workers", async () => {
		const register = vi.fn()
		const unregister = vi.fn().mockResolvedValue(true)
		vi.unstubAllEnvs()
		vi.stubEnv("MAGIC_MOCK", "true")

		Object.defineProperty(document, "readyState", {
			configurable: true,
			value: "complete",
		})

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				register,
				getRegistrations: vi.fn().mockResolvedValue([
					{
						active: {
							scriptURL: `${window.location.origin}/sw.js`,
						},
						waiting: null,
						installing: null,
						unregister,
					},
				]),
			},
		})

		registerAppServiceWorker()
		await flushMicrotasks()

		expect(register).not.toHaveBeenCalled()
		expect(unregister).toHaveBeenCalledTimes(1)
	})

	it("does not register in off mode and unregisters existing app service workers", async () => {
		const register = vi.fn()
		const unregister = vi.fn().mockResolvedValue(true)
		vi.stubEnv("MAGIC_SW_MODE", "off")

		Object.defineProperty(document, "readyState", {
			configurable: true,
			value: "complete",
		})

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				register,
				getRegistrations: vi.fn().mockResolvedValue([
					{
						active: {
							scriptURL: `${window.location.origin}/sw.js`,
						},
						waiting: null,
						installing: null,
						unregister,
					},
				]),
			},
		})

		registerAppServiceWorker()
		await flushMicrotasks()

		expect(register).not.toHaveBeenCalled()
		expect(unregister).toHaveBeenCalledTimes(1)
	})

	it("auto activates waiting worker on browser reload", async () => {
		const postMessage = vi.fn()
		const register = vi.fn().mockResolvedValue({
			waiting: { postMessage },
			addEventListener: vi.fn(),
			installing: null,
		})

		vi.spyOn(window.performance, "getEntriesByType").mockImplementation((entryType: string) => {
			if (entryType === "navigation") {
				return [{ type: "reload" }] as unknown as PerformanceEntry[]
			}
			return []
		})

		Object.defineProperty(document, "readyState", {
			configurable: true,
			value: "complete",
		})

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				register,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
		})

		registerAppServiceWorker()
		await flushMicrotasks()

		expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" })
	})

	it("does not auto activate waiting worker on reload in kill mode", async () => {
		const postMessage = vi.fn()
		const register = vi.fn().mockResolvedValue({
			waiting: { postMessage },
			addEventListener: vi.fn(),
			installing: null,
		})
		vi.stubEnv("MAGIC_SW_MODE", "kill")

		vi.spyOn(window.performance, "getEntriesByType").mockImplementation((entryType: string) => {
			if (entryType === "navigation") {
				return [{ type: "reload" }] as unknown as PerformanceEntry[]
			}
			return []
		})

		Object.defineProperty(document, "readyState", {
			configurable: true,
			value: "complete",
		})

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				register,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
		})

		registerAppServiceWorker()
		await flushMicrotasks()

		expect(postMessage).not.toHaveBeenCalled()
	})

	it("auto activates waiting worker when installing transitions to installed on reload", async () => {
		const postMessage = vi.fn()
		let installingStateChangeHandler: (() => void) | null = null
		const installingWorker = {
			state: "installing",
			addEventListener: vi.fn((eventName: string, callback: () => void) => {
				if (eventName === "statechange") {
					installingStateChangeHandler = callback
				}
			}),
			removeEventListener: vi.fn(),
		} as unknown as ServiceWorker

		const registration = {
			waiting: null,
			installing: installingWorker,
			addEventListener: vi.fn(),
		} as unknown as ServiceWorkerRegistration

		const register = vi.fn().mockResolvedValue(registration)

		vi.spyOn(window.performance, "getEntriesByType").mockImplementation((entryType: string) => {
			if (entryType === "navigation") {
				return [{ type: "reload" }] as unknown as PerformanceEntry[]
			}
			return []
		})

		Object.defineProperty(document, "readyState", {
			configurable: true,
			value: "complete",
		})

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: {
				register,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
		})

		registerAppServiceWorker()
		await flushMicrotasks()

		Object.assign(installingWorker, { state: "installed" })
		Object.assign(registration, { waiting: { postMessage } })
		const stateChangeHandler = installingStateChangeHandler as (() => void) | null
		if (stateChangeHandler) {
			stateChangeHandler()
		}

		expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" })
	})
})
