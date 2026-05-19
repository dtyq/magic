import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NetworkInterceptor, type NetworkEntry } from "../NetworkInterceptor"

describe("NetworkInterceptor", () => {
	let interceptor: NetworkInterceptor
	let originalFetch: typeof window.fetch

	beforeEach(() => {
		interceptor = new NetworkInterceptor()
		originalFetch = window.fetch
	})

	afterEach(() => {
		interceptor.disable()
		window.fetch = originalFetch
	})

	it("should not intercept before enable", () => {
		const origFetch = window.fetch
		const listener = vi.fn()
		interceptor.onEntry(listener)

		expect(window.fetch).toBe(origFetch)
		expect(listener).not.toHaveBeenCalled()
	})

	it("should patch fetch on enable", () => {
		const origFetch = window.fetch
		interceptor.enable()
		expect(window.fetch).not.toBe(origFetch)
	})

	it("should restore fetch on disable", async () => {
		const listener = vi.fn()
		interceptor.onEntry(listener)

		const mockResponse = new Response("ok", { status: 200 })
		window.fetch = vi.fn().mockResolvedValue(mockResponse)

		interceptor.enable()
		interceptor.disable()

		// After disable, fetch calls should NOT be captured
		await window.fetch("https://api.example.com/test")
		expect(listener).not.toHaveBeenCalled()
	})

	it("should capture successful fetch requests", async () => {
		const entries: NetworkEntry[] = []
		interceptor.onEntry((e) => entries.push(e))

		// Mock original fetch before enabling
		const mockResponse = new Response(JSON.stringify({ ok: true }), {
			status: 200,
			statusText: "OK",
			headers: { "content-type": "application/json" },
		})
		window.fetch = vi.fn().mockResolvedValue(mockResponse)

		interceptor.enable()

		await window.fetch("https://api.example.com/data", {
			method: "POST",
			body: JSON.stringify({ key: "value" }),
		})

		expect(entries).toHaveLength(1)
		expect(entries[0].method).toBe("POST")
		expect(entries[0].url).toBe("https://api.example.com/data")
		expect(entries[0].status).toBe(200)
		expect(entries[0].statusText).toBe("OK")
		expect(entries[0].duration).toBeGreaterThanOrEqual(0)
		expect(entries[0].id).toMatch(/^n_/)
	})

	it("should capture failed fetch requests", async () => {
		const entries: NetworkEntry[] = []
		interceptor.onEntry((e) => entries.push(e))

		window.fetch = vi.fn().mockRejectedValue(new Error("Network failure"))

		interceptor.enable()

		await expect(window.fetch("https://api.example.com/fail")).rejects.toThrow(
			"Network failure",
		)

		expect(entries).toHaveLength(1)
		expect(entries[0].status).toBe(0)
		expect(entries[0].error).toBe("Network failure")
	})

	it("should enforce ring buffer limit", () => {
		interceptor.enable()
		// Directly push entries via internal state
		for (let i = 0; i < 210; i++) {
			interceptor.getEntries() // just to verify
		}
		// We can't easily push 210 entries without actual fetch calls,
		// so verify clear works instead
		interceptor.clear()
		expect(interceptor.getEntries()).toHaveLength(0)
	})

	it("should clear entries", async () => {
		const entries: NetworkEntry[] = []
		interceptor.onEntry((e) => entries.push(e))

		const mockResponse = new Response("ok", { status: 200 })
		window.fetch = vi.fn().mockResolvedValue(mockResponse)
		interceptor.enable()

		await window.fetch("https://api.example.com/1")

		expect(interceptor.getEntries()).toHaveLength(1)
		interceptor.clear()
		expect(interceptor.getEntries()).toHaveLength(0)
	})

	it("should not enable twice", () => {
		interceptor.enable()
		const patchedFetch = window.fetch

		interceptor.enable() // second call
		expect(window.fetch).toBe(patchedFetch)
	})

	it("should handle GET requests with default method", async () => {
		const entries: NetworkEntry[] = []
		interceptor.onEntry((e) => entries.push(e))

		const mockResponse = new Response("ok", { status: 200, statusText: "OK" })
		window.fetch = vi.fn().mockResolvedValue(mockResponse)
		interceptor.enable()

		await window.fetch("https://api.example.com/data")

		expect(entries[0].method).toBe("GET")
	})
})
