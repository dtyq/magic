import { describe, expect, it, vi } from "vitest"
import { INIT_DOMAINS, InitializationStore } from "../initialization.store"

const baseKey = {
	magicId: "magic-id",
	organizationCode: "org-code",
	domain: INIT_DOMAINS.super,
} as const

describe("InitializationStore", () => {
	it("should dedupe concurrent initialization for the same key", async () => {
		const store = new InitializationStore()
		const initializer = vi.fn(async () => {
			await Promise.resolve()
			return "done"
		})

		const [first, second] = await Promise.all([
			store.runInitialization(baseKey, initializer),
			store.runInitialization(baseKey, initializer),
		])

		expect(first).toBe("done")
		expect(second).toBe("done")
		expect(initializer).toHaveBeenCalledTimes(1)
		expect(store.isInitialized(baseKey)).toBe(true)
		expect(store.isInitializing(baseKey)).toBe(false)
	})

	it("should not mark initialization as completed when initializer fails", async () => {
		const store = new InitializationStore()
		const error = new Error("init failed")

		await expect(
			store.runInitialization(baseKey, async () => Promise.reject(error)),
		).rejects.toThrow("init failed")

		expect(store.isInitialized(baseKey)).toBe(false)
		expect(store.isInitializing(baseKey)).toBe(false)
	})
})
