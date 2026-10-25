import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	loadConfig: vi.fn<() => Promise<void>>(),
	hydrateLanguageEarly: vi.fn<() => Promise<void>>(),
	initConfig: vi.fn<() => Promise<void>>(),
	loadSettings: vi.fn(),
	initGlobalConfig: vi.fn<() => Promise<void>>(),
	logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), report: vi.fn() },
}))

vi.mock("@/services", () => ({
	service: {
		get: () => ({
			loadConfig: mocks.loadConfig,
			hydrateLanguageEarly: mocks.hydrateLanguageEarly,
			init: mocks.initConfig,
		}),
	},
}))
vi.mock("@/apis", () => ({ GlobalApi: { getSettingsAll: mocks.loadSettings } }))
vi.mock("@/infrastructure/logger", () => ({
	logger: { createLogger: () => mocks.logger },
}))
vi.mock("@/stores/globalConfig", () => ({
	globalConfigStore: { initGlobalConfig: mocks.initGlobalConfig },
}))
vi.mock("@/stores/bot", () => ({ botStore: {} }))
vi.mock("@/models/user", () => ({ userStore: { user: {} } }))
vi.mock("@/models/config", () => ({ Config: {} }))
vi.mock("@/services/app/browser-apm", () => ({ initializeBrowserApm: vi.fn() }))
vi.mock("@/constants/routes", () => ({ RoutePath: {} }))
vi.mock("@/routes/constants", () => ({ RouteName: {} }))
vi.mock("@/routes/history", () => ({ history: {} }))
vi.mock("@/routes/history/helpers", () => ({
	convertSearchParams: vi.fn(),
	routesMatch: vi.fn(),
}))
vi.mock("@/routes/const/whiteRoutes", () => ({ whiteListRoutes: [] }))
vi.mock("@/routes/helpers", () => ({ defaultClusterCode: "" }))
vi.mock("@/utils/redirect", () => ({ getHomeURL: vi.fn() }))
vi.mock("@/pages/login/constants", () => ({ LoginValueKey: {} }))
vi.mock("@/stores/interface", () => ({ interfaceStore: {} }))
vi.mock("@/broadcastChannel", () => ({ BroadcastChannelSender: {} }))
vi.mock("@/broadcastChannel/eventFactory/accountContextRefresh", () => ({
	refreshAccountContextPage: vi.fn(),
}))
vi.mock("@/services/auth/AuthEventBus", () => ({ authEventBus: {} }))
vi.mock("@/services/app/platformServices/magic", () => ({ default: class {} }))
vi.mock("@/services/app/platformServices/admin", () => ({ default: class {} }))
vi.mock("@/services/app/platformServices/api", () => ({ default: class {} }))

import { appService, AppInitResult } from "../AppService"
import { appStore } from "@/stores/app"
import { AppInitErrorCode, AppInitializationError } from "../errors"

interface ConfigurationLifecycle {
	initializePublicConfiguration(): Promise<void>
	clearConfigRetryTimer(): void
	isConfigInitializing: boolean
	configInitStatus: "idle" | "pending" | "success" | "failed"
	configInitRetryCount: number
	configInitPromise: Promise<void> | null
	settingsAllPromise: Promise<unknown> | null
}

const owner = appService as unknown as ConfigurationLifecycle

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

beforeEach(() => {
	vi.useFakeTimers()
	vi.clearAllMocks()
	mocks.hydrateLanguageEarly.mockReset().mockResolvedValue(undefined)
	mocks.loadConfig.mockReset().mockResolvedValue(undefined)
	mocks.initConfig.mockReset().mockResolvedValue(undefined)
	mocks.initGlobalConfig.mockReset().mockResolvedValue(undefined)
	mocks.loadSettings.mockReset().mockResolvedValue({
		platform_settings: { default_language: "en_US" },
		global_config: {},
	})
	owner.isConfigInitializing = false
	owner.configInitStatus = "idle"
	owner.configInitRetryCount = 0
	owner.configInitPromise = null
	owner.settingsAllPromise = null
	appStore.setAppInitPromise(null)
	appStore.setLanguageReadyPromise(null)
	appStore.setPublicConfigInitPromise(null)
	vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
		callback({ didTimeout: false, timeRemaining: () => 50 })
		return 1
	})
})

afterEach(() => {
	owner.clearConfigRetryTimer()
	vi.clearAllTimers()
	vi.useRealTimers()
	vi.unstubAllGlobals()
	appStore.setAppInitPromise(null)
	appStore.setLanguageReadyPromise(null)
	appStore.setPublicConfigInitPromise(null)
})

