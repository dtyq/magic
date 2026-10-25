import { describe, expect, it, vi } from "vitest"
import { createMagicClient } from "@/infrastructure/network/http/clients/createMagicClient"
import type { ResponseInterceptor } from "@/infrastructure/network/http/clients/types"
import { generateUnauthorizedResInterceptor } from "../interceptors/response/unauthorized"
import { generateSuccessResInterceptor } from "../interceptors/response/businessResponse"
import { generateInvalidOrgResInterceptor } from "../interceptors/response/invalidOrganization"
import { BusinessResponseCode } from "@/infrastructure/network/http/clients/magicResponse"
import { createBusinessHeadersInterceptor } from "../interceptors/request/businessHeaders"
import { generatePlatformUnauthorizedResInterceptor } from "../interceptors/response/platformUnauthorized"

const response = (code: number | string, status = 200) =>
	new Response(JSON.stringify({ code, data: "ok", message: "failed" }), {
		status,
		headers: { "Content-Type": "application/json" },
	})
function createClient(fetch: typeof globalThis.fetch, interceptors: ResponseInterceptor[]) {
	return createMagicClient({
		baseURL: "https://original.test",
		fetch,
		context: {
			resolve: () => ({
				scopeId: "test",
				sessionEpoch: 0,
				language: "en_US",
				authorization: "test-token",
			}),
			isCurrent: () => true,
		},
		readiness: { wait: () => Promise.resolve() },
		requestInterceptors: [
			createBusinessHeadersInterceptor({
				createRequestId: () => "test-id",
				respectAuthorizationFlag: false,
			}),
		],
		responseInterceptors: interceptors,
	})
}

