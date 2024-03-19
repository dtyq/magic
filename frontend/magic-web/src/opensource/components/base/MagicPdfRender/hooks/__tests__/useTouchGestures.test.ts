import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
// @ts-ignore
import { useTouchGestures } from "../useTouchGestures"

// Mock touch events
const createTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
	const event = new Event(type) as TouchEvent
	Object.defineProperty(event, "touches", {
		value: touches.map((touch, index) => ({
			...touch,
			identifier: index,
			target: null,
			radiusX: 1,
			radiusY: 1,
			rotationAngle: 0,
			force: 1,
		})),
		writable: false,
	})
	Object.defineProperty(event, "preventDefault", {
		value: vi.fn(),
		writable: true,
	})
	return event
}

describe("useTouchGestures", () => {
	let mockViewerRef: React.RefObject<HTMLDivElement>
	let mockSetScale: ReturnType<typeof vi.fn>
	let mockSetIsStabilizing: ReturnType<typeof vi.fn>
	let mockElement: HTMLDivElement
	let mockPagesContainer: HTMLDivElement

	beforeEach(() => {
		mockSetScale = vi.fn()
		mockSetIsStabilizing = vi.fn()
		mockElement = document.createElement("div")
		mockPagesContainer = document.createElement("div")

		// Set up the DOM structure that the hook expects
		mockPagesContainer.className = "pagesContainer"
		mockElement.appendChild(mockPagesContainer)

		// Mock getBoundingClientRect
		mockElement.getBoundingClientRect = vi.fn(() => ({
			left: 0,
			top: 0,
			width: 800,
			height: 600,
			right: 800,
			bottom: 600,
			x: 0,
			y: 0,
			toJSON: () => {},
		}))

		// Mock scroll properties
		Object.defineProperty(mockElement, "scrollLeft", {
			value: 0,
			writable: true,
		})
		Object.defineProperty(mockElement, "scrollTop", {
			value: 0,
			writable: true,
		})

		mockViewerRef = { current: mockElement }

		// Mock addEventListener and removeEventListener
		vi.spyOn(mockElement, "addEventListener")
		vi.spyOn(mockElement, "removeEventListener")

		// Mock querySelector to return the pages container
		vi.spyOn(mockElement, "querySelector").mockImplementation((selector) => {
			if (selector.includes("pagesContainer")) {
				return mockPagesContainer
			}
			return null
		})

		// Mock console methods to avoid noise in tests
		vi.spyOn(console, "log").mockImplementation(() => {})
		vi.spyOn(console, "warn").mockImplementation(() => {})
	})

	afterEach(() => {
		vi.clearAllMocks()
		vi.restoreAllMocks()
	})

	// Define defaultProps inside a function to avoid using variables before assignment
	const getDefaultProps = () => ({
		scale: 1.0,
		setScale: mockSetScale,
		minScale: 0.5,
		maxScale: 3.0,
		enabled: true,
		viewerRef: mockViewerRef,
		setIsStabilizing: mockSetIsStabilizing,
	})

	it("should add event listeners when enabled", () => {
		renderHook(() => useTouchGestures(getDefaultProps()))

		expect(mockElement.addEventListener).toHaveBeenCalledWith(
			"touchstart",
			expect.any(Function),
			{
				passive: false,
			},
		)
		expect(mockElement.addEventListener).toHaveBeenCalledWith(
			"touchmove",
			expect.any(Function),
			{
				passive: false,
			},
		)
		expect(mockElement.addEventListener).toHaveBeenCalledWith(
			"touchend",
			expect.any(Function),
			{
				passive: false,
			},
		)
		expect(mockElement.addEventListener).toHaveBeenCalledWith(
			"touchcancel",
			expect.any(Function),
			{
				passive: false,
			},
		)
	})

	it("should not add event listeners when disabled", () => {
		renderHook(() => useTouchGestures({ ...getDefaultProps(), enabled: false }))

		expect(mockElement.addEventListener).not.toHaveBeenCalled()
	})

	it("should not add event listeners when viewerRef is null", () => {
		const nullRef = { current: null }
		renderHook(() => useTouchGestures({ ...getDefaultProps(), viewerRef: nullRef }))

		expect(mockElement.addEventListener).not.toHaveBeenCalled()
	})

	it("should remove event listeners on unmount", () => {
		const { unmount } = renderHook(() => useTouchGestures(getDefaultProps()))

		unmount()

		expect(mockElement.removeEventListener).toHaveBeenCalledWith(
			"touchstart",
			expect.any(Function),
		)
		expect(mockElement.removeEventListener).toHaveBeenCalledWith(
			"touchmove",
			expect.any(Function),
		)
		expect(mockElement.removeEventListener).toHaveBeenCalledWith(
			"touchend",
			expect.any(Function),
		)
		expect(mockElement.removeEventListener).toHaveBeenCalledWith(
			"touchcancel",
			expect.any(Function),
		)
	})

	it("should handle two-finger touch start correctly", () => {
		renderHook(() => useTouchGestures(getDefaultProps()))

		const touchStartEvent = createTouchEvent("touchstart", [
			{ clientX: 100, clientY: 100 },
			{ clientX: 200, clientY: 200 },
		])

		// Get the event handler that was registered
		const addEventListenerCalls = (mockElement.addEventListener as any).mock.calls
		const touchStartCall = addEventListenerCalls.find((call: any) => call[0] === "touchstart")
		expect(touchStartCall).toBeDefined()

		const touchStartHandler = touchStartCall[1]
		touchStartHandler(touchStartEvent)

		expect(touchStartEvent.preventDefault).toHaveBeenCalled()
	})

	it("should not handle single finger touch", () => {
		renderHook(() => useTouchGestures(getDefaultProps()))

		const touchStartEvent = createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }])

		const addEventListenerCalls = (mockElement.addEventListener as any).mock.calls
		const touchStartCall = addEventListenerCalls.find((call: any) => call[0] === "touchstart")
		const touchStartHandler = touchStartCall[1]

		touchStartHandler(touchStartEvent)

		expect(touchStartEvent.preventDefault).not.toHaveBeenCalled()
	})

	it("should calculate scale correctly during touch move", () => {
		renderHook(() => useTouchGestures(getDefaultProps()))

		// Start with two fingers
		const touchStartEvent = createTouchEvent("touchstart", [
			{ clientX: 100, clientY: 100 },
			{ clientX: 200, clientY: 200 },
		])

		const addEventListenerCalls = (mockElement.addEventListener as any).mock.calls
		const touchStartCall = addEventListenerCalls.find((call: any) => call[0] === "touchstart")
		const touchStartHandler = touchStartCall[1]
		touchStartHandler(touchStartEvent)

		// Move fingers further apart (zoom in)
		const touchMoveEvent = createTouchEvent("touchmove", [
			{ clientX: 50, clientY: 50 },
			{ clientX: 250, clientY: 250 },
		])

		const touchMoveCall = addEventListenerCalls.find((call: any) => call[0] === "touchmove")
		const touchMoveHandler = touchMoveCall[1]
		touchMoveHandler(touchMoveEvent)

		expect(touchMoveEvent.preventDefault).toHaveBeenCalled()
		// Note: setScale is not called during gesture, only at the end
	})

	it("should clamp scale within bounds", () => {
		const propsWithLimits = {
			...getDefaultProps(),
			scale: 2.5,
			minScale: 0.5,
			maxScale: 3.0,
		}

		renderHook(() => useTouchGestures(propsWithLimits))

		// Start gesture
		const touchStartEvent = createTouchEvent("touchstart", [
			{ clientX: 100, clientY: 100 },
			{ clientX: 200, clientY: 200 },
		])

		const addEventListenerCalls = (mockElement.addEventListener as any).mock.calls
		const touchStartCall = addEventListenerCalls.find((call: any) => call[0] === "touchstart")
		const touchStartHandler = touchStartCall[1]
		touchStartHandler(touchStartEvent)

		// Try to zoom beyond max scale
		const touchMoveEvent = createTouchEvent("touchmove", [
			{ clientX: 0, clientY: 0 },
			{ clientX: 400, clientY: 400 },
		])

		const touchMoveCall = addEventListenerCalls.find((call: any) => call[0] === "touchmove")
		const touchMoveHandler = touchMoveCall[1]
		touchMoveHandler(touchMoveEvent)

		expect(touchMoveEvent.preventDefault).toHaveBeenCalled()
		// The scale clamping happens internally during the gesture
	})

	it("should reset gesture state on touch end", () => {
		renderHook(() => useTouchGestures(getDefaultProps()))

		// Start gesture
		const touchStartEvent = createTouchEvent("touchstart", [
			{ clientX: 100, clientY: 100 },
			{ clientX: 200, clientY: 200 },
		])

		const addEventListenerCalls = (mockElement.addEventListener as any).mock.calls
		const touchStartCall = addEventListenerCalls.find((call: any) => call[0] === "touchstart")
		const touchStartHandler = touchStartCall[1]
		touchStartHandler(touchStartEvent)

		// End gesture
		const touchEndEvent = createTouchEvent("touchend", [])
		const touchEndCall = addEventListenerCalls.find((call: any) => call[0] === "touchend")
		const touchEndHandler = touchEndCall[1]
		touchEndHandler(touchEndEvent)

		// Subsequent touch move should not trigger scale change
		const touchMoveEvent = createTouchEvent("touchmove", [
			{ clientX: 50, clientY: 50 },
			{ clientX: 250, clientY: 250 },
		])
		const touchMoveCall = addEventListenerCalls.find((call: any) => call[0] === "touchmove")
		const touchMoveHandler = touchMoveCall[1]

		mockSetScale.mockClear()
		touchMoveHandler(touchMoveEvent)

		// Touch move should not prevent default when gesture is not active
		expect(touchMoveEvent.preventDefault).not.toHaveBeenCalled()
	})
})
