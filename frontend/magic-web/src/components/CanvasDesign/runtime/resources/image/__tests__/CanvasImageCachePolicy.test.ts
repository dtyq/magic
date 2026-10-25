import { afterEach, describe, expect, it, vi } from "vitest"
import { resolveCanvasImageDecodedCacheBudgets } from "../CanvasImageCachePolicy"

const MIB = 1024 * 1024

describe("resolveCanvasImageDecodedCacheBudgets", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})
	it("keeps every variant budget inside the total hard budget relationship", () => {
		const budgets = resolveCanvasImageDecodedCacheBudgets()
		expect(budgets.lowBytes + budgets.previewBytes).toBeLessThanOrEqual(budgets.totalHardBytes)
		expect(budgets.totalSoftBytes).toBeLessThanOrEqual(budgets.totalHardBytes)
	})

	it("uses the default budget when device memory is unavailable", () => {
		expect(resolveCanvasImageDecodedCacheBudgets()).toEqual({
			lowBytes: 80 * MIB,
			previewBytes: 80 * MIB,
			fullBytes: 128 * MIB,
			totalSoftBytes: 160 * MIB,
			totalHardBytes: 224 * MIB,
		})
	})

	it("keeps the full decoded cache bounded on low-memory devices", () => {
		vi.stubGlobal("navigator", { deviceMemory: 4 })

		expect(resolveCanvasImageDecodedCacheBudgets()).toMatchObject({
			fullBytes: 64 * MIB,
			totalHardBytes: 160 * MIB,
		})
	})
})
