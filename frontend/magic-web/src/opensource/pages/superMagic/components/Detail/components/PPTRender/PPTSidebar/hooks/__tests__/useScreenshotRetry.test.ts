import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useScreenshotRetry } from "../useScreenshotRetry"

describe("useScreenshotRetry", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	it("should not retry when there is no error", () => {
		const onRetry = vi.fn()
		const { result } = renderHook(() =>
			useScreenshotRetry({
				hasError: false,
				isLoading: false,
				hasThumbnail: false,
				onRetry,
			}),
		)

		expect(result.current.retryCount).toBe(0)
		expect(result.current.canRetry).toBe(false)
		expect(onRetry).not.toHaveBeenCalled()
	})

	it("should auto-retry with exponential backoff when error occurs", async () => {
		const onRetry = vi.fn()
		const { result, rerender } = renderHook(
			({ hasError }) =>
				useScreenshotRetry({
					hasError,
					isLoading: false,
					hasThumbnail: false,
					onRetry,
				}),
			{
				initialProps: { hasError: false },
			},
		)

		// Trigger error
		rerender({ hasError: true })

		// First retry after 2s
		act(() => {
			vi.advanceTimersByTime(2000)
		})
		expect(onRetry).toHaveBeenCalledTimes(1)

		// Second retry after 4s
		act(() => {
			vi.advanceTimersByTime(4000)
		})
		expect(onRetry).toHaveBeenCalledTimes(2)

		// Third retry after 8s
		act(() => {
			vi.advanceTimersByTime(8000)
		})
		expect(onRetry).toHaveBeenCalledTimes(3)

		// Should not retry more than maxRetries
		act(() => {
			vi.advanceTimersByTime(16000)
		})
		expect(onRetry).toHaveBeenCalledTimes(3)
	})

	it("should stop retrying when thumbnail is loaded", () => {
		const onRetry = vi.fn()
		const { result, rerender } = renderHook(
			({ hasError, hasThumbnail }) =>
				useScreenshotRetry({
					hasError,
					isLoading: false,
					hasThumbnail,
					onRetry,
				}),
			{
				initialProps: { hasError: true, hasThumbnail: false },
			},
		)

		// Simulate thumbnail loaded
		rerender({ hasError: false, hasThumbnail: true })

		expect(result.current.retryCount).toBe(0)
		expect(result.current.canRetry).toBe(false)

		// Should not retry
		act(() => {
			vi.advanceTimersByTime(10000)
		})
		expect(onRetry).not.toHaveBeenCalled()
	})

	it("should allow manual retry and reset count", () => {
		const onRetry = vi.fn()
		const { result } = renderHook(() =>
			useScreenshotRetry({
				hasError: true,
				isLoading: false,
				hasThumbnail: false,
				onRetry,
				maxRetries: 1,
			}),
		)

		// First auto-retry
		act(() => {
			vi.advanceTimersByTime(2000)
		})
		expect(onRetry).toHaveBeenCalledTimes(1)

		// Now canRetry should be true (reached max retries)
		expect(result.current.canRetry).toBe(true)

		// Manual retry should reset count
		act(() => {
			result.current.manualRetry()
		})
		expect(onRetry).toHaveBeenCalledTimes(2)
		expect(result.current.retryCount).toBe(0)
	})

	it("should not retry when isLoading is true", () => {
		const onRetry = vi.fn()
		renderHook(() =>
			useScreenshotRetry({
				hasError: true,
				isLoading: true,
				hasThumbnail: false,
				onRetry,
			}),
		)

		act(() => {
			vi.advanceTimersByTime(5000)
		})

		expect(onRetry).not.toHaveBeenCalled()
	})

	it("should respect custom maxRetries and baseRetryDelay", () => {
		const onRetry = vi.fn()
		renderHook(() =>
			useScreenshotRetry({
				hasError: true,
				isLoading: false,
				hasThumbnail: false,
				onRetry,
				maxRetries: 2,
				baseRetryDelay: 1000,
			}),
		)

		// First retry after 1s
		act(() => {
			vi.advanceTimersByTime(1000)
		})
		expect(onRetry).toHaveBeenCalledTimes(1)

		// Second retry after 2s
		act(() => {
			vi.advanceTimersByTime(2000)
		})
		expect(onRetry).toHaveBeenCalledTimes(2)

		// Should not retry more (maxRetries = 2)
		act(() => {
			vi.advanceTimersByTime(10000)
		})
		expect(onRetry).toHaveBeenCalledTimes(2)
	})

	it("should clean up timeout on unmount", () => {
		const onRetry = vi.fn()
		const { unmount } = renderHook(() =>
			useScreenshotRetry({
				hasError: true,
				isLoading: false,
				hasThumbnail: false,
				onRetry,
			}),
		)

		unmount()

		// Should not retry after unmount
		act(() => {
			vi.advanceTimersByTime(10000)
		})
		expect(onRetry).not.toHaveBeenCalled()
	})
})
