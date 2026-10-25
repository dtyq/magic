import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Common } from "@/types/common"
import { HttpDisposedError } from "@/infrastructure/network/http/errors"
import { RequestContext } from "@/infrastructure/network/http/interceptors/requestContext"
import { ConfigService } from "../ConfigService"

const state = vi.hoisted(() => ({
	setLanguages: vi.fn(),
	setAreaCodes: vi.fn(),
}))

vi.mock("@/models/config/stores", () => ({
	configStore: {
		i18n: { setLanguages: state.setLanguages, setAreaCodes: state.setAreaCodes },
	},
}))
vi.mock("@/models/config/repositories/ConfigRepository", () => ({
	ConfigRepository: class {},
}))
vi.mock("@/models/config/repositories/ClusterRepository", () => ({
	ClusterRepository: class {},
}))
vi.mock("@/broadcastChannel", () => ({ BroadcastChannelSender: {} }))
vi.mock("@/utils/env", () => ({ env: vi.fn() }))
vi.mock("@/utils/locale", () => ({ normalizeLocale: (value: string) => value }))

type CommonApi = ConstructorParameters<typeof ConfigService>[0]["CommonApi"]

function createService() {
	const commonApi = {
		getInternationalizedSettings: vi.fn<CommonApi["getInternationalizedSettings"]>(),
		getPrivateConfigure: vi.fn<CommonApi["getPrivateConfigure"]>(),
		getPrivateLoginConfig: vi.fn<CommonApi["getPrivateLoginConfig"]>(),
	}
	return {
		config: new ConfigService({ CommonApi: commonApi }),
		getSettings: commonApi.getInternationalizedSettings,
	}
}

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise
	})
	return { promise, resolve }
}

const settings: Common.InternationalizedSettingsResponse = {
	languages: [{ name: "English", locale: "en_US", translations: { en_US: "English" } }],
	phone_area_codes: [
		{ code: "+1", name: "Example", locale: "en_US", translations: { en_US: "Example" } },
	],
}

beforeEach(() => {
	vi.clearAllMocks()
})

describe("ConfigService.loadConfig", () => {
	it("writes both configuration lists after one successful injected API read", async () => {
		const { config, getSettings } = createService()
		getSettings.mockResolvedValue(settings)

		await config.loadConfig()

		expect(getSettings).toHaveBeenCalledExactlyOnceWith(undefined)
		expect(state.setLanguages).toHaveBeenCalledExactlyOnceWith(settings.languages)
		expect(state.setAreaCodes).toHaveBeenCalledExactlyOnceWith(settings.phone_area_codes)
	})

	it("accepts protocol-valid empty lists", async () => {
		const { config, getSettings } = createService()
		getSettings.mockResolvedValue({ languages: [], phone_area_codes: [] })

		await expect(config.loadConfig()).resolves.toBeUndefined()

		expect(getSettings).toHaveBeenCalledOnce()
		expect(state.setLanguages).toHaveBeenCalledExactlyOnceWith([])
		expect(state.setAreaCodes).toHaveBeenCalledExactlyOnceWith([])
	})

	it("rejects a real stale response without writing it or starting another read", async () => {
		const { config, getSettings } = createService()
		let revision = 0
		const context = new RequestContext({
			resolve: () => ({ revision }),
			isCurrent: (snapshot) => snapshot.revision === revision,
		})
		const response = deferred<Common.InternationalizedSettingsResponse>()
		getSettings.mockImplementation(async () => {
			const request = { headers: new Headers() }
			context.capture(request)
			const value = await response.promise
			context.assertCurrent(request)
			return value
		})
		const options = { skipAppInitWait: true }
		const loading = config.loadConfig(options)
		const rejected = expect(loading).rejects.toMatchObject({
			name: "AbortError",
			message: "Stale HTTP scope",
		})
		revision++
		response.resolve(settings)
		await rejected

		expect(getSettings).toHaveBeenCalledExactlyOnceWith(options)
		expect(state.setLanguages).not.toHaveBeenCalled()
		expect(state.setAreaCodes).not.toHaveBeenCalled()
	})

	it.each([
		{ label: "stale scope", error: new DOMException("Stale HTTP scope", "AbortError") },
		{ label: "stale payload", error: { name: "AbortError", message: "Stale HTTP scope" } },
		{ label: "network failure", error: new TypeError("Failed to fetch") },
		{ label: "ordinary cancellation", error: new DOMException("Aborted", "AbortError") },
		{
			label: "missing request context",
			error: new DOMException("Missing HTTP request context", "AbortError"),
		},
		{ label: "disposed client", error: new HttpDisposedError() },
		{ label: "business error", error: { code: 4000, message: "Failed" } },
		{ label: "different name", error: new Error("Stale HTTP scope") },
		{
			label: "different message",
			error: new DOMException("Stale HTTP scope after cancellation", "AbortError"),
		},
		{ label: "string rejection", error: "Stale HTTP scope" },
		{ label: "null rejection", error: null },
		{ label: "undefined rejection", error: undefined },
	])("preserves $label without retrying or changing stored configuration", async ({ error }) => {
		const { config, getSettings } = createService()
		getSettings.mockRejectedValueOnce(error)

		await expect(config.loadConfig()).rejects.toBe(error)

		expect(getSettings).toHaveBeenCalledOnce()
		expect(state.setLanguages).not.toHaveBeenCalled()
		expect(state.setAreaCodes).not.toHaveBeenCalled()
	})

	it.each([null, undefined])(
		"rejects an invalid %s response without retrying",
		async (response) => {
			const { config, getSettings } = createService()
			// Exercise an invalid runtime payload despite the API's non-null response type.
			getSettings.mockResolvedValueOnce(
				response as unknown as Common.InternationalizedSettingsResponse,
			)

			await expect(config.loadConfig()).rejects.toThrow(
				"Invalid internationalization settings response",
			)

			expect(getSettings).toHaveBeenCalledOnce()
			expect(state.setLanguages).not.toHaveBeenCalled()
			expect(state.setAreaCodes).not.toHaveBeenCalled()
		},
	)
})
