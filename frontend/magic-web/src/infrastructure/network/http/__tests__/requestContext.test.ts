import { describe, expect, it, vi } from "vitest"
import { RequestContext } from "../interceptors/requestContext"
import { createMagicClient } from "../clients/createMagicClient"

describe("opaque request context", () => {
	it("preserves an arbitrary typed payload across header replacement and retry", () => {
		const original = { revision: 1, partition: "one" }
		let current = original
		const resolve = vi.fn(() => current)
		const context = new RequestContext({
			resolve,
			isCurrent: () => true,
			getKey: ({ partition }) => partition,
		})
		const request = { headers: new Headers() }
		context.capture(request)
		current = { revision: 2, partition: "two" }
		const retry = { headers: new Headers(request.headers), authRetryAttempt: 1 as const }
		context.copy(request.headers, retry.headers)
		context.capture(retry)
		expect(context.getSnapshot(retry)).toBe(original)
		expect(context.getKey(retry)).toBe("one")
		expect(resolve).toHaveBeenCalledOnce()
		expect([...retry.headers]).toEqual([])
	})

	it("rejects stale scopes before applying further effects", () => {
		let revision = 0
		const context = new RequestContext({
			resolve: () => ({ revision }),
			isCurrent: (snapshot) => snapshot.revision === revision,
		})
		const request = { headers: new Headers() }
		context.capture(request)
		revision++
		expect(() => context.assertCurrent(request)).toThrow("Stale HTTP scope")
	})

	it("rejects retries without an original snapshot instead of resolving current state", () => {
		const resolve = vi.fn(() => ({}))
		const context = new RequestContext({ resolve, isCurrent: () => true })
		expect(() => context.capture({ headers: new Headers(), authRetryAttempt: 1 })).toThrow(
			"Missing HTTP request context",
		)
		expect(resolve).not.toHaveBeenCalled()
	})

	it("does not share request metadata across instances", () => {
		const provider = { resolve: () => ({}), isCurrent: () => true }
		const a = new RequestContext(provider)
		const b = new RequestContext(provider)
		const request = { headers: new Headers() }
		a.capture(request)
		expect(() => b.getSnapshot(request)).toThrow("Missing HTTP request context")
	})

	it("disables request sharing when the application supplies no partition key", async () => {
		const fetcher = vi.fn<typeof fetch>(
			async () =>
				new Response(JSON.stringify({ data: 1 }), {
					headers: { "Content-Type": "application/json" },
				}),
		)
		const owner = createMagicClient({
			baseURL: "https://example.test",
			fetch: fetcher,
			context: { resolve: () => ({}), isCurrent: () => true },
			readiness: { wait: () => Promise.resolve() },
		})
		try {
			await Promise.all([
				owner.client.get("/same", { enableRequestUnion: true }),
				owner.client.get("/same", { enableRequestUnion: true }),
			])
			expect(fetcher).toHaveBeenCalledTimes(2)
		} finally {
			owner.dispose()
		}
	})
})
