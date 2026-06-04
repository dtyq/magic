import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useScrollEdgeFadeMask } from "../useScrollEdgeFadeMask"

beforeEach(() => {
	class MockResizeObserver {
		observe = vi.fn()
		disconnect = vi.fn()
	}

	vi.stubGlobal("ResizeObserver", MockResizeObserver)
	vi.stubGlobal(
		"requestAnimationFrame",
		vi.fn((callback: FrameRequestCallback) => {
			callback(0)
			return 1
		}),
	)
	vi.stubGlobal("cancelAnimationFrame", vi.fn())
})

function createScrollElement(metrics: {
	scrollTop: number
	clientHeight: number
	scrollHeight: number
}) {
	const listeners = new Set<() => void>()
	const element = {
		scrollTop: metrics.scrollTop,
		clientHeight: metrics.clientHeight,
		scrollHeight: metrics.scrollHeight,
		addEventListener: vi.fn((_type: string, listener: () => void) => {
			listeners.add(listener)
		}),
		removeEventListener: vi.fn((_type: string, listener: () => void) => {
			listeners.delete(listener)
		}),
		dispatchScroll() {
			listeners.forEach((listener) => listener())
		},
	}

	return element as unknown as HTMLDivElement & { dispatchScroll: () => void }
}

describe("useScrollEdgeFadeMask", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("hides top mask and shows bottom mask at scroll start", () => {
		const scrollElement = createScrollElement({
			scrollTop: 0,
			clientHeight: 200,
			scrollHeight: 500,
		})

		const { result } = renderHook(() => useScrollEdgeFadeMask())

		act(() => {
			result.current.scrollRef.current = scrollElement
			result.current.onScroll()
		})

		expect(result.current.showTopMask).toBe(false)
		expect(result.current.showBottomMask).toBe(true)
	})

	it("shows top mask after scrolling past threshold", () => {
		const scrollElement = createScrollElement({
			scrollTop: 8,
			clientHeight: 200,
			scrollHeight: 500,
		})

		const { result } = renderHook(() => useScrollEdgeFadeMask())

		act(() => {
			result.current.scrollRef.current = scrollElement
			result.current.onScroll()
		})

		expect(result.current.showTopMask).toBe(true)
		expect(result.current.showBottomMask).toBe(true)
	})

	it("does not re-subscribe scroll listener when inline contentDeps values are unchanged", () => {
		const addEventListenerSpy = vi.spyOn(HTMLElement.prototype, "addEventListener")
		const scrollElement = createScrollElement({
			scrollTop: 0,
			clientHeight: 200,
			scrollHeight: 500,
		})

		const { result, rerender } = renderHook(
			({ deps }) => useScrollEdgeFadeMask({ contentDeps: deps }),
			{
				initialProps: { deps: [0, false] as const },
			},
		)

		act(() => {
			result.current.scrollRef.current = scrollElement
		})

		const scrollListenerCallsAfterMount = addEventListenerSpy.mock.calls.filter(
			([event]) => event === "scroll",
		).length

		rerender({ deps: [0, false] })

		const scrollListenerCallsAfterRerender = addEventListenerSpy.mock.calls.filter(
			([event]) => event === "scroll",
		).length

		expect(scrollListenerCallsAfterRerender).toBe(scrollListenerCallsAfterMount)

		addEventListenerSpy.mockRestore()
	})

	it("hides bottom mask when scrolled to the end", () => {
		const scrollElement = createScrollElement({
			scrollTop: 300,
			clientHeight: 200,
			scrollHeight: 500,
		})

		const { result } = renderHook(() => useScrollEdgeFadeMask())

		act(() => {
			result.current.scrollRef.current = scrollElement
			result.current.onScroll()
		})

		expect(result.current.showTopMask).toBe(true)
		expect(result.current.showBottomMask).toBe(false)
	})

	it("coalesces burst onScroll calls into a single animation frame", () => {
		const rafCallbacks: FrameRequestCallback[] = []
		const requestAnimationFrameSpy = vi.fn((callback: FrameRequestCallback) => {
			rafCallbacks.push(callback)
			return rafCallbacks.length
		})
		vi.stubGlobal("requestAnimationFrame", requestAnimationFrameSpy)
		vi.stubGlobal("cancelAnimationFrame", vi.fn())

		const scrollElement = createScrollElement({
			scrollTop: 8,
			clientHeight: 200,
			scrollHeight: 500,
		})
		const { result } = renderHook(() => useScrollEdgeFadeMask())

		act(() => {
			result.current.scrollRef.current = scrollElement
			result.current.onScroll()
			result.current.onScroll()
			result.current.onScroll()
		})

		expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)

		act(() => {
			rafCallbacks[0]?.(0)
		})

		act(() => {
			result.current.onScroll()
		})

		expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(2)
	})
})