describe("application response interceptor dependencies", () => {
	// Expectations follow HEAD's interceptor conditions, including its non-obvious flag semantics.
	it.each([
		{ code: 1000, status: 200, verify: true, prompt: true, events: [], success: true },
		{
			code: 1000,
			status: 401,
			verify: true,
			prompt: true,
			events: ["invalidate:token-expired"],
			success: false,
		},
		{ code: 1000, status: 401, verify: false, prompt: true, events: [], success: true },
		{ code: 1000, status: 500, verify: true, prompt: true, events: [], success: true },
		{
			code: 3103,
			status: 200,
			verify: false,
			prompt: false,
			events: ["invalidate:token-expired"],
			success: false,
		},
		{
			code: 2155,
			status: 200,
			verify: false,
			prompt: false,
			events: ["invalidate:token-expired"],
			success: false,
		},
		{
			code: 2179,
			status: 200,
			verify: false,
			prompt: false,
			events: ["invalidate:account-unauthorized"],
			success: false,
		},
		{
			code: "2179",
			status: 200,
			verify: true,
			prompt: true,
			events: ["toast"],
			success: false,
		},
		{
			code: 40101,
			status: 200,
			verify: true,
			prompt: true,
			events: ["organization", "toast"],
			success: false,
		},
		{
			code: 40101,
			status: 200,
			verify: true,
			prompt: false,
			events: ["organization"],
			success: false,
		},
		{ code: 70007, status: 200, verify: true, prompt: true, events: ["toast"], success: false },
		{ code: 70007, status: 200, verify: true, prompt: false, events: [], success: false },
		{ code: 5000, status: 200, verify: true, prompt: true, events: ["toast"], success: false },
		{ code: 5000, status: 200, verify: true, prompt: false, events: [], success: false },
	])("preserves code=$code status=$status verify=$verify prompt=$prompt", async (scenario) => {
		const events: string[] = []
		const toast = () => {
			events.push("toast")
		}
		const fetcher = vi.fn<typeof fetch>(async () => response(scenario.code, scenario.status))
		const owner = createClient(fetcher, [
			generateUnauthorizedResInterceptor({
				getAccount: () => undefined,
				getBaseURL: () => "",
				invalidate: async (_id, reason) => {
					events.push(`invalidate:${reason}`)
				},
			}),
			generateInvalidOrgResInterceptor(() => {
				events.push("organization")
			}),
			generatePlatformUnauthorizedResInterceptor(toast),
			generateSuccessResInterceptor(toast),
		])
		try {
			const request = owner.client.get("/info", {
				enableAuthorizationVerification: scenario.verify,
				enableErrorMessagePrompt: scenario.prompt,
			})
			if (scenario.success) await expect(request).resolves.toBe("ok")
			else await expect(request).rejects.toBeDefined()
			expect(events).toEqual(scenario.events)
			expect(fetcher).toHaveBeenCalledOnce()
		} finally {
			owner.dispose()
		}
	})

	it("retries against the resolved account cluster without changing the default client address", async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValueOnce(response(401, 401))
			.mockResolvedValue(response(BusinessResponseCode.Success))
		const invalidate = vi.fn()
		const toast = vi.fn()
		const owner = createClient(fetch, [
			generateUnauthorizedResInterceptor({
				getAccount: () => ({ magic_id: "account", deployCode: "b" }),
				getBaseURL: () => "https://account-b.test",
				invalidate,
			}),
			generateSuccessResInterceptor(toast),
		])
		try {
			await expect(owner.client.get("/info")).resolves.toBe("ok")
			expect(fetch.mock.calls.map(([url]) => url)).toEqual([
				"https://original.test/info",
				"https://account-b.test/info",
			])
			await owner.client.get("/next")
			expect(fetch).toHaveBeenLastCalledWith("https://original.test/next", expect.anything())
			expect(invalidate).not.toHaveBeenCalled()
			expect(toast).not.toHaveBeenCalled()
		} finally {
			owner.dispose()
		}
	})

	it("limits recovery to one retry and invokes the injected invalidation once", async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockImplementation(async () => response(401, 401))
		const invalidate = vi.fn()
		const owner = createClient(fetch, [
			generateUnauthorizedResInterceptor({
				getAccount: () => ({ magic_id: "account", deployCode: "b" }),
				getBaseURL: () => "https://account-b.test",
				invalidate,
			}),
		])
		try {
			await expect(owner.client.get("/info")).rejects.toThrow("Unauthorized")
			expect(fetch).toHaveBeenCalledTimes(2)
			expect(invalidate).toHaveBeenCalledExactlyOnceWith("account", "token-expired")
		} finally {
			owner.dispose()
		}
	})

	it("runs dedicated organization handling before the generic error and respects caller prompt suppression", async () => {
		const events: string[] = []
		const toast = vi.fn(() => events.push("toast"))
		const owner = createClient(
			async () => response(BusinessResponseCode.InvalidOrganization),
			[
				generateInvalidOrgResInterceptor(() => {
					events.push("organization")
				}),
				generateSuccessResInterceptor(toast),
			],
		)
		try {
			await expect(owner.client.get("/info")).rejects.toMatchObject({
				code: BusinessResponseCode.InvalidOrganization,
			})
			expect(events).toEqual(["organization", "toast"])
			events.length = 0
			toast.mockClear()
			await expect(
				owner.client.get("/info", { enableErrorMessagePrompt: false }),
			).rejects.toMatchObject({ code: BusinessResponseCode.InvalidOrganization })
			expect(events).toEqual(["organization"])
			expect(toast).not.toHaveBeenCalled()
		} finally {
			owner.dispose()
		}
	})

	it("stops the remaining response chain when organization handling changes the current scope", async () => {
		let revision = 0
		const events: string[] = []
		const owner = createMagicClient({
			baseURL: "https://original.test",
			fetch: async () => response(BusinessResponseCode.InvalidOrganization),
			context: {
				resolve: () => ({ revision }),
				isCurrent: (snapshot) => snapshot.revision === revision,
			},
			readiness: { wait: () => Promise.resolve() },
			responseInterceptors: [
				generateInvalidOrgResInterceptor(() => {
					// The real UserService setter changes the organization synchronously.
					revision++
					events.push("organization", "reload")
				}),
				generateSuccessResInterceptor(() => {
					events.push("toast")
				}),
			],
		})
		try {
			await expect(owner.client.get("/info")).rejects.toMatchObject({ name: "AbortError" })
			expect(events).toEqual(["organization", "reload"])
		} finally {
			owner.dispose()
		}
	})
})
