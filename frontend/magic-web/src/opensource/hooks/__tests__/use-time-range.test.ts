import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import useTimeRange from "../use-time-range"

describe("useTimeRange", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("should return true when current time is within range", () => {
		// Set current time to 2025-09-25 (within range)
		vi.setSystemTime(new Date("2025-09-25"))

		const { result } = renderHook(() =>
			useTimeRange({
				startTime: "2025-09-24",
				endTime: "2025-10-08",
			}),
		)

		expect(result.current).toBe(true)
	})

	it("should return false when current time is before range", () => {
		// Set current time to 2025-09-20 (before range)
		vi.setSystemTime(new Date("2025-09-20"))

		const { result } = renderHook(() =>
			useTimeRange({
				startTime: "2025-09-24",
				endTime: "2025-10-08",
			}),
		)

		expect(result.current).toBe(false)
	})

	it("should return false when current time is after range", () => {
		// Set current time to 2025-10-10 (after range)
		vi.setSystemTime(new Date("2025-10-10"))

		const { result } = renderHook(() =>
			useTimeRange({
				startTime: "2025-09-24",
				endTime: "2025-10-08",
			}),
		)

		expect(result.current).toBe(false)
	})

	it("should return true when current time equals start time", () => {
		// Set current time exactly to start time
		vi.setSystemTime(new Date("2025-09-24"))

		const { result } = renderHook(() =>
			useTimeRange({
				startTime: "2025-09-24",
				endTime: "2025-10-08",
			}),
		)

		expect(result.current).toBe(true)
	})

	it("should return true when current time equals end time (includeEnd: true)", () => {
		// Set current time exactly to end time
		vi.setSystemTime(new Date("2025-10-08"))

		const { result } = renderHook(() =>
			useTimeRange({
				startTime: "2025-09-24",
				endTime: "2025-10-08",
				includeEnd: true,
			}),
		)

		expect(result.current).toBe(true)
	})

	it("should return false when current time equals end time (includeEnd: false)", () => {
		// Set current time exactly to end time
		vi.setSystemTime(new Date("2025-10-08"))

		const { result } = renderHook(() =>
			useTimeRange({
				startTime: "2025-09-24",
				endTime: "2025-10-08",
				includeEnd: false,
			}),
		)

		expect(result.current).toBe(false)
	})

	it("should return false for invalid start time", () => {
		const { result } = renderHook(() =>
			useTimeRange({
				startTime: "invalid-date",
				endTime: "2025-10-08",
			}),
		)

		expect(result.current).toBe(false)
	})

	it("should return false for invalid end time", () => {
		const { result } = renderHook(() =>
			useTimeRange({
				startTime: "2025-09-24",
				endTime: "invalid-date",
			}),
		)

		expect(result.current).toBe(false)
	})

	it("should return false when start time is after end time", () => {
		const { result } = renderHook(() =>
			useTimeRange({
				startTime: "2025-10-08",
				endTime: "2025-09-24",
			}),
		)

		expect(result.current).toBe(false)
	})

	it("should work with Date objects", () => {
		vi.setSystemTime(new Date("2025-09-25"))

		const { result } = renderHook(() =>
			useTimeRange({
				startTime: new Date("2025-09-24"),
				endTime: new Date("2025-10-08"),
			}),
		)

		expect(result.current).toBe(true)
	})

	it("should work with timestamps", () => {
		vi.setSystemTime(new Date("2025-09-25"))

		const { result } = renderHook(() =>
			useTimeRange({
				startTime: new Date("2025-09-24").getTime(),
				endTime: new Date("2025-10-08").getTime(),
			}),
		)

		expect(result.current).toBe(true)
	})

	it("should automatically update when activity period starts", async () => {
		// Set initial time before activity starts
		vi.setSystemTime(new Date("2025-09-23T23:59:00.000Z"))

		const { result } = renderHook(() =>
			useTimeRange({
				startTime: "2025-09-24T00:00:00.000Z",
				endTime: "2025-10-08T00:00:00.000Z",
			}),
		)

		// Initially should be false (before activity starts)
		expect(result.current).toBe(false)

		// Advance time to activity start
		act(() => {
			vi.setSystemTime(new Date("2025-09-24T00:00:00.000Z"))
			vi.advanceTimersByTime(60000) // Advance 1 minute to trigger setTimeout
		})

		// Should now be true (activity started)
		expect(result.current).toBe(true)
	})

	it("should automatically update when activity period ends", async () => {
		// Set initial time during activity period
		vi.setSystemTime(new Date("2025-10-07T23:59:00.000Z"))

		const { result } = renderHook(() =>
			useTimeRange({
				startTime: "2025-09-24T00:00:00.000Z",
				endTime: "2025-10-08T00:00:00.000Z",
				includeEnd: false, // Don't include end time
			}),
		)

		// Initially should be true (during activity)
		expect(result.current).toBe(true)

		// Advance time to activity end
		act(() => {
			vi.setSystemTime(new Date("2025-10-08T00:00:00.000Z"))
			vi.advanceTimersByTime(60000) // Advance 1 minute to trigger setTimeout
		})

		// Should now be false (activity ended)
		expect(result.current).toBe(false)
	})

	it("should handle periodic updates correctly", async () => {
		// Set time close to activity start (within interval range)
		vi.setSystemTime(new Date("2025-09-23T23:50:00.000Z"))

		const { result } = renderHook(() =>
			useTimeRange({
				startTime: "2025-09-24T00:00:00.000Z",
				endTime: "2025-10-08T00:00:00.000Z",
				updateInterval: 60000, // 1 minute
			}),
		)

		// Initially should be false (10 minutes before start)
		expect(result.current).toBe(false)

		// Advance system time to during activity
		act(() => {
			vi.setSystemTime(new Date("2025-09-24T00:01:00.000Z"))
			// Advance timers to trigger periodic update
			vi.advanceTimersByTime(60 * 1000)
		})

		// Should now be true after periodic update
		expect(result.current).toBe(true)
	})

	it("should clean up timers when component unmounts", () => {
		// Set time close to activity start to ensure timers are set
		vi.setSystemTime(new Date("2025-09-23T23:59:30.000Z"))

		const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")
		const clearIntervalSpy = vi.spyOn(global, "clearInterval")

		const { unmount } = renderHook(() =>
			useTimeRange({
				startTime: "2025-09-24T00:00:00.000Z",
				endTime: "2025-10-08T00:00:00.000Z",
			}),
		)

		// Unmount the hook
		unmount()

		// Should have cleaned up at least one timer (timeout for precise timing)
		expect(clearTimeoutSpy).toHaveBeenCalled()

		clearTimeoutSpy.mockRestore()
		clearIntervalSpy.mockRestore()
	})

	it("should not set up timers for invalid timestamps", () => {
		const setTimeoutSpy = vi.spyOn(global, "setTimeout")
		const setIntervalSpy = vi.spyOn(global, "setInterval")

		renderHook(() =>
			useTimeRange({
				startTime: "invalid-date",
				endTime: "2025-10-08",
			}),
		)

		// Should not set up any timers due to invalid timestamp
		expect(setTimeoutSpy).not.toHaveBeenCalled()
		expect(setIntervalSpy).not.toHaveBeenCalled()

		setTimeoutSpy.mockRestore()
		setIntervalSpy.mockRestore()
	})

	it("should respect custom update interval", () => {
		// Set time close to activity period to ensure interval is set
		vi.setSystemTime(new Date("2025-09-23T23:58:00.000Z"))

		const setIntervalSpy = vi.spyOn(global, "setInterval")

		renderHook(() =>
			useTimeRange({
				startTime: "2025-09-24T00:00:00.000Z",
				endTime: "2025-10-08T00:00:00.000Z",
				updateInterval: 30000, // 30 seconds
			}),
		)

		// Should have been called with custom interval
		expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000)

		setIntervalSpy.mockRestore()
	})
})
