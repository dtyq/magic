import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock MobX stores directly in vi.mock without external variables
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

// Mock autorun from mobx to just call the function immediately
vi.mock("mobx", () => ({
	autorun: (fn: () => void) => {
		fn()
		return () => {} // cleanup function
	},
}))

// Mock window.innerWidth
Object.defineProperty(window, "innerWidth", {
	writable: true,
	configurable: true,
	value: 1200,
})

// Import after mocking
// @ts-ignore
import { usePanelSizes } from "../usePanelSizes"

describe("usePanelSizes", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should initialize with correct default sizes", () => {
		const { result } = renderHook(() => usePanelSizes())

		// totalWidth = 1200 - 100 = 1100, siderWidth = 240, mainWidth = 1100 - 240 = 860
		expect(result.current.sizes).toEqual([240, 860])
		expect(result.current.totalWidth).toBe(1100)
		expect(result.current.mainMinWidth).toBe(400)
	})

	it("should provide resize handlers", () => {
		const { result } = renderHook(() => usePanelSizes())

		expect(typeof result.current.handleSiderResize).toBe("function")
		expect(typeof result.current.handleInputResize).toBe("function")
	})

	it("should handle sider resize correctly", async () => {
		const { result } = renderHook(() => usePanelSizes())

		act(() => {
			result.current.handleSiderResize([300, 800])
		})

		// Get the mocked store to verify the call
		const { interfaceStore } = await import("@/opensource/stores/interface")
		expect(interfaceStore.setChatSiderDefaultWidth).toHaveBeenCalledWith(300)
	})

	it("should handle input resize correctly", async () => {
		const { result } = renderHook(() => usePanelSizes())

		act(() => {
			result.current.handleInputResize([240, 760, 200])
		})

		// Get the mocked store to verify the call
		const { interfaceStore } = await import("@/opensource/stores/interface")
		expect(interfaceStore.setChatInputDefaultHeight).toHaveBeenCalledWith(200)
	})

	it("should handle different window sizes", () => {
		Object.defineProperty(window, "innerWidth", {
			writable: true,
			configurable: true,
			value: 1600,
		})

		const { result } = renderHook(() => usePanelSizes())

		expect(result.current.totalWidth).toBe(1500)
	})
})
