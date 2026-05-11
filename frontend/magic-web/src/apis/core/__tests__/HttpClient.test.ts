import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HttpClient } from "../HttpClient"

describe("HttpClient interceptors", () => {
	const originalFetch = globalThis.fetch

	beforeEach(() => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: { ok: true } }), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
			}),
		) as typeof fetch
	})

	afterEach(() => {
		globalThis.fetch = originalFetch
		vi.restoreAllMocks()
	})

	it("runs request interceptors in registration order", async () => {
		const client = new HttpClient({
			baseURL: "https://default.example.com",
			getBaseURL(clusterCode: string) {
				return `https://${clusterCode}.example.com`
			},
		})
		const callOrder: string[] = []

		client.addRequestInterceptor((config) => {
			callOrder.push("first")
			config.headers?.set("x-first", "1")
			return config
		})
		client.addRequestInterceptor((config) => {
			callOrder.push("second")
			config.headers?.set("x-second", "1")
			return config
		})

		await client.get("/hello")

		expect(callOrder).toEqual(["first", "second"])
		expect(globalThis.fetch).toHaveBeenCalledWith(
			"https://default.example.com/hello",
			expect.objectContaining({
				headers: expect.any(Headers),
			}),
		)

		const [, requestInit] = vi.mocked(globalThis.fetch).mock.calls[0]
		const headers = requestInit?.headers as Headers
		expect(headers.get("x-first")).toBe("1")
		expect(headers.get("x-second")).toBe("1")
	})

	it("supports prepending request interceptors", async () => {
		const client = new HttpClient({
			baseURL: "https://default.example.com",
			getBaseURL(clusterCode: string) {
				return `https://${clusterCode}.example.com`
			},
		})
		const callOrder: string[] = []

		client.addRequestInterceptor((config) => {
			callOrder.push("tail")
			return config
		})
		client.addRequestInterceptor(
			(config) => {
				callOrder.push("head")
				return config
			},
			{ position: "head" },
		)

		await client.get("/priority")

		expect(callOrder).toEqual(["head", "tail"])
	})

	it("returns a disposer for request interceptors", async () => {
		const client = new HttpClient({
			baseURL: "https://default.example.com",
			getBaseURL(clusterCode: string) {
				return `https://${clusterCode}.example.com`
			},
		})
		const callOrder: string[] = []

		const dispose = client.addRequestInterceptor((config) => {
			callOrder.push("disposed")
			return config
		})

		dispose()
		await client.get("/dispose")

		expect(callOrder).toEqual([])
	})

	it("uses the rewritten baseURL after request interceptors finish", async () => {
		const client = new HttpClient({
			baseURL: "https://stale.example.com",
			getBaseURL(clusterCode: string) {
				return `https://${clusterCode}.example.com`
			},
		})

		client.addRequestInterceptor((config) => {
			config.baseURL = "https://latest.example.com"
			return config
		})
		client.addRequestInterceptor((config) => {
			config.headers?.set("x-base-url", config.baseURL || "")
			return config
		})

		await client.get("/rewritten")

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"https://latest.example.com/rewritten",
			expect.objectContaining({
				headers: expect.any(Headers),
			}),
		)

		const [, requestInit] = vi.mocked(globalThis.fetch).mock.calls[0]
		const headers = requestInit?.headers as Headers
		expect(headers.get("x-base-url")).toBe("https://latest.example.com")
	})

	it("supports prepending response interceptors", async () => {
		const client = new HttpClient({
			baseURL: "https://default.example.com",
			getBaseURL(clusterCode: string) {
				return `https://${clusterCode}.example.com`
			},
		})
		const callOrder: string[] = []

		client.addResponseInterceptor(async (context) => {
			callOrder.push("tail")
			return context
		})
		client.addResponseInterceptor(
			async (context) => {
				callOrder.push("head")
				return context
			},
			{ position: "head" },
		)

		await client.get("/response")

		expect(callOrder).toEqual(["head", "tail"])
	})
})
