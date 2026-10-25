import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { AppHttpService } from "../index"
import { http, defaultIframeClient } from "@/infrastructure/network/http"
import { ServiceHttpClient } from "@/infrastructure/network/http/clients/ServiceHttpClient"
import { createBusinessHeadersInterceptor } from "../interceptors/request/businessHeaders"

const state = vi.hoisted(() => ({ fail: false, token: "a", effects: 0 }))
vi.mock("@/app/services/httpService/options/magic", () => ({
	createMagicClientOptions: () => ({
		baseURL: "https://app.test",
		context: {
			resolve: () => ({
				scopeId: "app",
				sessionEpoch: 0,
				authorization: state.token,
				language: "en_US",
			}),
			isCurrent: () => true,
		},
		readiness: { wait: async () => {} },
		requestInterceptors: [
			createBusinessHeadersInterceptor({
				createRequestId: () => "test",
				respectAuthorizationFlag: false,
			}),
		],
		responseInterceptors: [
			async (ctx: unknown) => {
				state.effects++
				return ctx
			},
		],
	}),
}))
vi.mock("@/app/services/httpService/options/iframe", async () => {
	const { createMagicClientOptions } = await import("@/app/services/httpService/options/magic")
	return {
		createIframeClientOptions: () => {
			if (state.fail) throw new Error("binding failed")
			return { ...createMagicClientOptions(), responseInterceptors: [] }
		},
	}
})
// The shared lifecycle contract also runs against the active enterprise overlay.
vi.mock("@enterprise/app/services/httpService/options/keewood", async () => {
	const { createMagicClientOptions } = await import("@/app/services/httpService/options/magic")
	return { createKeewoodClientOptions: createMagicClientOptions }
})
vi.mock("@enterprise/app/services/httpService/options/teamshare", async () => {
	const { createMagicClientOptions } = await import("@/app/services/httpService/options/magic")
	return { createTeamshareClientOptions: createMagicClientOptions }
})
vi.mock("@/models/config", () => ({ configStore: { cluster: { clusterCode: "a" } } }))
vi.mock("@/services/config/cluster-service-url", () => ({
	getClusterServiceUrls: () => ({
		keewood: "https://keewood.test",
		teamshare: "https://teamshare.test",
	}),
}))

beforeEach(() => {
	state.fail = false
	state.token = "a"
	state.effects = 0
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(JSON.stringify({ code: 1000, data: {} }), {
					headers: { "Content-Type": "application/json" },
				}),
		),
	)
})
afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe("application HTTP lifecycle", () => {
	it("binds without sending, is idempotent and reads credentials on each request", async () => {
		const service = new AppHttpService()
		try {
			service.init()
			service.init()
			expect(fetch).not.toHaveBeenCalled()
			await http.get("/one")
			state.token = "b"
			await http.get("/two")
			expect(state.effects).toBe(2)
			const calls = vi.mocked(fetch).mock.calls
			expect((calls[0][1]?.headers as Headers).get("authorization")).toBe("a")
			expect((calls[1][1]?.headers as Headers).get("authorization")).toBe("b")
		} finally {
			service.dispose()
		}
		await expect(http.get("/closed")).rejects.toMatchObject({ name: "HttpNotInitializedError" })
	})
	it("releases partially created clients and propagates initialization failure", async () => {
		const dispose = vi.spyOn(ServiceHttpClient.prototype, "dispose")
		const service = new AppHttpService()
		state.fail = true
		expect(() => service.init()).toThrow("binding failed")
		expect(dispose).toHaveBeenCalled()
		await expect(http.get("/not-published")).rejects.toMatchObject({
			name: "HttpNotInitializedError",
		})
		await expect(defaultIframeClient.get("/not-published")).rejects.toMatchObject({
			name: "HttpNotInitializedError",
		})
		state.fail = false
		service.init()
		await http.get("/retry-init")
		service.dispose()
	})
})
