import { describe, expect, it } from "vitest"
import type { InterceptorContext } from "@/infrastructure/network/http/clients"
import { iframeBusinessErrorInterceptor } from "@/infrastructure/network/http/clients/magicResponse"

function createContext(response: Partial<InterceptorContext["response"]>): InterceptorContext {
	return {
		http: {} as InterceptorContext["http"],
		request: { headers: new Headers() },
		response: {
			status: 200,
			statusText: "OK",
			headers: new Headers(),
			data: {},
			...response,
		},
	}
}

describe("iframeBusinessErrorInterceptor", () => {
	it("passes business success responses", async () => {
		const context = createContext({
			data: {
				code: 1000,
				data: { ok: true },
			},
		})

		await expect(iframeBusinessErrorInterceptor(context)).resolves.toEqual(context)
	})

	it("passes responses without business code", async () => {
		const context = createContext({
			data: {
				ok: true,
			},
		})

		await expect(iframeBusinessErrorInterceptor(context)).resolves.toEqual(context)
	})

	it("throws business error responses", async () => {
		const context = createContext({
			data: {
				code: 40001,
				message: "Permission denied",
				data: null,
			},
		})

		await expect(iframeBusinessErrorInterceptor(context)).rejects.toThrow("Permission denied")
	})

	it("throws non-2xx HTTP responses", async () => {
		const context = createContext({
			status: 403,
			statusText: "Forbidden",
			data: {
				message: "No access",
			},
		})

		await expect(iframeBusinessErrorInterceptor(context)).rejects.toThrow("No access")
	})
})