describe("public configuration initialization", () => {
	it("runs against the public AppService implementation", () => {
		expect(AppInitResult.NEED_SYSTEM_INITIALIZATION).toBe("NEED_SYSTEM_INITIALIZATION")
	})

	it("keeps language initialization independent from a pending locales request", async () => {
		const locales = deferred<void>()
		mocks.loadConfig.mockReturnValueOnce(locales.promise)
		const task = owner.initializePublicConfiguration()
		await vi.waitFor(() => expect(appStore.languageReadyPromise).not.toBeNull())
		await appStore.languageReadyPromise
		expect(mocks.initGlobalConfig).toHaveBeenCalledOnce()
		expect(owner.configInitStatus).toBe("pending")
		expect(owner.isConfigInitializing).toBe(true)
		expect(appStore.publicConfigInitPromise).toBe(owner.configInitPromise)
		locales.resolve()
		await task
		expect(owner.configInitStatus).toBe("success")
		expect(owner.isConfigInitializing).toBe(false)
	})

	it("initializes the display language while list reads wait for app bootstrap", async () => {
		const bootstrap = deferred<void>()
		appStore.setAppInitPromise(bootstrap.promise)
		const task = owner.initializePublicConfiguration()
		await vi.waitFor(() => expect(appStore.languageReadyPromise).not.toBeNull())
		await appStore.languageReadyPromise
		expect(mocks.loadSettings).toHaveBeenCalledWith({ skipAppInitWait: true })
		expect(mocks.loadConfig).not.toHaveBeenCalled()
		expect(owner.configInitStatus).toBe("pending")

		bootstrap.resolve()
		await task
		expect(mocks.loadConfig).toHaveBeenCalledExactlyOnceWith({ skipAppInitWait: true })
		expect(owner.configInitStatus).toBe("success")
	})

	it("reads public lists after a rejected bootstrap without branching on its error", async () => {
		const bootstrap = deferred<void>()
		const bootstrapRejected = expect(bootstrap.promise).rejects.toBe("bootstrap unavailable")
		appStore.setAppInitPromise(bootstrap.promise)
		const task = owner.initializePublicConfiguration()
		await vi.waitFor(() => expect(appStore.languageReadyPromise).not.toBeNull())
		await appStore.languageReadyPromise
		expect(mocks.loadConfig).not.toHaveBeenCalled()

		bootstrap.reject("bootstrap unavailable")
		await bootstrapRejected
		await task
		expect(mocks.loadConfig).toHaveBeenCalledOnce()
		expect(owner.configInitStatus).toBe("success")
	})

	it("starts list reads only after platform settings and language initialization", async () => {
		const settings = deferred<unknown>()
		const cause = new TypeError("Failed to fetch")
		mocks.loadConfig.mockRejectedValueOnce(cause)
		mocks.loadSettings.mockReturnValueOnce(settings.promise)
		const task = owner.initializePublicConfiguration()
		const rejected = expect(task).rejects.toBe(cause)
		await vi.waitFor(() => expect(mocks.loadSettings).toHaveBeenCalledOnce())
		expect(mocks.loadConfig).not.toHaveBeenCalled()
		expect(owner.configInitStatus).toBe("pending")
		settings.resolve({ platform_settings: {}, global_config: {} })
		await rejected
		expect(mocks.initConfig).toHaveBeenCalledOnce()
		expect(owner.configInitStatus).toBe("failed")
		expect(owner.isConfigInitializing).toBe(false)
		expect(owner.configInitRetryCount).toBe(1)
		expect(mocks.logger.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				eventKey: "load_config_service_failed",
				error: cause,
				context: { stage: "load_language_options", retryCount: 0 },
			}),
		)
	})

	it("does not start a list request when platform settings fail", async () => {
		const cause = new Error("settings unavailable")
		mocks.loadSettings.mockRejectedValueOnce(cause)
		await expect(owner.initializePublicConfiguration()).rejects.toMatchObject({
			code: AppInitErrorCode.PlatformSettingsRequestFailed,
			cause,
		})
		expect(mocks.loadConfig).not.toHaveBeenCalled()
		expect(owner.configInitStatus).toBe("failed")
		expect(owner.isConfigInitializing).toBe(false)
		expect(mocks.logger.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ eventKey: "load_config_failed", error: cause }),
		)
	})

	it("reports an unexpected settings failure through the lifecycle fallback", async () => {
		const cause = new Error("settings API unavailable")
		mocks.loadSettings.mockImplementationOnce(() => {
			throw cause
		})

		await expect(owner.initializePublicConfiguration()).rejects.toBe(cause)

		expect(mocks.logger.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				eventKey: "public_configuration_initialization_failed",
				error: cause,
				context: { stage: "public_configuration", retryCount: 0 },
			}),
		)
		expect(owner.configInitStatus).toBe("failed")
		expect(owner.configInitRetryCount).toBe(1)
	})

	it("reports a late hydration failure after parallel settings have failed", async () => {
		const hydration = deferred<void>()
		const settings = deferred<unknown>()
		const settingsError = new Error("settings unavailable")
		const hydrationError = new Error("hydration unavailable")
		mocks.hydrateLanguageEarly.mockReturnValueOnce(hydration.promise)
		mocks.loadSettings.mockReturnValueOnce(settings.promise)
		const task = owner.initializePublicConfiguration()
		const rejected = expect(task).rejects.toMatchObject({
			code: AppInitErrorCode.PlatformSettingsRequestFailed,
			cause: settingsError,
		})
		expect(mocks.hydrateLanguageEarly).toHaveBeenCalledOnce()
		expect(mocks.loadSettings).toHaveBeenCalledOnce()
		expect(mocks.initConfig).not.toHaveBeenCalled()

		settings.reject(settingsError)
		await rejected
		expect(mocks.logger.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ eventKey: "load_config_failed", error: settingsError }),
		)

		// Promise.all has settled, but the remaining branch still needs its own report.
		hydration.reject(hydrationError)
		await vi.waitFor(() => expect(mocks.logger.error).toHaveBeenCalledTimes(2))
		expect(mocks.logger.error).toHaveBeenLastCalledWith(
			expect.objectContaining({
				eventKey: "hydrate_language_failed",
				error: hydrationError,
				context: { stage: "hydrate_language", retryCount: 0 },
			}),
		)
		expect(mocks.initConfig).not.toHaveBeenCalled()
	})

	it("propagates a synchronous locales call failure", async () => {
		const cause = new Error("service unavailable")
		mocks.loadConfig.mockImplementationOnce(() => {
			throw cause
		})
		await expect(owner.initializePublicConfiguration()).rejects.toBe(cause)
		expect(owner.isConfigInitializing).toBe(false)
	})

	it("propagates a preclassified read failure unchanged without inspecting its class", async () => {
		const cause = new AppInitializationError({ code: AppInitErrorCode.AccountInitFailed })
		mocks.loadConfig.mockRejectedValueOnce(cause)
		await expect(owner.initializePublicConfiguration()).rejects.toBe(cause)
	})

	it.each([
		{ kind: "hydrate", stage: "hydrate_language", eventKey: "hydrate_language_failed" },
		{ kind: "language", stage: "initialize_config", eventKey: "config_initialize_failed" },
		{
			kind: "global",
			stage: "initialize_global_config",
			eventKey: "config_initialize_failed",
		},
	])(
		"reports and propagates the original $kind initialization failure",
		async ({ kind, stage, eventKey }) => {
			const cause = new Error("configuration unavailable")
			if (kind === "hydrate") mocks.hydrateLanguageEarly.mockRejectedValueOnce(cause)
			else if (kind === "language") mocks.initConfig.mockRejectedValueOnce(cause)
			else mocks.initGlobalConfig.mockRejectedValueOnce(cause)
			await expect(owner.initializePublicConfiguration()).rejects.toBe(cause)
			expect(owner.configInitStatus).toBe("failed")
			expect(mocks.loadConfig).not.toHaveBeenCalled()
			expect(mocks.logger.error).toHaveBeenCalledExactlyOnceWith(
				expect.objectContaining({
					eventKey,
					error: cause,
					context: { stage, retryCount: 0 },
				}),
			)
			expect(mocks.logger.error.mock.calls[0][0].error).toBe(cause)
		},
	)

	it("reports both parallel initialization failures when the second rejects late", async () => {
		const language = deferred<void>()
		const global = deferred<void>()
		const languageError = new Error("language unavailable")
		const globalError = new Error("global configuration unavailable")
		mocks.initConfig.mockReturnValueOnce(language.promise)
		mocks.initGlobalConfig.mockReturnValueOnce(global.promise)
		const task = owner.initializePublicConfiguration()
		const rejected = expect(task).rejects.toBe(languageError)
		await vi.waitFor(() => expect(mocks.initGlobalConfig).toHaveBeenCalledOnce())
		language.reject(languageError)
		await rejected
		expect(mocks.logger.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				eventKey: "config_initialize_failed",
				error: languageError,
				context: { stage: "initialize_config", retryCount: 0 },
			}),
		)

		global.reject(globalError)
		await vi.waitFor(() => expect(mocks.logger.error).toHaveBeenCalledTimes(2))
		expect(mocks.logger.error).toHaveBeenLastCalledWith(
			expect.objectContaining({
				eventKey: "config_initialize_failed",
				error: globalError,
				context: { stage: "initialize_global_config", retryCount: 0 },
			}),
		)
		expect(mocks.loadConfig).not.toHaveBeenCalled()
	})

	it("reports a language timeout and a later rejection from the original initialization", async () => {
		const language = deferred<void>()
		mocks.initConfig.mockReturnValueOnce(language.promise)
		const task = owner.initializePublicConfiguration()
		const rejected = expect(task).rejects.toThrow(
			"ConfigService initialization timed out (10 seconds)",
		)

		await vi.waitFor(() => expect(appStore.languageReadyPromise).not.toBeNull())
		await vi.advanceTimersByTimeAsync(10000)
		await rejected
		expect(owner.configInitStatus).toBe("failed")
		expect(owner.isConfigInitializing).toBe(false)
		expect(mocks.logger.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				eventKey: "config_initialize_failed",
				errorKind: "timeout",
				error: expect.objectContaining({
					message: "ConfigService initialization timed out (10 seconds)",
				}),
				context: { stage: "initialize_config", retryCount: 0 },
			}),
		)

		const lateError = new Error("initialization failed after timeout")
		language.reject(lateError)
		await vi.waitFor(() => expect(mocks.logger.error).toHaveBeenCalledTimes(2))
		expect(mocks.logger.error).toHaveBeenLastCalledWith(
			expect.objectContaining({
				eventKey: "config_initialize_failed",
				errorKind: "unknown",
				error: lateError,
				context: { stage: "initialize_config", retryCount: 0 },
			}),
		)
	})

	it("reuses an in-progress initialization", async () => {
		const locales = deferred<void>()
		mocks.loadConfig.mockReturnValueOnce(locales.promise)
		const first = owner.initializePublicConfiguration()
		const second = owner.initializePublicConfiguration()
		await vi.waitFor(() => expect(mocks.loadConfig).toHaveBeenCalledOnce())
		locales.resolve()
		await Promise.all([first, second])
		expect(mocks.initConfig).toHaveBeenCalledOnce()
	})

	it.each([
		{ label: "stale scope", error: new DOMException("Stale HTTP scope", "AbortError") },
		{ label: "network failure", error: new TypeError("Failed to fetch") },
		{ label: "business failure", error: { code: 5000, message: "unavailable" } },
	])("recovers from $label on the same first backoff", async ({ error }) => {
		mocks.loadConfig.mockRejectedValueOnce(error)
		await expect(owner.initializePublicConfiguration()).rejects.toBe(error)
		expect(mocks.logger.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				eventKey: "load_config_service_failed",
				error,
				context: { stage: "load_language_options", retryCount: 0 },
			}),
		)
		await vi.advanceTimersByTimeAsync(1999)
		expect(mocks.loadConfig).toHaveBeenCalledTimes(1)
		await vi.advanceTimersByTimeAsync(1)
		expect(mocks.loadConfig).toHaveBeenCalledTimes(2)
		expect(owner.configInitStatus).toBe("success")
		expect(owner.configInitRetryCount).toBe(0)
		await vi.advanceTimersByTimeAsync(120000)
		expect(mocks.loadConfig).toHaveBeenCalledTimes(2)
		expect(mocks.logger.error).toHaveBeenCalledOnce()
	})

	it("stops after the existing five backoff retries", async () => {
		const cause = new Error("unavailable")
		mocks.loadConfig.mockRejectedValue(cause)
		await expect(owner.initializePublicConfiguration()).rejects.toBe(cause)
		for (const delay of [2000, 4000, 8000, 16000, 32000]) {
			await vi.advanceTimersByTimeAsync(delay)
		}
		expect(mocks.loadConfig).toHaveBeenCalledTimes(6)
		expect(owner.configInitRetryCount).toBe(5)
		expect(owner.configInitStatus).toBe("failed")
		expect(owner.isConfigInitializing).toBe(false)
		expect(mocks.logger.error).toHaveBeenCalledTimes(7)
		expect(mocks.logger.error).toHaveBeenLastCalledWith(
			expect.objectContaining({
				eventKey: "config_initialization_retry_exhausted",
				error: cause,
				context: { retryCount: 5, maxRetry: 5 },
			}),
		)
		expect(mocks.logger.error.mock.lastCall?.[0].error).toBe(cause)
		await vi.advanceTimersByTimeAsync(120000)
		expect(mocks.loadConfig).toHaveBeenCalledTimes(6)
		expect(mocks.logger.error).toHaveBeenCalledTimes(7)
	})
})
