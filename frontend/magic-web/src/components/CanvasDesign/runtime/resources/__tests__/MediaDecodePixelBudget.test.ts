import { describe, expect, it } from "vitest"
import {
	DEFAULT_MEDIA_DECODE_CONCURRENT_PIXEL_BUDGET,
	MediaDecodePixelBudgetGate,
	estimateScaledPixelCost,
} from "../offline-cache/MediaDecodePixelBudget"

describe("MediaDecodePixelBudget", () => {
	it("estimates decode pixel cost from target dimensions", () => {
		expect(estimateScaledPixelCost(4000, 2000, 1536)).toBe(1536 * 768)
		expect(estimateScaledPixelCost(4000, 2000, 384)).toBe(384 * 192)
		expect(estimateScaledPixelCost(4000, 2000, 72)).toBe(72 * 36)
		expect(estimateScaledPixelCost(4000, 2000)).toBe(4000 * 2000)
	})

	it("queues decode permits by pixel budget and releases them by priority", async () => {
		const gate = new MediaDecodePixelBudgetGate(DEFAULT_MEDIA_DECODE_CONCURRENT_PIXEL_BUDGET)

		const firstRelease = await gate.acquire(
			DEFAULT_MEDIA_DECODE_CONCURRENT_PIXEL_BUDGET,
			"visible",
		)
		let backgroundResolved = false
		let visibleResolved = false
		const backgroundPermit = gate
			.acquire(DEFAULT_MEDIA_DECODE_CONCURRENT_PIXEL_BUDGET, "background")
			.then((release) => {
				backgroundResolved = true
				return release
			})
		const visiblePermit = gate
			.acquire(DEFAULT_MEDIA_DECODE_CONCURRENT_PIXEL_BUDGET, "visible")
			.then((release) => {
				visibleResolved = true
				return release
			})

		await Promise.resolve()
		expect(backgroundResolved).toBe(false)
		expect(visibleResolved).toBe(false)

		firstRelease()
		const visibleRelease = await visiblePermit
		expect(visibleResolved).toBe(true)
		expect(backgroundResolved).toBe(false)

		visibleRelease()
		const backgroundRelease = await backgroundPermit
		expect(backgroundResolved).toBe(true)
		backgroundRelease()
		expect(gate.activePixelCost).toBe(0)
	})

	it("skips an oversized request within the same priority band", async () => {
		const gate = new MediaDecodePixelBudgetGate(10)
		const firstRelease = await gate.acquire(8, "visible")
		let largeResolved = false
		const largePermit = gate.acquire(8, "visible").then((release) => {
			largeResolved = true
			return release
		})
		const smallPermit = gate.acquire(2, "visible")

		const smallRelease = await smallPermit
		expect(largeResolved).toBe(false)

		smallRelease()
		firstRelease()
		const largeRelease = await largePermit
		largeRelease()
		expect(gate.activePixelCost).toBe(0)
	})

	it("removes an aborted queued permit without waiting for capacity", async () => {
		const gate = new MediaDecodePixelBudgetGate(10)
		const firstRelease = await gate.acquire(10, "visible")
		const controller = new AbortController()
		const queuedPermit = gate.acquire(10, "near", controller.signal)

		expect(gate.queuedCount).toBe(1)
		const rejected = expect(queuedPermit).rejects.toMatchObject({ name: "AbortError" })
		controller.abort()
		await rejected

		expect(gate.queuedCount).toBe(0)
		firstRelease()
		expect(gate.activePixelCost).toBe(0)
	})

	it("does not leave an aborted signal in the queue when it is already aborted", async () => {
		const gate = new MediaDecodePixelBudgetGate(10)
		const firstRelease = await gate.acquire(10, "visible")
		const controller = new AbortController()
		controller.abort()

		await expect(gate.acquire(10, "near", controller.signal)).rejects.toMatchObject({
			name: "AbortError",
		})
		expect(gate.queuedCount).toBe(0)

		firstRelease()
		expect(gate.activePixelCost).toBe(0)
	})

	it("resolves queued permits during destroy and detaches their abort listeners", async () => {
		const gate = new MediaDecodePixelBudgetGate(10)
		const firstRelease = await gate.acquire(10, "visible")
		const controller = new AbortController()
		const queuedPermit = gate.acquire(10, "near", controller.signal)

		gate.destroy()
		const queuedRelease = await queuedPermit
		controller.abort()
		queuedRelease()
		firstRelease()

		expect(gate.queuedCount).toBe(0)
		expect(gate.activePixelCost).toBe(0)
	})
})
