import { renderHook, act } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
// @ts-ignore
import { usePanelLayout } from "../usePanelLayout"
import { PanelState } from "../../types"

// Mock ahooks
vi.mock("ahooks", () => ({
	useMemoizedFn: (fn: any) => fn,
}))

// Mock constants
vi.mock("../../constants", () => ({
	DEFAULT_CONFIG: {
		width: 400,
		maxHeight: 200,
		minHeight: 200,
		headerHeight: 60,
		itemHeight: 32,
		animationDuration: 150,
	},
}))

describe("usePanelLayout", () => {
	beforeEach(() => {
		// Reset window size to default
		Object.defineProperty(window, "innerWidth", {
			writable: true,
			configurable: true,
			value: 1024,
		})
		Object.defineProperty(window, "innerHeight", {
			writable: true,
			configurable: true,
			value: 768,
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("basic functionality", () => {
		it("should initialize with default layout style", () => {
			const { result } = renderHook(() =>
				usePanelLayout({
					currentState: PanelState.DEFAULT,
					itemCount: 5,
				}),
			)

			expect(result.current.layoutStyle).toEqual({
				position: "fixed",
				top: 0,
				width: 400,
				height: 200,
				transformOrigin: "top left",
				zIndex: 1000,
			})
			expect(result.current.expandDirection).toBe("down")
		})

		it("should provide required methods", () => {
			const { result } = renderHook(() =>
				usePanelLayout({
					currentState: PanelState.DEFAULT,
					itemCount: 3,
				}),
			)

			expect(typeof result.current.calculatePosition).toBe("function")
			expect(typeof result.current.triggerHeightAnimation).toBe("function")
			expect(result.current.menuListStyle).toBeDefined()
		})

		it("should handle different item counts", () => {
			const { result, rerender } = renderHook(
				({ itemCount }) =>
					usePanelLayout({
						currentState: PanelState.DEFAULT,
						itemCount,
					}),
				{ initialProps: { itemCount: 0 } },
			)

			expect(result.current.layoutStyle.height).toBe(200)

			rerender({ itemCount: 10 })
			expect(result.current.layoutStyle.height).toBeLessThanOrEqual(200)
		})

		it("should handle different panel states", () => {
			const { result, rerender } = renderHook(
				({ state }) =>
					usePanelLayout({
						currentState: state,
						itemCount: 3,
					}),
				{ initialProps: { state: PanelState.DEFAULT } },
			)

			expect(result.current.layoutStyle).toBeDefined()

			rerender({ state: PanelState.SEARCH })
			expect(result.current.layoutStyle).toBeDefined()
		})
	})
})
