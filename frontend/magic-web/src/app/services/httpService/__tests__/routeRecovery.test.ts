import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppHttpService } from "@/app/services/httpService"
import { http, defaultIframeClient } from "@/infrastructure/network/http/runtime"

const state = vi.hoisted(() => ({
	token: "token-a",
	language: "en_US",
	cluster: "a",
	accountCluster: "a",
	baseURL: "https://original.test",
	toast: vi.fn(),
	invalidate: vi.fn(),
}))
vi.mock("@/models/config", () => ({
	configStore: {
		cluster: {
			get clusterCode() {
				return state.cluster
			},
		},
		i18n: {
			get displayLanguage() {
				return state.language
			},
		},
	},
}))
vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			get authorization() {
				return state.token
			},
			organizationCode: "org",
			teamshareOrganizationCode: "org",
			organizations: [],
		},
		account: {
			getAccountByAccessToken: (token: string) =>
				!token || token === "unknown-token"
					? undefined
					: {
							magic_id: token,
							deployCode: state.accountCluster,
						},
		},
	},
}))
vi.mock("@/utils/env", () => ({
	env: (key: string) => (key === "MAGIC_ENABLE_API_CACHE" ? "false" : state.baseURL),
}))
vi.mock("@/utils/locale", () => ({ getCurrentLang: (value: string) => value }))
vi.mock("@/infrastructure/network/http/requestId", () => ({
	StringUtils: { createRequestId: () => "test" },
}))
vi.mock("@/services", () => ({ service: { get: vi.fn() } }))
vi.mock("@/services/auth/AuthSessionCoordinator", () => ({
	authSessionCoordinator: { invalidate: state.invalidate },
}))
vi.mock("@/components/base/MagicToaster/utils", () => ({ default: { error: state.toast } }))
vi.mock("@/app/services/httpService/interceptors/request/waitForAppInit", () => ({
	awaitAppInitForOutgoingRequest: () => Promise.resolve(),
}))
vi.mock("@/services/config/cluster-service-url", () => ({
	getClusterServiceUrls: () => ({
		keewood: "https://keewood.test",
		teamshare: "https://teamshare.test",
	}),
	getKeewoodServiceUrl: () => "https://keewood.test",
	getTeamshareServiceUrl: () => "https://teamshare.test",
}))

const json = (code = 1000, status = 200) =>
	new Response(JSON.stringify({ code, data: "ok", message: "failed" }), {
		status,
		headers: { "Content-Type": "application/json" },
	})
