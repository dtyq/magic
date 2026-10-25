import { describe, expect, it, vi } from "vitest"
import type { CanvasEvent } from "../../../../runtime/core/EventEmitter"
import { createLayerRefreshScheduler } from "../layerRefreshScheduler"

describe("createLayerRefreshScheduler", () => {
	it("coalesces media display events that arrive within the same frame", () => {
		let flushFrame: (() => void) | undefined
		const cancelFrame = vi.fn()
		const scheduleFrame = vi.fn((callback: () => void) => {
			flushFrame = callback
			return cancelFrame
		})
		const scheduler = createLayerRefreshScheduler(scheduleFrame)
		const update = vi.fn()

		scheduler.schedule(update, {
			type: "element:image:resultUpdated",
			data: { elementId: "image-1" },
		} as CanvasEvent)
		scheduler.schedule(update, {
			type: "element:video:generate-submit-started",
			data: { elementId: "video-1" },
		} as CanvasEvent)

		expect(scheduleFrame).toHaveBeenCalledTimes(1)
		expect(update).not.toHaveBeenCalled()

		flushFrame?.()
		expect(update).toHaveBeenCalledTimes(1)
	})

	it("keeps element changes synchronous and cancels a redundant pending frame", () => {
		const cancelFrame = vi.fn()
		const scheduleFrame = vi.fn(() => cancelFrame)
		const scheduler = createLayerRefreshScheduler(scheduleFrame)
		const update = vi.fn()

		scheduler.schedule(update, {
			type: "element:image:ossSrcReady",
			data: { elementId: "image-1" },
		} as CanvasEvent)
		scheduler.schedule(update, {
			type: "element:change",
			data: { elementIds: ["image-1"], phase: "commit" },
		} as CanvasEvent)

		expect(cancelFrame).toHaveBeenCalledTimes(1)
		expect(update).toHaveBeenCalledTimes(1)
	})
})
