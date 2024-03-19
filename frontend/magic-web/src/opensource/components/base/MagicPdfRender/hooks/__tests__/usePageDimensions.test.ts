import { renderHook, act } from "@testing-library/react"
// @ts-ignore
import { usePageDimensions } from "../usePageDimensions"
import { vi, describe, it, beforeEach, expect } from "vitest"

// Mock DOM methods
const mockGetBoundingClientRect = vi.fn()
const mockQuerySelector = vi.fn()

// Mock viewer ref
const mockViewerRef = {
	current: {
		querySelector: mockQuerySelector,
	},
}

// Mock MutationObserver
class MockMutationObserver {
	constructor(callback: MutationCallback) {
		this.callback = callback
	}
	callback: MutationCallback
	observe = vi.fn()
	disconnect = vi.fn()
}

global.MutationObserver = MockMutationObserver as any

describe("usePageDimensions", () => {
	beforeEach(() => {
		vi.clearAllMocks()

		// Setup default mock implementations
		mockGetBoundingClientRect.mockReturnValue({
			width: 400,
			height: 600,
		})

		mockQuerySelector.mockImplementation((selector: string) => {
			if (selector === ".react-pdf__Page__canvas") {
				return {
					getBoundingClientRect: mockGetBoundingClientRect,
				}
			}
			if (selector === "[data-page-number]") {
				return {
					getBoundingClientRect: mockGetBoundingClientRect,
				}
			}
			return null
		})
	})

	it("should return default dimensions initially", () => {
		const { result } = renderHook(() =>
			usePageDimensions({
				viewerRef: mockViewerRef as any,
				scale: 1.0,
				numPages: 0,
			}),
		)

		expect(result.current).toEqual({
			width: 300,
			height: 400,
		})
	})

	it("should calculate dimensions from canvas element", async () => {
		const { result } = renderHook(() =>
			usePageDimensions({
				viewerRef: mockViewerRef as any,
				scale: 1.0,
				numPages: 1,
			}),
		)

		// Wait for the effect to run
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 350))
		})

		expect(mockQuerySelector).toHaveBeenCalledWith(".react-pdf__Page__canvas")
		expect(result.current).toEqual({
			width: 400,
			height: 600,
		})
	})

	it("should fallback to page container if canvas not found", async () => {
		mockQuerySelector.mockImplementation((selector: string) => {
			if (selector === ".react-pdf__Page__canvas") {
				return null
			}
			if (selector === "[data-page-number]") {
				return {
					getBoundingClientRect: mockGetBoundingClientRect,
				}
			}
			return null
		})

		const { result } = renderHook(() =>
			usePageDimensions({
				viewerRef: mockViewerRef as any,
				scale: 1.0,
				numPages: 1,
			}),
		)

		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 350))
		})

		expect(mockQuerySelector).toHaveBeenCalledWith("[data-page-number]")
		expect(result.current).toEqual({
			width: 400,
			height: 600,
		})
	})

	it("should update dimensions when scale changes", async () => {
		const { result, rerender } = renderHook(
			({ scale }) =>
				usePageDimensions({
					viewerRef: mockViewerRef as any,
					scale,
					numPages: 1,
				}),
			{
				initialProps: { scale: 1.0 },
			},
		)

		// Initial dimensions
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 350))
		})

		expect(result.current).toEqual({
			width: 400,
			height: 600,
		})

		// Change scale and mock new dimensions
		mockGetBoundingClientRect.mockReturnValue({
			width: 800,
			height: 1200,
		})

		rerender({ scale: 2.0 })

		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 150))
		})

		expect(result.current).toEqual({
			width: 800,
			height: 1200,
		})
	})

	it("should handle missing viewer ref gracefully", () => {
		const { result } = renderHook(() =>
			usePageDimensions({
				viewerRef: { current: null },
				scale: 1.0,
				numPages: 1,
			}),
		)

		expect(result.current).toEqual({
			width: 300,
			height: 400,
		})
	})

	it("should only update dimensions when change is significant", async () => {
		const { result, rerender } = renderHook(
			({ scale }) =>
				usePageDimensions({
					viewerRef: mockViewerRef as any,
					scale,
					numPages: 1,
				}),
			{
				initialProps: { scale: 1.0 },
			},
		)

		// Initial dimensions
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 350))
		})

		expect(result.current).toEqual({
			width: 400,
			height: 600,
		})

		// Small change (should not update)
		mockGetBoundingClientRect.mockReturnValue({
			width: 403, // Only 3px difference
			height: 602, // Only 2px difference
		})

		rerender({ scale: 1.1 })

		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 150))
		})

		// Should still have old dimensions
		expect(result.current).toEqual({
			width: 400,
			height: 600,
		})

		// Significant change (should update)
		mockGetBoundingClientRect.mockReturnValue({
			width: 450, // 50px difference
			height: 650, // 50px difference
		})

		rerender({ scale: 1.2 })

		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 150))
		})

		// Should have new dimensions
		expect(result.current).toEqual({
			width: 450,
			height: 650,
		})
	})
})
