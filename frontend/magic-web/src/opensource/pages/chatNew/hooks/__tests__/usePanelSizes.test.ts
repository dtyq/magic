import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { usePanelSizes } from "../usePanelSizes"

// Mock dependencies
vi.mock("ahooks", () => ({
	useMemoizedFn: vi.fn((fn) => fn),
}))

vi.mock("mobx", () => ({
	autorun: vi.fn((fn) => {
		fn()
		return () => {}
	}),
}))

// Mock stores
vi.mock("@/opensource/stores/chatNew/conversation", () => ({
	default: {
		topicOpen: false,
	},
}))

vi.mock("@/opensource/stores/interface", () => ({
	interfaceStore: {
		chatSiderDefaultWidth: 240,
		setChatSiderDefaultWidth: vi.fn(),
		setChatInputDefaultHeight: vi.fn(),
	},
}))

vi.mock("@/opensource/stores/chatNew/messagePreview/FilePreviewStore", () => ({
	default: {
		open: false,
	},
}))

// Mock utils
vi.mock("../utils/panelSizeCalculator", () => ({
	calculatePanelSizes: {
		getMainMinWidth: vi.fn((topicOpen) => (topicOpen ? 600 : 400)),
		getTwoPanelSizes: vi.fn((totalWidth, siderWidth) => [siderWidth, totalWidth - siderWidth]),
		getFilePreviewOpenSizes: vi.fn((totalWidth, siderWidth) => {
			const availableWidth = totalWidth - siderWidth
			return [siderWidth, availableWidth * 0.6, availableWidth * 0.4]
		}),
		handleSiderResize: vi.fn((prevSizes, newSizes) => newSizes),
	},
	LAYOUT_CONSTANTS: {
		WINDOW_MARGIN: 100,
	},
	PanelIndex: {
		Sider: 0,
		Main: 1,
		FilePreview: 2,
	},
}))

describe("usePanelSizes", () => {
	const originalInnerWidth = window.innerWidth

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()

		// Set initial window width
		Object.defineProperty(window, "innerWidth", {
			writable: true,
			configurable: true,
			value: 1200,
		})
	})

	afterEach(() => {
		// Restore original window width
		Object.defineProperty(window, "innerWidth", {
			writable: true,
			configurable: true,
			value: originalInnerWidth,
		})
	})

	it("should initialize with correct panel sizes", () => {
		const { result } = renderHook(() => usePanelSizes())

		expect(result.current.sizes).toEqual([240, 860]) // 1200 - 100 - 240 = 860
		expect(result.current.totalWidth).toBe(1100) // 1200 - 100
		expect(result.current.mainMinWidth).toBe(400)
	})

	it("should handle window resize correctly", () => {
		const { result } = renderHook(() => usePanelSizes())

		// Initial state
		expect(result.current.totalWidth).toBe(1100)
		expect(result.current.sizes).toEqual([240, 860])

		// Simulate window resize
		act(() => {
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 1400,
			})

			// Trigger resize event
			window.dispatchEvent(new Event("resize"))
		})

		// Check if sizes are recalculated
		expect(result.current.totalWidth).toBe(1300) // 1400 - 100
		expect(result.current.sizes).toEqual([240, 1060]) // 1300 - 240
	})

	it("should clean up resize listener on unmount", () => {
		const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")
		const { unmount } = renderHook(() => usePanelSizes())

		unmount()

		expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function))
	})

	it("should preserve sider width during resize", () => {
		const { result } = renderHook(() => usePanelSizes())

		// Set custom sider width
		act(() => {
			result.current.handleSiderResize([300, 800])
		})

		// Simulate resize
		act(() => {
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 1400,
			})

			window.dispatchEvent(new Event("resize"))
		})

		// Sider width should be preserved
		expect(result.current.sizes[0]).toBe(300)
		expect(result.current.sizes[1]).toBe(1000) // 1400 - 100 - 300
	})

	it("should handle multiple resize events", () => {
		const { result } = renderHook(() => usePanelSizes())

		// First resize
		act(() => {
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 1600,
			})

			window.dispatchEvent(new Event("resize"))
		})

		expect(result.current.totalWidth).toBe(1500) // 1600 - 100
		expect(result.current.sizes).toEqual([240, 1260]) // 1500 - 240

		// Second resize
		act(() => {
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 1000,
			})

			window.dispatchEvent(new Event("resize"))
		})

		expect(result.current.totalWidth).toBe(900) // 1000 - 100
		expect(result.current.sizes).toEqual([240, 660]) // 900 - 240
	})

	it("should handle resize with minimum constraints", () => {
		const { result } = renderHook(() => usePanelSizes())

		// Resize to very small window
		act(() => {
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 500,
			})

			window.dispatchEvent(new Event("resize"))
		})

		// Should still maintain basic layout
		expect(result.current.totalWidth).toBe(400) // 500 - 100
		expect(result.current.sizes).toEqual([240, 160]) // 400 - 240
	})
})
