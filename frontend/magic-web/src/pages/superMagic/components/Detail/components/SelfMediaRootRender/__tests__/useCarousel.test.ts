import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useCarousel } from "../hooks/useCarousel"

function createPointerEvent(clientX: number) {
	return {
		clientX,
		pointerId: 1,
		button: 0,
		pointerType: "mouse",
		currentTarget: {
			setPointerCapture: () => undefined,
			releasePointerCapture: () => undefined,
		},
	} as any
}

function createWheelEvent(deltaY: number) {
	return {
		deltaX: 0,
		deltaY,
		preventDefault: () => undefined,
		stopPropagation: () => undefined,
	} as any
}

describe("useCarousel", () => {
	it("clamps index to valid range", () => {
		const { result } = renderHook(() => useCarousel({ total: 3, initialIndex: 1 }))
		expect(result.current.index).toBe(1)
		act(() => result.current.setIndex(99))
		expect(result.current.index).toBe(2)
		act(() => result.current.setIndex(-5))
		expect(result.current.index).toBe(0)
	})

	it("supports next/prev/goTo", () => {
		const { result } = renderHook(() => useCarousel({ total: 4 }))
		act(() => result.current.next())
		expect(result.current.index).toBe(1)
		act(() => result.current.next())
		act(() => result.current.next())
		act(() => result.current.next())
		expect(result.current.index).toBe(3)
		act(() => result.current.prev())
		expect(result.current.index).toBe(2)
		act(() => result.current.goTo(0))
		expect(result.current.index).toBe(0)
	})

	it("ignores drag below threshold", () => {
		const { result } = renderHook(() => useCarousel({ total: 3, dragThreshold: 50 }))
		act(() => result.current.bind.onPointerDown(createPointerEvent(0)))
		act(() => result.current.bind.onPointerMove(createPointerEvent(-10)))
		act(() => result.current.bind.onPointerUp(createPointerEvent(-10)))
		expect(result.current.index).toBe(0)
	})

	it("advances forward when dragging past threshold", () => {
		const { result } = renderHook(() => useCarousel({ total: 3, dragThreshold: 30 }))
		act(() => result.current.bind.onPointerDown(createPointerEvent(0)))
		act(() => result.current.bind.onPointerMove(createPointerEvent(-100)))
		act(() => result.current.bind.onPointerUp(createPointerEvent(-100)))
		expect(result.current.index).toBe(1)
	})

	it("moves backward when dragging right past threshold", () => {
		const { result } = renderHook(() =>
			useCarousel({ total: 3, initialIndex: 1, dragThreshold: 30 }),
		)
		act(() => result.current.bind.onPointerDown(createPointerEvent(0)))
		act(() => result.current.bind.onPointerMove(createPointerEvent(100)))
		act(() => result.current.bind.onPointerUp(createPointerEvent(100)))
		expect(result.current.index).toBe(0)
	})

	it("ignores secondary mouse button drag start", () => {
		const { result } = renderHook(() =>
			useCarousel({ total: 3, initialIndex: 1, dragThreshold: 30 }),
		)
		const setPointerCapture = vi.fn()

		act(() =>
			result.current.bind.onPointerDown({
				...createPointerEvent(0),
				button: 2,
				currentTarget: {
					setPointerCapture,
					releasePointerCapture: () => undefined,
				},
			} as any),
		)

		expect(result.current.dragging).toBe(false)
		expect(setPointerCapture).not.toHaveBeenCalled()
		expect(result.current.index).toBe(1)
	})

	it("switches cards from mouse wheel input", () => {
		const { result } = renderHook(() =>
			useCarousel({ total: 3, initialIndex: 1, enableKeyboard: false }),
		)

		act(() => result.current.bind.onWheel(createWheelEvent(100)))
		expect(result.current.index).toBe(2)

		act(() => result.current.bind.onWheel(createWheelEvent(-100)))
		expect(result.current.index).toBe(1)
	})

	it("stops wheel propagation when switching cards", () => {
		const { result } = renderHook(() =>
			useCarousel({ total: 3, initialIndex: 1, enableKeyboard: false }),
		)
		const preventDefault = vi.fn()
		const stopPropagation = vi.fn()

		act(() =>
			result.current.bind.onWheel({
				deltaX: 0,
				deltaY: 100,
				preventDefault,
				stopPropagation,
			} as any),
		)

		expect(preventDefault).toHaveBeenCalledTimes(1)
		expect(stopPropagation).toHaveBeenCalledTimes(1)
	})

	it("resets dragging when pointer is released outside the stage", () => {
		const { result } = renderHook(() => useCarousel({ total: 3, dragThreshold: 30 }))

		act(() => result.current.bind.onPointerDown(createPointerEvent(0)))
		act(() => result.current.bind.onPointerMove(createPointerEvent(-100)))
		expect(result.current.dragging).toBe(true)
		expect(result.current.dragOffset).toBe(-100)

		act(() => {
			window.dispatchEvent(new Event("pointerup"))
		})

		expect(result.current.index).toBe(1)
		expect(result.current.dragging).toBe(false)
		expect(result.current.dragOffset).toBe(0)
	})
})
