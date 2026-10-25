import { afterEach, describe, expect, it, vi } from "vitest"

describe("requestIdleCallback polyfill entry", () => {
	const original = {
		requestIdleCallback: window.requestIdleCallback,
		cancelIdleCallback: window.cancelIdleCallback,
	}

	afterEach(() => {
		window.requestIdleCallback = original.requestIdleCallback
		window.cancelIdleCallback = original.cancelIdleCallback
		vi.resetModules()
	})

	it("defines requestIdleCallback synchronously when the browser lacks it", async () => {
		// @ts-expect-error simulate Safari, which has no requestIdleCallback
		delete window.requestIdleCallback
		// @ts-expect-error simulate Safari, which has no cancelIdleCallback
		delete window.cancelIdleCallback
		vi.resetModules()

		// Awaiting the import only waits for module evaluation, not for polyfillReady.
		await import("../index")

		expect(typeof window.requestIdleCallback).toBe("function")
		expect(typeof window.cancelIdleCallback).toBe("function")
	})

	it("keeps the native implementation when it exists", async () => {
		const native = vi.fn()
		window.requestIdleCallback = native as unknown as typeof window.requestIdleCallback
		vi.resetModules()

		await import("../index")

		expect(window.requestIdleCallback).toBe(native)
	})
})
