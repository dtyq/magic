import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const devicesState = vi.hoisted(() => ({
	isMobile: false,
}))

vi.mock("@/utils/devices", () => ({
	get isMobile() {
		return devicesState.isMobile
	},
}))

import {
	activateWaitingServiceWorkerAndReload,
	isAppServiceWorkerFeatureEnabled,
	markServiceWorkerCacheableResourceUrl,
	registerAppServiceWorker,
} from "../register"

async function flushMicrotasks(times = 4): Promise<void> {
	for (let index = 0; index < times; index += 1) {
		await Promise.resolve()
	}
}

interface WarmUpTestEnv {
	register: ReturnType<typeof vi.fn>
	postMessage: ReturnType<typeof vi.fn>
	fetchMock: ReturnType<typeof vi.fn>
}

interface WarmUpTestEnvOptions {
	hardwareConcurrency?: number
	saveData?: boolean
	assets?: string[]
}

/** Sets up SW registration with an active controller and immediate idle callback for warmup tests. */
function setupWarmUpTestEnv(options: WarmUpTestEnvOptions = {}): WarmUpTestEnv {
	const {
		hardwareConcurrency = 8,
		saveData = false,
		assets = ["/assets/sample-a1b2c3.js"],
	} = options
	const postMessage = vi.fn()
	const worker = { postMessage } as unknown as ServiceWorker
	const fetchMock = vi.fn().mockResolvedValue({
		ok: true,
		json: async () => assets,
	})

	vi.stubGlobal("fetch", fetchMock)

	Object.defineProperty(window, "requestIdleCallback", {
		configurable: true,
		value: (callback: IdleRequestCallback) => {
			callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline)
			return 1
		},
	})

	Object.defineProperty(document, "readyState", {
		configurable: true,
		value: "complete",
	})

	const register = vi.fn().mockResolvedValue({})

	Object.defineProperty(navigator, "hardwareConcurrency", {
		configurable: true,
		value: hardwareConcurrency,
	})

	Object.defineProperty(navigator, "connection", {
		configurable: true,
		value: { saveData },
	})

	Object.defineProperty(navigator, "serviceWorker", {
		configurable: true,
		value: {
			register,
			controller: worker,
			ready: Promise.resolve({ active: worker }),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		},
	})

	return { register, postMessage, fetchMock }
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
		window.sessionStorage.clear()
		devicesState.isMobile = false
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
		expect(resolvedUrl.searchParams.get("swDiagnostics")).toBe("0")
		expect(resolvedUrl.searchParams.get("swDiagCacheStartMs")).toBe("100")
		expect(resolvedUrl.searchParams.get("swDiagCacheMatchMs")).toBe("100")
		expect(resolvedUrl.searchParams.get("swDiagTotalMs")).toBe("300")
		expect(options).toEqual({ scope: "/" })
	})

	it("reports the registration URL when Service Worker registration fails", async () => {
		const register = vi.fn().mockRejectedValue(new Error("registration failed"))
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

		Object.defineProperty(document, "readyState", {
			configurable: true,
			value: "complete",
		})

		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: { register },
		})

		registerAppServiceWorker()
		await flushMicrotasks()

		expect(consoleError).toHaveBeenCalledWith(
			"[sw] Failed to register app service worker",
			expect.objectContaining({
				error: expect.any(Error),
				serviceWorkerUrl: expect.stringContaining("/sw.js?"),
			}),
		)
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

	it("enables app service worker features only in normal on mode", () => {
		vi.stubEnv("MAGIC_SW_MODE", "on")
		expect(isAppServiceWorkerFeatureEnabled()).toBe(true)

		vi.stubEnv("MAGIC_SW_MODE", "kill")
		expect(isAppServiceWorkerFeatureEnabled()).toBe(false)

		vi.stubEnv("MAGIC_SW_MODE", "off")
		expect(isAppServiceWorkerFeatureEnabled()).toBe(false)

		vi.stubEnv("MAGIC_SW_MODE", "none")
		expect(isAppServiceWorkerFeatureEnabled()).toBe(false)
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

	it("does not auto activate waiting worker again within the reload cooldown", async () => {
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
		registerAppServiceWorker()
		await flushMicrotasks()

		expect(postMessage).toHaveBeenCalledTimes(1)
	})

	it("allows auto activation again after the reload cooldown expires", async () => {
		const postMessage = vi.fn()
		const register = vi.fn().mockResolvedValue({
			waiting: { postMessage },
			addEventListener: vi.fn(),
			installing: null,
		})
		const dateNow = vi.spyOn(Date, "now").mockReturnValue(1_000)

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

		dateNow.mockReturnValue(61_001)
		registerAppServiceWorker()
		await flushMicrotasks()

		expect(postMessage).toHaveBeenCalledTimes(2)
	})

	it("keeps auto activation safe when session storage is unavailable", async () => {
		const postMessage = vi.fn()
		const register = vi.fn().mockResolvedValue({
			waiting: { postMessage },
			addEventListener: vi.fn(),
			installing: null,
		})

		vi.spyOn(window.sessionStorage, "getItem").mockImplementation(() => {
			throw new Error("storage unavailable")
		})
		vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
			throw new Error("storage unavailable")
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

		expect(() => registerAppServiceWorker()).not.toThrow()
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

	it("skips static asset warmup on mobile devices", async () => {
		devicesState.isMobile = true
		const { register, postMessage, fetchMock } = setupWarmUpTestEnv()

		registerAppServiceWorker()
		await flushMicrotasks(8)

		expect(register).toHaveBeenCalledTimes(1)
		expect(fetchMock).not.toHaveBeenCalled()
		expect(postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "START_WARMUP" }),
		)
	})

	it("skips static asset warmup when save-data mode is enabled", async () => {
		devicesState.isMobile = false
		const { register, postMessage, fetchMock } = setupWarmUpTestEnv({ saveData: true })

		registerAppServiceWorker()
		await flushMicrotasks(8)

		expect(register).toHaveBeenCalledTimes(1)
		expect(fetchMock).not.toHaveBeenCalled()
		expect(postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "START_WARMUP" }),
		)
	})

	it("warms up static assets on desktop after idle", async () => {
		devicesState.isMobile = false
		const { register, postMessage, fetchMock } = setupWarmUpTestEnv()

		registerAppServiceWorker()
		await flushMicrotasks(8)

		expect(register).toHaveBeenCalledTimes(1)
		expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/warmup-assets.json"))
		expect(postMessage).toHaveBeenCalledWith({
			type: "START_WARMUP",
			assets: ["/assets/sample-a1b2c3.js"],
			intervalMs: 3000,
			batchSize: 8,
		})
	})

	it("uses low-tier warm-up tuning when core count is at most 6", async () => {
		devicesState.isMobile = false
		const { postMessage } = setupWarmUpTestEnv({ hardwareConcurrency: 2 })

		registerAppServiceWorker()
		await flushMicrotasks(8)

		expect(postMessage).toHaveBeenCalledWith({
			type: "START_WARMUP",
			assets: ["/assets/sample-a1b2c3.js"],
			intervalMs: 5000,
			batchSize: 6,
		})
	})

	it("uses high-tier warm-up tuning when core count is above 11", async () => {
		devicesState.isMobile = false
		const { postMessage } = setupWarmUpTestEnv({ hardwareConcurrency: 16 })

		registerAppServiceWorker()
		await flushMicrotasks(8)

		expect(postMessage).toHaveBeenCalledWith({
			type: "START_WARMUP",
			assets: ["/assets/sample-a1b2c3.js"],
			intervalMs: 500,
			batchSize: 10,
		})
	})
})
