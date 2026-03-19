import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import usePullToNavigate from "../hooks/usePullToNavigate"

describe("usePullToNavigate", () => {
	beforeEach(() => {
		vi.clearAllMocks()

		// Mock window.getComputedStyle
		Object.defineProperty(window, "getComputedStyle", {
			value: vi.fn().mockReturnValue({
				overflowY: "auto",
			}),
			writable: true,
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should initialize with correct default values", () => {
		const { result } = renderHook(() =>
			usePullToNavigate({
				respectScrollableChildren: true,
			}),
		)

		expect(result.current.isActive).toBe(false)
		expect(result.current.pullDistance).toBe(0)
		expect(result.current.rawPullDistance).toBe(0)
		expect(result.current.isRefreshing).toBe(false)
		expect(result.current.isExiting).toBe(false)
	})

	it("should accept respectScrollableChildren option", () => {
		const { result: resultWithRespect } = renderHook(() =>
			usePullToNavigate({
				respectScrollableChildren: true,
			}),
		)

		const { result: resultWithoutRespect } = renderHook(() =>
			usePullToNavigate({
				respectScrollableChildren: false,
			}),
		)

		// Both should initialize correctly
		expect(resultWithRespect.current.isActive).toBe(false)
		expect(resultWithoutRespect.current.isActive).toBe(false)
	})

	it("should provide setContainer function", () => {
		const { result } = renderHook(() =>
			usePullToNavigate({
				respectScrollableChildren: true,
			}),
		)

		expect(typeof result.current.setContainer).toBe("function")
	})

	it("should provide triggerRefresh function", () => {
		const { result } = renderHook(() =>
			usePullToNavigate({
				respectScrollableChildren: true,
			}),
		)

		expect(typeof result.current.triggerRefresh).toBe("function")
	})
})
