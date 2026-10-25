import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ServiceHttpClient, type RequestConfig } from "@/infrastructure/network/http/clients"
import { createMagicClient } from "@/infrastructure/network/http/clients/createMagicClient"

vi.mock("@/infrastructure/logger", () => ({
	logger: { createLogger: () => ({ error: vi.fn() }) },
}))

describe("ServiceHttpClient query params", () => {
	let client: ServiceHttpClient
	const response = () =>
		new Response(JSON.stringify({ data: { ok: true } }), {
			headers: { "Content-Type": "application/json" },
		})

	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async () => response()),
		)
		client = new ServiceHttpClient({
			baseURL: "https://api.test/base",
			getBaseURL: () => "https://api.test/base",
		})
	})

	afterEach(() => {
		client.dispose()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("sends GET params while leaving the caller config unchanged", async () => {
		const config = { params: { ids: [1, 2], keyword: "a&b" } }
		await client.get("/items?old=1#section", config)
		expect(fetch).toHaveBeenCalledWith(
			"https://api.test/base/items?old=1&ids%5B%5D=1&ids%5B%5D=2&keyword=a%26b#section",
			expect.objectContaining({ method: "GET" }),
		)
		expect(vi.mocked(fetch).mock.calls[0][1]).not.toHaveProperty("params")
		expect(config).toEqual({ params: { ids: [1, 2], keyword: "a&b" } })
	})

	it.each(["post", "put", "patch", "delete"] as const)(
		"keeps the %s body separate from query params",
		async (method) => {
			await client[method]("/items", { name: "item" }, { params: { source: "web" } })
			expect(fetch).toHaveBeenCalledWith(
				"https://api.test/base/items?source=web",
				expect.objectContaining({
					method: method.toUpperCase(),
					body: JSON.stringify({ name: "item" }),
				}),
			)
			expect(vi.mocked(fetch).mock.calls[0][1]).not.toHaveProperty("params")
		},
	)

	it.each(["request", "retry"] as const)(
		"serializes params after interceptors on %s, including rewritten base URLs",
		async (method) => {
			client.addRequestInterceptor((config) => ({
				...config,
				baseURL: "https://cluster.test/v2",
				url: `${config.url}?swCache=api-runtime`,
				params: { ...config.params, page: 2 },
			}))
			await client[method]({ url: "/items", method: "GET", params: { page: 1 } })
			expect(fetch).toHaveBeenCalledWith(
				"https://cluster.test/v2/items?swCache=api-runtime&page=2",
				expect.anything(),
			)
			expect(vi.mocked(fetch).mock.calls[0][1]).not.toHaveProperty("params")
		},
	)

	it("does not duplicate array params when retrying a response interceptor's request", async () => {
		let retryConfig: RequestConfig | undefined
		client.addResponseInterceptor(async (context) => {
			retryConfig = context.request
			await context.http.retry(context.request)
			return context
		})
		await client.get("https://other.test/items", { params: { ids: [1, 2] } })
		expect(fetch).toHaveBeenCalledTimes(2)
		expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
			"https://other.test/items?ids%5B%5D=1&ids%5B%5D=2",
			"https://other.test/items?ids%5B%5D=1&ids%5B%5D=2",
		])
		expect(retryConfig).not.toHaveProperty("params")
	})

	it("rejects invalid params before transport and invokes error interceptors", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined)
		const onError = vi.fn((error: unknown) => error)
		client.addErrorInterceptor(onError)
		await expect(client.get("/items", { params: { page: NaN } })).rejects.toThrow(TypeError)
		expect(fetch).not.toHaveBeenCalled()
		expect(onError).toHaveBeenCalledOnce()
	})

	it("deduplicates equivalent queries but keeps different pages and arrays separate", async () => {
		client.dispose()
		client = createMagicClient({
			baseURL: "https://api.test/base",
			context: {
				resolve: () => ({ scopeId: "query-test", sessionEpoch: 0, language: "en_US" }),
				isCurrent: () => true,
				getKey: () => "query-test",
			},
			readiness: { wait: () => Promise.resolve() },
		}).client
		const pending = [
			client.get("/items", { params: { page: 1, ids: [1] }, enableRequestUnion: true }),
			client.get("/items", {
				params: { page: 1, ids: [1], unused: null },
				enableRequestUnion: true,
			}),
			client.get("/items", { params: { page: 2, ids: [1] }, enableRequestUnion: true }),
			client.get("/items", { params: { page: 1, ids: [2] }, enableRequestUnion: true }),
		]
		await Promise.all(pending)
		expect(fetch).toHaveBeenCalledTimes(3)
		expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
			"https://api.test/base/items?page=1&ids%5B%5D=1",
			"https://api.test/base/items?page=2&ids%5B%5D=1",
			"https://api.test/base/items?page=1&ids%5B%5D=2",
		])
		await client.get("/items", { params: { page: 1, ids: [1] }, enableRequestUnion: true })
		expect(fetch).toHaveBeenCalledTimes(4)
	})
})
