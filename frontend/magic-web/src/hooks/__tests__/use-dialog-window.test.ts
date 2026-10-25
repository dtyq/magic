import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useDialogWindow, type DialogWindowOptions } from "../use-dialog-window"

class MockPointerEvent extends MouseEvent {
	pointerId: number
	clientX: number
	clientY: number
	constructor(
		type: string,
		props: PointerEventInit & { clientX?: number; clientY?: number } = {},
	) {
		super(type, props)
		this.pointerId = props.pointerId ?? 0
		Object.defineProperty(this, "clientX", { value: props.clientX ?? 0, configurable: true })
		Object.defineProperty(this, "clientY", { value: props.clientY ?? 0, configurable: true })
	}
}

if (typeof globalThis.PointerEvent === "undefined") {
	globalThis.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent
}

describe("useDialogWindow", () => {
	const defaultOptions: DialogWindowOptions = {
		open: true,
		draggable: true,
		resizable: true,
		defaultSize: { width: 800, height: 600 },
		minSize: { width: 400, height: 300 },
		sizeStorageKey: "test_dialog_size",
	}

	beforeEach(() => {
		localStorage.clear()
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
			cb(0)
			return 1
		})
		vi.spyOn(window, "cancelAnimationFrame").mockReturnValue()
		Object.defineProperty(window, "innerWidth", {
			writable: true,
			configurable: true,
			value: 1440,
		})
		Object.defineProperty(window, "innerHeight", {
			writable: true,
			configurable: true,
			value: 900,
		})
		Object.defineProperty(window, "visualViewport", {
			writable: true,
			configurable: true,
			value: {
				offsetLeft: 0,
				offsetTop: 0,
				width: 1440,
				height: 900,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			},
		})
	})

	it("initializes with centered position and default size", () => {
		const { result } = renderHook(() => useDialogWindow(defaultOptions))

		expect(result.current.style).toBeDefined()
		expect(result.current.style?.width).toBe(800)
		expect(result.current.style?.height).toBe(600)
		expect(result.current.style?.left).toBe(320)
		expect(result.current.style?.top).toBe(150)
		expect(result.current.isInteracting).toBe(false)
		expect(result.current.isDragging).toBe(false)
	})

	it("smoothly updates position during drag and does not snap back on pointercancel", () => {
		const { result } = renderHook(() => useDialogWindow(defaultOptions))

		const initialLeft = Number(result.current.style?.left)
		const initialTop = Number(result.current.style?.top)

		const mockTarget = document.createElement("div")
		mockTarget.setPointerCapture = vi.fn()
		mockTarget.hasPointerCapture = vi.fn().mockReturnValue(true)
		mockTarget.releasePointerCapture = vi.fn()

		// Start drag
		act(() => {
			result.current.startGesture(
				{
					button: 0,
					isPrimary: true,
					pointerId: 1,
					clientX: 300,
					clientY: 200,
					preventDefault: vi.fn(),
					currentTarget: mockTarget,
				} as unknown as React.PointerEvent<HTMLElement>,
				"move",
			)
		})

		expect(result.current.isDragging).toBe(true)
		expect(result.current.isInteracting).toBe(true)

		// Move by dx=50, dy=40
		act(() => {
			window.dispatchEvent(
				new PointerEvent("pointermove", {
					pointerId: 1,
					clientX: 350,
					clientY: 240,
				}),
			)
		})

		expect(result.current.style?.left).toBe(initialLeft + 50)
		expect(result.current.style?.top).toBe(initialTop + 40)

		// Trigger unexpected pointercancel (e.g. system gesture conflict / blur)
		act(() => {
			window.dispatchEvent(
				new PointerEvent("pointercancel", {
					pointerId: 1,
				}),
			)
		})

		// Must NOT snap back to initial position! Should retain the moved position
		expect(result.current.isDragging).toBe(false)
		expect(result.current.isInteracting).toBe(false)
		expect(result.current.style?.left).toBe(initialLeft + 50)
		expect(result.current.style?.top).toBe(initialTop + 40)
	})

	it("reverts to start position only when Escape key is explicitly pressed", () => {
		const { result } = renderHook(() => useDialogWindow(defaultOptions))

		const initialLeft = Number(result.current.style?.left)
		const initialTop = Number(result.current.style?.top)

		const mockTarget = document.createElement("div")
		mockTarget.setPointerCapture = vi.fn()
		mockTarget.hasPointerCapture = vi.fn().mockReturnValue(true)
		mockTarget.releasePointerCapture = vi.fn()

		act(() => {
			result.current.startGesture(
				{
					button: 0,
					isPrimary: true,
					pointerId: 1,
					clientX: 300,
					clientY: 200,
					preventDefault: vi.fn(),
					currentTarget: mockTarget,
				} as unknown as React.PointerEvent<HTMLElement>,
				"move",
			)
		})

		act(() => {
			window.dispatchEvent(
				new PointerEvent("pointermove", {
					pointerId: 1,
					clientX: 400,
					clientY: 300,
				}),
			)
		})

		expect(result.current.style?.left).toBe(initialLeft + 100)
		expect(result.current.style?.top).toBe(initialTop + 100)

		// User presses Escape
		const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" })
		const preventDefaultSpy = vi.spyOn(escapeEvent, "preventDefault")

		act(() => {
			result.current.onEscapeKeyDown(escapeEvent)
		})

		// Reverts to starting position
		expect(preventDefaultSpy).toHaveBeenCalled()
		expect(result.current.isDragging).toBe(false)
		expect(result.current.style?.left).toBe(initialLeft)
		expect(result.current.style?.top).toBe(initialTop)
	})

	it("does not abort active drag gesture on window resize", () => {
		const { result } = renderHook(() => useDialogWindow(defaultOptions))

		const initialLeft = Number(result.current.style?.left)
		const initialTop = Number(result.current.style?.top)

		const mockTarget = document.createElement("div")
		mockTarget.setPointerCapture = vi.fn()
		mockTarget.hasPointerCapture = vi.fn().mockReturnValue(true)
		mockTarget.releasePointerCapture = vi.fn()

		act(() => {
			result.current.startGesture(
				{
					button: 0,
					isPrimary: true,
					pointerId: 1,
					clientX: 300,
					clientY: 200,
					preventDefault: vi.fn(),
					currentTarget: mockTarget,
				} as unknown as React.PointerEvent<HTMLElement>,
				"move",
			)
		})

		act(() => {
			window.dispatchEvent(
				new PointerEvent("pointermove", {
					pointerId: 1,
					clientX: 360,
					clientY: 250,
				}),
			)
		})

		// Window resize event fires during drag
		act(() => {
			window.dispatchEvent(new Event("resize"))
		})

		// Drag should remain active and position kept
		expect(result.current.isDragging).toBe(true)
		expect(result.current.style?.left).toBe(initialLeft + 60)
		expect(result.current.style?.top).toBe(initialTop + 50)

		// Complete drag
		act(() => {
			window.dispatchEvent(
				new PointerEvent("pointerup", {
					pointerId: 1,
					clientX: 360,
					clientY: 250,
				}),
			)
		})

		expect(result.current.isDragging).toBe(false)
		expect(result.current.style?.left).toBe(initialLeft + 60)
		expect(result.current.style?.top).toBe(initialTop + 50)
	})

	it("resizes window from handles and calls onResizeEnd", () => {
		const onResizeEnd = vi.fn()
		const { result } = renderHook(() =>
			useDialogWindow({
				...defaultOptions,
				onResizeEnd,
			}),
		)

		const mockTarget = document.createElement("div")
		mockTarget.setPointerCapture = vi.fn()
		mockTarget.hasPointerCapture = vi.fn().mockReturnValue(true)
		mockTarget.releasePointerCapture = vi.fn()

		// Resize southeast corner
		act(() => {
			result.current.startGesture(
				{
					button: 0,
					isPrimary: true,
					pointerId: 1,
					clientX: 1120,
					clientY: 750,
					preventDefault: vi.fn(),
					currentTarget: mockTarget,
				} as unknown as React.PointerEvent<HTMLElement>,
				"se",
			)
		})

		expect(result.current.activeGesture).toBe("se")
		expect(result.current.isInteracting).toBe(true)
		expect(result.current.isDragging).toBe(false)

		// Move southeast corner by +80 width, +60 height
		act(() => {
			window.dispatchEvent(
				new PointerEvent("pointermove", {
					pointerId: 1,
					clientX: 1200,
					clientY: 810,
				}),
			)
		})

		expect(result.current.style?.width).toBe(880)
		expect(result.current.style?.height).toBe(660)

		act(() => {
			window.dispatchEvent(
				new PointerEvent("pointerup", {
					pointerId: 1,
					clientX: 1200,
					clientY: 810,
				}),
			)
		})

		expect(result.current.isInteracting).toBe(false)
		expect(onResizeEnd).toHaveBeenCalledWith({ width: 880, height: 660 })
	})
})
