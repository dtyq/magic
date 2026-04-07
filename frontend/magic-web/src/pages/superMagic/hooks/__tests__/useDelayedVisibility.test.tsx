import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useDelayedVisibility } from "../useDelayedVisibility"

describe("useDelayedVisibility", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("shows the value after the configured delay", () => {
		vi.useFakeTimers()

		const { result, rerender } = renderHook(
			({ visible }) =>
				useDelayedVisibility({
					visible,
					delayMs: 180,
				}),
			{
				initialProps: { visible: false },
			},
		)

		expect(result.current).toBe(false)

		rerender({ visible: true })
		expect(result.current).toBe(false)

		act(() => {
			vi.advanceTimersByTime(179)
		})
		expect(result.current).toBe(false)

		act(() => {
			vi.advanceTimersByTime(1)
		})
		expect(result.current).toBe(true)
	})

	it("hides immediately when the value turns false", () => {
		vi.useFakeTimers()

		const { result, rerender } = renderHook(
			({ visible }) =>
				useDelayedVisibility({
					visible,
					delayMs: 180,
				}),
			{
				initialProps: { visible: true },
			},
		)

		act(() => {
			vi.advanceTimersByTime(180)
		})
		expect(result.current).toBe(true)

		rerender({ visible: false })
		expect(result.current).toBe(false)
	})

	it("cancels pending visibility changes when hidden early", () => {
		vi.useFakeTimers()

		const { result, rerender } = renderHook(
			({ visible }) =>
				useDelayedVisibility({
					visible,
					delayMs: 180,
				}),
			{
				initialProps: { visible: false },
			},
		)

		rerender({ visible: true })

		act(() => {
			vi.advanceTimersByTime(100)
		})

		rerender({ visible: false })

		act(() => {
			vi.advanceTimersByTime(200)
		})

		expect(result.current).toBe(false)
	})
})
