import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import useMonitorSoftKeyboard from "../useMonitorSoftKeyboard"

// Mock window.visualViewport
const mockVisualViewport = {
	height: 800,
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
}

// Mock navigator.userAgent
const mockUserAgent = (userAgent: string) => {
	Object.defineProperty(navigator, "userAgent", {
		writable: true,
		value: userAgent,
	})
}

describe("useMonitorSoftKeyboard", () => {
	let originalInnerHeight: number
	let originalVisualViewport: any
	let originalUserAgent: string

	beforeEach(() => {
		// Save original values
		originalInnerHeight = window.innerHeight
		originalVisualViewport = window.visualViewport
		originalUserAgent = navigator.userAgent

		// Set default values
		Object.defineProperty(window, "innerHeight", {
			writable: true,
			value: 800,
		})

		// Clear all mocks
		vi.clearAllMocks()
	})

	afterEach(() => {
		// Restore original values
		Object.defineProperty(window, "innerHeight", {
			writable: true,
			value: originalInnerHeight,
		})
		Object.defineProperty(window, "visualViewport", {
			writable: true,
			value: originalVisualViewport,
		})
		Object.defineProperty(navigator, "userAgent", {
			writable: true,
			value: originalUserAgent,
		})
	})

	describe("initialization", () => {
		it("should initialize with keyboard down state", () => {
			const { result } = renderHook(() => useMonitorSoftKeyboard())

			expect(result.current.isDown).toBe(true)
			expect(result.current.isUp).toBe(false)
			expect(result.current.heightDifference).toBe(0)
		})

		it("should call callback with initial state when provided", () => {
			const callback = vi.fn()
			renderHook(() => useMonitorSoftKeyboard({ callback }))

			// Callback should not be called during initialization
			expect(callback).not.toHaveBeenCalled()
		})
	})

	describe("Visual Viewport API support", () => {
		beforeEach(() => {
			Object.defineProperty(window, "visualViewport", {
				writable: true,
				value: mockVisualViewport,
			})
		})

		it("should use Visual Viewport API when available", () => {
			renderHook(() => useMonitorSoftKeyboard())

			expect(mockVisualViewport.addEventListener).toHaveBeenCalledWith(
				"resize",
				expect.any(Function),
			)
		})

		it("should detect keyboard show via Visual Viewport API", async () => {
			const callback = vi.fn()
			renderHook(() => useMonitorSoftKeyboard({ callback, threshold: 100 }))

			// Get the resize handler
			const resizeHandler = mockVisualViewport.addEventListener.mock.calls[0][1]

			// Simulate keyboard showing (viewport height decreases)
			mockVisualViewport.height = 600

			act(() => {
				resizeHandler()
			})

			// Wait for debounce
			await new Promise((resolve) => setTimeout(resolve, 150))

			expect(callback).toHaveBeenCalledWith({
				isDown: false,
				isUp: true,
				heightDifference: 200,
			})
		})

		it("should detect keyboard hide via Visual Viewport API", async () => {
			const callback = vi.fn()
			const { rerender } = renderHook(() =>
				useMonitorSoftKeyboard({ callback, threshold: 100 }),
			)

			const resizeHandler = mockVisualViewport.addEventListener.mock.calls[0][1]

			// First show keyboard
			mockVisualViewport.height = 600
			act(() => {
				resizeHandler()
			})

			await new Promise((resolve) => setTimeout(resolve, 150))

			// Clear previous calls
			callback.mockClear()

			// Then hide keyboard
			mockVisualViewport.height = 800
			act(() => {
				resizeHandler()
			})

			await new Promise((resolve) => setTimeout(resolve, 150))

			expect(callback).toHaveBeenCalledWith({
				isDown: true,
				isUp: false,
				heightDifference: 0,
			})
		})

		it("should cleanup Visual Viewport listeners", () => {
			const { unmount } = renderHook(() => useMonitorSoftKeyboard())

			unmount()

			expect(mockVisualViewport.removeEventListener).toHaveBeenCalledWith(
				"resize",
				expect.any(Function),
			)
		})
	})

	describe("Android support", () => {
		beforeEach(() => {
			mockUserAgent("Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36")
			Object.defineProperty(window, "visualViewport", {
				writable: true,
				value: undefined,
			})
		})

		it("should detect Android device", () => {
			const addEventListenerSpy = vi.spyOn(window, "addEventListener")
			renderHook(() => useMonitorSoftKeyboard())

			expect(addEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function), {
				passive: true,
			})
		})

		it("should detect keyboard via resize event on Android", async () => {
			const callback = vi.fn()
			const addEventListenerSpy = vi.spyOn(window, "addEventListener")

			// Mock document height
			Object.defineProperty(document.documentElement, "clientHeight", {
				writable: true,
				value: 800,
			})

			renderHook(() => useMonitorSoftKeyboard({ callback, threshold: 100 }))

			// Get the resize handler
			const resizeHandler = addEventListenerSpy.mock.calls.find(
				(call) => call[0] === "resize",
			)?.[1]

			expect(resizeHandler).toBeDefined()

			// Simulate keyboard showing (document height decreases)
			Object.defineProperty(document.documentElement, "clientHeight", {
				writable: true,
				value: 600,
			})

			act(() => {
				if (typeof resizeHandler === "function") {
					resizeHandler({} as Event)
				}
			})

			await new Promise((resolve) => setTimeout(resolve, 150))

			expect(callback).toHaveBeenCalledWith({
				isDown: false,
				isUp: true,
				heightDifference: 200,
			})
		})
	})

	describe("Android WebView support", () => {
		beforeEach(() => {
			mockUserAgent(
				"Mozilla/5.0 (Linux; Android 10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.120 Mobile Safari/537.36",
			)
			Object.defineProperty(window, "visualViewport", {
				writable: true,
				value: undefined,
			})
		})

		it("should detect WebView environment", () => {
			const setIntervalSpy = vi.spyOn(global, "setInterval")
			renderHook(() => useMonitorSoftKeyboard())

			expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 200)
		})

		it("should use polling for WebView keyboard detection", async () => {
			const callback = vi.fn()
			vi.useFakeTimers()

			renderHook(() => useMonitorSoftKeyboard({ callback, threshold: 100 }))

			// Simulate keyboard showing by changing window.innerHeight
			Object.defineProperty(window, "innerHeight", {
				writable: true,
				value: 600,
			})

			// Fast-forward timers
			act(() => {
				vi.advanceTimersByTime(300) // Let polling run and debounce complete
			})

			expect(callback).toHaveBeenCalledWith({
				isDown: false,
				isUp: true,
				heightDifference: 200,
			})

			vi.useRealTimers()
		})
	})

	describe("iOS support", () => {
		beforeEach(() => {
			mockUserAgent(
				"Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
			)
			Object.defineProperty(window, "visualViewport", {
				writable: true,
				value: undefined,
			})
		})

		it("should detect iOS device and use focus events", () => {
			const addEventListenerSpy = vi.spyOn(document, "addEventListener")
			renderHook(() => useMonitorSoftKeyboard())

			expect(addEventListenerSpy).toHaveBeenCalledWith("focusin", expect.any(Function), {
				passive: true,
			})
			expect(addEventListenerSpy).toHaveBeenCalledWith("focusout", expect.any(Function), {
				passive: true,
			})
		})

		it("should detect keyboard via focus events on iOS", async () => {
			const callback = vi.fn()
			const addEventListenerSpy = vi.spyOn(document, "addEventListener")
			vi.useFakeTimers()

			renderHook(() => useMonitorSoftKeyboard({ callback }))

			// Get the focusin handler
			const focusInHandler = addEventListenerSpy.mock.calls.find(
				(call) => call[0] === "focusin",
			)?.[1]

			expect(focusInHandler).toBeDefined()

			act(() => {
				if (typeof focusInHandler === "function") {
					focusInHandler({} as Event)
				}
				vi.advanceTimersByTime(400) // iOS has 300ms delay + debounce
			})

			expect(callback).toHaveBeenCalledWith({
				isDown: false,
				isUp: true,
				heightDifference: expect.any(Number),
			})

			vi.useRealTimers()
		})
	})

	describe("configuration options", () => {
		it("should respect custom threshold", async () => {
			const callback = vi.fn()
			Object.defineProperty(window, "visualViewport", {
				writable: true,
				value: { ...mockVisualViewport, height: 750 }, // Only 50px difference
			})

			renderHook(() =>
				useMonitorSoftKeyboard({
					callback,
					threshold: 100, // Higher than the 50px difference
				}),
			)

			const resizeHandler = mockVisualViewport.addEventListener.mock.calls[0][1]

			act(() => {
				resizeHandler()
			})

			await new Promise((resolve) => setTimeout(resolve, 150))

			// Should not trigger because difference (50px) is below threshold (100px)
			expect(callback).not.toHaveBeenCalled()
		})

		it("should respect custom debounce delay", async () => {
			const callback = vi.fn()
			Object.defineProperty(window, "visualViewport", {
				writable: true,
				value: { ...mockVisualViewport, height: 600 },
			})

			renderHook(() =>
				useMonitorSoftKeyboard({
					callback,
					debounceDelay: 300, // Custom delay
				}),
			)

			const resizeHandler = mockVisualViewport.addEventListener.mock.calls[0][1]

			act(() => {
				resizeHandler()
			})

			// Should not be called before debounce delay
			await new Promise((resolve) => setTimeout(resolve, 200))
			expect(callback).not.toHaveBeenCalled()

			// Should be called after debounce delay
			await new Promise((resolve) => setTimeout(resolve, 150))
			expect(callback).toHaveBeenCalled()
		})
	})

	describe("state management", () => {
		it("should update state correctly when keyboard shows and hides", async () => {
			Object.defineProperty(window, "visualViewport", {
				writable: true,
				value: mockVisualViewport,
			})

			const { result } = renderHook(() => useMonitorSoftKeyboard({ threshold: 100 }))
			const resizeHandler = mockVisualViewport.addEventListener.mock.calls[0][1]

			// Initial state
			expect(result.current.isDown).toBe(true)
			expect(result.current.isUp).toBe(false)

			// Show keyboard
			mockVisualViewport.height = 600
			act(() => {
				resizeHandler()
			})

			await new Promise((resolve) => setTimeout(resolve, 150))

			expect(result.current.isDown).toBe(false)
			expect(result.current.isUp).toBe(true)
			expect(result.current.heightDifference).toBe(200)

			// Hide keyboard
			mockVisualViewport.height = 800
			act(() => {
				resizeHandler()
			})

			await new Promise((resolve) => setTimeout(resolve, 150))

			expect(result.current.isDown).toBe(true)
			expect(result.current.isUp).toBe(false)
			expect(result.current.heightDifference).toBe(0)
		})
	})
})