let owner: AppHttpService
beforeEach(() => {
	vi.clearAllMocks()
	state.token = "token-a"
	state.language = "en_US"
	state.cluster = state.accountCluster = "a"
	state.baseURL = "https://original.test"
	vi.stubGlobal(
		"fetch",
		vi.fn<typeof fetch>(async () => json()),
	)
	vi.spyOn(console, "error").mockImplementation(() => undefined)
	owner = new AppHttpService()
})
afterEach(() => {
	owner.dispose()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe("httpService route recovery", () => {
	it("preserves the default missing-login flow when no credentials are available", async () => {
		state.token = ""
		owner.init()
		vi.mocked(fetch).mockResolvedValueOnce(json(401, 401))
		await expect(http.get("/private")).rejects.toThrow("Unauthorized")
		expect(state.invalidate).toHaveBeenCalledOnce()
		expect(state.invalidate).toHaveBeenCalledWith(
			expect.objectContaining({ accountId: undefined, reason: "token-expired" }),
		)
	})
	it("keeps the original language, credentials and body during retry", async () => {
		owner.init()
		state.baseURL = "https://recovered.test"
		let release!: (response: Response) => void
		vi.mocked(fetch).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					release = resolve
				}),
		)
		const pending = http.post(
			"/submit",
			{ value: 1 },
			{ headers: { "organization-code": "explicit-org" } },
		)
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
		state.language = "zh_CN"
		release(json(401, 401))
		await pending
		await http.get("/next")
		const calls = vi.mocked(fetch).mock.calls
		for (const [, request] of calls.slice(0, 2)) {
			expect((request?.headers as Headers).get("language")).toBe("en_US")
			expect((request?.headers as Headers).get("authorization")).toBe("token-a")
			expect((request?.headers as Headers).get("organization-code")).toBe("explicit-org")
			expect(request).toMatchObject({ method: "POST", body: JSON.stringify({ value: 1 }) })
		}
		expect((calls[2][1]?.headers as Headers).get("language")).toBe("zh_CN")
	})

	it.each([
		{ token: "other-token", code: 401, status: 401, attempts: 2 },
		{ token: "other-token", code: 2179, status: 200, attempts: 2 },
		{ token: "unknown-token", code: 401, status: 401, attempts: 1 },
	])(
		"does not clean up global authentication for $token ($status/$code)",
		async ({ token, code, status, attempts }) => {
			owner.init()
			state.baseURL = "https://recovered.test"
			vi.mocked(fetch).mockImplementation(async () => json(code, status))
			await expect(
				http.get("/foreign", { headers: { authorization: token } }),
			).rejects.toThrow("Unauthorized")
			expect(fetch).toHaveBeenCalledTimes(attempts)
			expect(state.invalidate).not.toHaveBeenCalled()
			vi.mocked(fetch).mockResolvedValueOnce(json())
			await http.get("/current")
			expect(fetch).toHaveBeenLastCalledWith(
				"https://original.test/current",
				expect.anything(),
			)
		},
	)

	it.each([
		{ previous: "/xxxx/xxx", next: "/xxxx/xxx" },
		{ previous: "/old/api/", next: "/gateway/api/" },
		{ previous: "/old", next: "/gateway" },
		{ previous: "", next: "/gateway/" },
		{ previous: "/old/", next: "" },
	])(
		"preserves the retry path and publishes the full baseURL ($previous to $next)",
		async ({ previous, next }) => {
			state.baseURL = `https://original.test${previous}`
			owner.init()
			state.baseURL = `https://recovered.test${next}`
			vi.mocked(fetch).mockResolvedValueOnce(json(401, 401))
			const endpoint = "/users?signature=a%20b#section"
			await http.get(endpoint, { params: { ids: [1, 2] } })
			await http.get(endpoint, { params: { ids: [1, 2] } })
			const suffix = "/users?signature=a%20b&ids%5B%5D=1&ids%5B%5D=2#section"
			expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
				`https://original.test${previous.replace(/\/$/, "")}${suffix}`,
				`https://recovered.test${previous.replace(/\/$/, "")}${suffix}`,
				`https://recovered.test${next.replace(/\/$/, "")}${suffix}`,
			])
		},
	)

	it("keeps explicit absolute endpoint paths independent of the default base path", async () => {
		state.baseURL = "https://original.test/old"
		owner.init()
		state.baseURL = "https://recovered.test/gateway"
		vi.mocked(fetch).mockResolvedValueOnce(json(401, 401))
		await http.get("https://explicit.test/custom?x=1")
		await http.get("https://explicit.test/custom?x=1")
		expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
			"https://explicit.test/custom?x=1",
			"https://recovered.test/custom?x=1",
			"https://explicit.test/custom?x=1",
		])
	})
	it.each([
		{ code: 5000, status: 500 },
		{ code: 40101, status: 200 },
		{ code: 70007, status: 200 },
		{ code: 403, status: 403 },
	])(
		"does not change host or retry for non-authentication errors ($status/$code)",
		async ({ code, status }) => {
			owner.init()
			state.baseURL = "https://recovered.test"
			vi.mocked(fetch).mockResolvedValueOnce(json(code, status))
			// Organization handling needs its normal service dependency; it must not initiate routing.
			if (code === 40101) {
				const { service } = await import("@/services")
				vi.mocked(service.get).mockReturnValue({
					setMagicOrganizationCode: vi.fn(),
				} as never)
			}
			await http.get("/failed").catch(() => undefined)
			expect(fetch).toHaveBeenCalledOnce()
			await http.get("/next")
			expect(fetch).toHaveBeenLastCalledWith("https://original.test/next", expect.anything())
			expect(state.invalidate).not.toHaveBeenCalled()
		},
	)

	it.each([3103, 2155, 2179])(
		"corrects the route for authentication code=%s even with HTTP 200",
		async (code) => {
			owner.init()
			state.baseURL = "https://recovered.test"
			vi.mocked(fetch).mockResolvedValueOnce(json(code))
			await http.get("/first")
			await http.get("/next")
			expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
				"https://original.test/first",
				"https://recovered.test/first",
				"https://recovered.test/next",
			])
		},
	)

	it("retains the corrected address after a network failure during retry", async () => {
		owner.init()
		state.baseURL = "https://recovered.test"
		vi.mocked(fetch)
			.mockResolvedValueOnce(json(401, 401))
			.mockRejectedValueOnce(new TypeError("network failed"))
		await expect(http.get("/first")).rejects.toThrow("network failed")
		await http.get("/next")
		expect(fetch).toHaveBeenLastCalledWith("https://recovered.test/next", expect.anything())
	})
	it("persists an authentication route correction without redirecting iframe", async () => {
		owner.init()
		state.baseURL = "https://recovered.test"
		vi.mocked(fetch).mockResolvedValueOnce(json(401, 401))
		await expect(http.get("/first")).resolves.toBe("ok")
		await http.get("/next")
		await defaultIframeClient.get("/iframe")
		expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
			"https://original.test/first",
			"https://recovered.test/first",
			"https://recovered.test/next",
			"https://original.test/iframe",
		])
		expect(state.invalidate).not.toHaveBeenCalled()
	})

	it.each(["https://recovered.test:9443", "https://recovered.test"])(
		"recovers origin %s while preserving the request path and query",
		async (origin) => {
			state.baseURL = "http://original.test:8080/api"
			owner.init()
			state.baseURL = `${origin}/api`
			vi.mocked(fetch).mockResolvedValueOnce(json(401, 401))
			await http.get("/first", { params: { page: 1 } })
			await http.get("/next")
			expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
				"http://original.test:8080/api/first?page=1",
				`${origin}/api/first?page=1`,
				`${origin}/api/next`,
			])
		},
	)

	it.each([
		{ code: 401, status: 401 },
		{ code: 5000, status: 200 },
		{ code: 1000, status: 500 },
	])(
		"keeps the corrected default even when the retry fails ($status/$code)",
		async ({ code, status }) => {
			owner.init()
			state.baseURL = "https://recovered.test/gateway/api"
			vi.mocked(fetch)
				.mockResolvedValueOnce(json(401, 401))
				.mockResolvedValueOnce(json(code, status))
			await http.get("/first").catch(() => undefined)
			await http.get("/next")
			expect(fetch).toHaveBeenLastCalledWith(
				"https://recovered.test/gateway/api/next",
				expect.anything(),
			)
		},
	)

	it("does not roll back the corrected address when a later response handler rejects", async () => {
		owner.init()
		state.baseURL = "https://recovered.test"
		vi.mocked(fetch).mockResolvedValueOnce(json(401, 401))
		const remove = http.addResponseInterceptor(async () => {
			throw new Error("rejected by application")
		})
		await expect(http.get("/first")).rejects.toThrow("rejected by application")
		remove()
		await http.get("/next")
		expect(fetch).toHaveBeenLastCalledWith("https://recovered.test/next", expect.anything())
	})

	it.each(["token", "cluster", "dispose"] as const)(
		"retains identity and disposal guards after %s changes",
		async (change) => {
			owner.init()
			state.baseURL = "https://recovered.test"
			let finish!: (value: Response) => void
			vi.mocked(fetch)
				.mockResolvedValueOnce(json(401, 401))
				.mockImplementationOnce(
					() =>
						new Promise((resolve) => {
							finish = resolve
						}),
				)
			const pending = http.get("/first")
			const rejected = expect(pending).rejects.toMatchObject({
				name: change === "dispose" ? "HttpDisposedError" : "AbortError",
			})
			await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
			if (change === "token") state.token = "token-b"
			else if (change === "cluster") state.cluster = "b"
			else owner.dispose()
			finish(json())
			await rejected
			expect(state.invalidate).not.toHaveBeenCalled()
			if (change !== "dispose") {
				await http.get("/next")
				expect(fetch).toHaveBeenLastCalledWith(
					"https://recovered.test/next",
					expect.anything(),
				)
			}
		},
	)

	it("keeps explicit foreign credentials local", async () => {
		owner.init()
		state.baseURL = "https://recovered.test"
		vi.mocked(fetch).mockResolvedValueOnce(json(401, 401))
		await http.get("/first", { headers: { authorization: "other-token" } })
		await http.get("/next")
		expect(fetch).toHaveBeenLastCalledWith("https://original.test/next", expect.anything())
	})

	it("corrects the current account's route when the global cluster code lags behind", async () => {
		owner.init()
		state.baseURL = "https://recovered.test"
		state.accountCluster = "b"
		vi.mocked(fetch).mockResolvedValueOnce(json(401, 401))
		await http.get("/first")
		await http.get("/next")
		expect(fetch).toHaveBeenLastCalledWith("https://recovered.test/next", expect.anything())
		expect(state.cluster).toBe("a")
	})

	it("publishes before retry completes and does not re-resolve on its successful response", async () => {
		owner.init()
		state.baseURL = "https://recovered.test"
		let finish!: (value: Response) => void
		vi.mocked(fetch)
			.mockResolvedValueOnce(json(401, 401))
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve
					}),
			)
		const pending = http.get("/first")
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
		await http.get("/during-retry")
		expect(fetch).toHaveBeenLastCalledWith(
			"https://recovered.test/during-retry",
			expect.anything(),
		)
		state.baseURL = "https://newer.test"
		finish(json())
		await pending
		await http.get("/next")
		expect(fetch).toHaveBeenLastCalledWith("https://recovered.test/next", expect.anything())
	})

	it.each([1000, 5000])(
		"keeps old-route response code=%s in the original response chain",
		async (code) => {
			owner.init()
			state.baseURL = "https://recovered.test"
			let finish!: (value: Response) => void
			vi.mocked(fetch).mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve
					}),
			)
			const old = http.get("/old")
			const completed =
				code === 1000
					? expect(old).resolves.toBe("ok")
					: expect(old).rejects.toMatchObject({ code })
			await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
			vi.mocked(fetch).mockResolvedValueOnce(json(401, 401))
			await expect(http.get("/recover")).resolves.toBe("ok")
			finish(json(code))
			await completed
			expect(state.toast).toHaveBeenCalledTimes(code === 1000 ? 0 : 1)
		},
	)
})
