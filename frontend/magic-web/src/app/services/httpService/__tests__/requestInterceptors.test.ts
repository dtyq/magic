import { describe, expect, it, vi } from "vitest"
import { createMagicClient } from "@/infrastructure/network/http/clients/createMagicClient"
import type { HttpRequestSnapshot } from "../types"
import { createBusinessHeadersInterceptor } from "../interceptors/request/businessHeaders"

const scope: HttpRequestSnapshot = {
	scopeId: "local",
	sessionEpoch: 0,
	authorization: "local-token",
	organizationCode: "local-org",
	language: "zh_CN",
	baseURL: "https://local.test",
}
const createInterceptor = (respectAuthorizationFlag = false, restrictContextOrigin = false) =>
	createBusinessHeadersInterceptor({
		createRequestId: () => "request-1",
		respectAuthorizationFlag,
		restrictContextOrigin,
	})

describe("application request headers", () => {
	it("assembles service headers and destination from the supplied snapshot", async () => {
		const config = await createInterceptor()({ headers: new Headers(), url: "/info" }, scope)
		expect(config.baseURL).toBe("https://local.test")
		expect(Object.fromEntries(config.headers!)).toEqual({
			authorization: "local-token",
			"organization-code": "local-org",
			language: "zh_CN",
			"request-id": "request-1",
			"content-type": "application/json",
		})
	})

	it.each([false, true])(
		"preserves explicit authorization and organization (opt-out=%s)",
		async (flag) => {
			const headers = new Headers({
				authorization: "explicit",
				"organization-code": "explicit-org",
			})
			await createInterceptor(flag)({ headers, enableAuthorization: false }, scope)
			expect(headers.get("authorization")).toBe("explicit")
			expect(headers.get("organization-code")).toBe("explicit-org")
		},
	)

	it.each([
		[false, "local-token"],
		[true, null],
	] as const)(
		"preserves the per-client authorization flag policy (%s)",
		async (flag, expected) => {
			const headers = new Headers()
			await createInterceptor(flag)({ headers, enableAuthorization: false }, scope)
			expect(headers.get("authorization")).toBe(expected)
		},
	)

	it("leaves FormData content type to the browser", async () => {
		const headers = new Headers()
		await createInterceptor()({ headers, body: new FormData() }, scope)
		expect(headers.has("Content-Type")).toBe(false)
	})

	it.each(["https://other.test/info", "//other.test/info"])(
		"rejects borrowing popup credentials for %s",
		(url) => {
			expect(() =>
				createInterceptor(false, true)({ headers: new Headers(), url }, scope),
			).toThrow("HTTP context cannot authorize another service origin")
		},
	)

	it("allows same-origin requests and explicit cross-origin credentials", async () => {
		const interceptor = createInterceptor(false, true)
		const same = await interceptor(
			{ headers: new Headers(), url: "https://local.test/info" },
			scope,
		)
		expect(same.headers!.get("authorization")).toBe("local-token")
		const explicit = await interceptor(
			{ headers: new Headers({ authorization: "explicit" }), url: "https://other.test/info" },
			scope,
		)
		expect(explicit.headers!.get("authorization")).toBe("explicit")
	})

	it.each(["generated", "explicit", "callback"])(
		"preserves snapshot and %s ID across retry",
		async (source) => {
			let language = "zh_CN"
			let nextId = 0
			const generate = vi.fn(() => `request-${++nextId}`)
			const resolve = vi.fn(() => ({ ...scope, language }))
			const fetcher = vi.fn<typeof fetch>(
				async () =>
					new Response(JSON.stringify({ data: "ok" }), {
						headers: { "Content-Type": "application/json" },
					}),
			)
			const owner = createMagicClient({
				baseURL: "https://local.test",
				fetch: fetcher,
				context: { resolve, isCurrent: () => true },
				readiness: { wait: async () => {} },
				requestInterceptors: [
					// Header replacement must retain the captured scope for later policies and retries.
					(config) => ({ ...config, headers: new Headers(config.headers) }),
					createBusinessHeadersInterceptor({
						createRequestId: generate,
						respectAuthorizationFlag: false,
					}),
				],
				responseInterceptors: [
					async (context) => {
						language = "en_US"
						await context.http.retry({ ...context.request, authRetryAttempt: 1 })
						return context
					},
				],
			})
			try {
				await owner.client.post(
					"/info",
					{ value: 1 },
					{
						headers:
							source === "explicit"
								? { "request-id": "caller-id" }
								: source === "callback"
									? (headers) => {
											headers.set("request-id", "caller-id")
											return new Headers(headers)
										}
									: undefined,
					},
				)
				expect(resolve).toHaveBeenCalledOnce()
				expect(fetcher).toHaveBeenCalledTimes(2)
				expect(generate).toHaveBeenCalledTimes(source === "explicit" ? 0 : 1)
				for (const [, config] of fetcher.mock.calls) {
					expect((config?.headers as Headers).get("request-id")).toBe(
						source === "generated" ? "request-1" : "caller-id",
					)
					expect((config?.headers as Headers).get("language")).toBe("zh_CN")
					expect((config?.headers as Headers).get("authorization")).toBe("local-token")
				}
			} finally {
				owner.dispose()
			}
		},
	)
})
