import { afterEach, describe, expect, it, vi } from "vitest"
import { scheduleFileManagerRename } from "../scheduleFileManagerRename"

describe("scheduleFileManagerRename", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("starts rename on the next macrotask so menu close can restore trigger focus first", () => {
		vi.useFakeTimers()
		const start = vi.fn()

		scheduleFileManagerRename(start)
		expect(start).not.toHaveBeenCalled()

		vi.runAllTimers()
		expect(start).toHaveBeenCalledTimes(1)
	})

	it("does not start rename after the scheduled callback is cancelled", () => {
		vi.useFakeTimers()
		const start = vi.fn()

		const cancel = scheduleFileManagerRename(start)
		cancel()
		vi.runAllTimers()
		expect(start).not.toHaveBeenCalled()
	})
})
