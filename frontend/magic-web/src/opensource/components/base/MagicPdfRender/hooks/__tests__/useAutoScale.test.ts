import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
// @ts-ignore
import { useAutoScale } from "../useAutoScale"

// Mock DOM methods
const mockGetBoundingClientRect = vi.fn()
const mockQuerySelector = vi.fn()

// Mock window.devicePixelRatio
Object.defineProperty(window, "devicePixelRatio", {
	writable: true,
	value: 1,
})

describe("useAutoScale", () => {
	let containerRef: React.RefObject<HTMLDivElement>
	let viewerRef: React.RefObject<HTMLDivElement>
	let mockSetScale: ReturnType<typeof vi.fn>
	let mockSetIsAutoScaling: ReturnType<typeof vi.fn>
	let mockSetIsStabilizing: ReturnType<typeof vi.fn>

	beforeEach(() => {
		// Reset mocks
		mockGetBoundingClientRect.mockReset()
		mockQuerySelector.mockReset()
		mockSetScale = vi.fn()
		mockSetIsAutoScaling = vi.fn()
		mockSetIsStabilizing = vi.fn()

		// Create mock refs
		containerRef = {
			current: {
				getBoundingClientRect: mockGetBoundingClientRect,
			} as any,
		}

		viewerRef = {
			current: {
				querySelector: mockQuerySelector,
			} as any,
		}

		// Setup default mock returns
		mockGetBoundingClientRect.mockReturnValue({
			width: 800,
			height: 600,
		})

		mockQuerySelector.mockReturnValue({
			width: 400,
			height: 600,
		} as HTMLCanvasElement)

		// Mock requestAnimationFrame to execute immediately
		vi.spyOn(global, "requestAnimationFrame").mockImplementation((fn: any) => {
			fn()
			return 0 as any
		})

		// Mock setTimeout to execute immediately
		vi.spyOn(global, "setTimeout").mockImplementation((fn: any) => {
			fn()
			return 0 as any
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should calculate optimal scale correctly", () => {
		const { result } = renderHook(() =>
			useAutoScale({
				containerRef,
				viewerRef,
				minScale: 0.5,
				maxScale: 3.0,
				setScale: mockSetScale,
				setIsAutoScaling: mockSetIsAutoScaling,
				setIsStabilizing: mockSetIsStabilizing,
				showToolbar: true,
			}),
		)

		// Test calculateOptimalScale function
		const optimalScale = result.current.calculateOptimalScale(400, 600)

		// Expected calculation:
		// Container: 800x600, Toolbar: 48, Padding: 32, Scrollbar: 16
		// Available: (800-32-16) x (600-48-32) = 752 x 520
		// Scale by width: 752/400 = 1.88
		// Scale by height: 520/600 = 0.87
		// Min scale: 0.87 (rounded to 0.87)
		expect(optimalScale).toBe(0.87)
	})

	it("should apply auto scale when first page loads", () => {
		const { result } = renderHook(() =>
			useAutoScale({
				containerRef,
				viewerRef,
				minScale: 0.5,
				maxScale: 3.0,
				setScale: mockSetScale,
				setIsAutoScaling: mockSetIsAutoScaling,
				setIsStabilizing: mockSetIsStabilizing,
				showToolbar: true,
			}),
		)

		act(() => {
			result.current.applyAutoScale()
		})

		expect(mockSetIsAutoScaling).toHaveBeenCalledWith(true)
		expect(mockQuerySelector).toHaveBeenCalledWith('[data-page-number="1"] canvas')
		expect(mockSetScale).toHaveBeenCalledWith(0.87)
		expect(mockSetIsAutoScaling).toHaveBeenCalledWith(false)
	})

	it("should not apply auto scale twice", () => {
		const { result } = renderHook(() =>
			useAutoScale({
				containerRef,
				viewerRef,
				minScale: 0.5,
				maxScale: 3.0,
				setScale: mockSetScale,
				setIsAutoScaling: mockSetIsAutoScaling,
				setIsStabilizing: mockSetIsStabilizing,
				showToolbar: true,
			}),
		)

		// Apply auto scale first time
		act(() => {
			result.current.applyAutoScale()
		})

		// Try to apply again
		act(() => {
			result.current.applyAutoScale()
		})

		// Should only be called once for setScale, but setIsAutoScaling might be called multiple times
		expect(mockSetScale).toHaveBeenCalledTimes(1)
	})

	it("should reset auto scale flag and state", () => {
		const { result } = renderHook(() =>
			useAutoScale({
				containerRef,
				viewerRef,
				minScale: 0.5,
				maxScale: 3.0,
				setScale: mockSetScale,
				setIsAutoScaling: mockSetIsAutoScaling,
				setIsStabilizing: mockSetIsStabilizing,
				showToolbar: true,
			}),
		)

		// Apply auto scale
		act(() => {
			result.current.applyAutoScale()
		})

		// Reset flag
		act(() => {
			result.current.resetAutoScale()
		})

		expect(mockSetIsAutoScaling).toHaveBeenCalledWith(false)

		// Should be able to apply again
		act(() => {
			result.current.applyAutoScale()
		})

		expect(mockSetScale).toHaveBeenCalledTimes(2)
	})

	it("should respect min and max scale bounds", () => {
		// Mock a very small container
		mockGetBoundingClientRect.mockReturnValue({
			width: 100,
			height: 100,
		})

		const { result } = renderHook(() =>
			useAutoScale({
				containerRef,
				viewerRef,
				minScale: 0.5,
				maxScale: 1.0,
				setScale: mockSetScale,
				setIsAutoScaling: mockSetIsAutoScaling,
				setIsStabilizing: mockSetIsStabilizing,
				showToolbar: true,
			}),
		)

		const optimalScale = result.current.calculateOptimalScale(400, 600)

		// Should be clamped to minScale
		expect(optimalScale).toBe(0.5)
	})

	it("should handle missing canvas element gracefully", () => {
		mockQuerySelector.mockReturnValue(null)

		const { result } = renderHook(() =>
			useAutoScale({
				containerRef,
				viewerRef,
				minScale: 0.5,
				maxScale: 3.0,
				setScale: mockSetScale,
				setIsAutoScaling: mockSetIsAutoScaling,
				setIsStabilizing: mockSetIsStabilizing,
				showToolbar: true,
			}),
		)

		act(() => {
			result.current.applyAutoScale()
		})

		// Should set isAutoScaling to true initially, then false when canvas not found
		expect(mockSetIsAutoScaling).toHaveBeenCalledWith(true)
		expect(mockSetIsAutoScaling).toHaveBeenCalledWith(false)
		// Should not call setScale if canvas is not found
		expect(mockSetScale).not.toHaveBeenCalled()
	})

	it("should adjust calculation when toolbar is hidden", () => {
		const { result } = renderHook(() =>
			useAutoScale({
				containerRef,
				viewerRef,
				minScale: 0.5,
				maxScale: 3.0,
				setScale: mockSetScale,
				setIsAutoScaling: mockSetIsAutoScaling,
				setIsStabilizing: mockSetIsStabilizing,
				showToolbar: false, // No toolbar
			}),
		)

		const optimalScale = result.current.calculateOptimalScale(400, 600)

		// Expected calculation without toolbar:
		// Available height: 600-32 = 568 (no toolbar height)
		// Scale by height: 568/600 = 0.95
		expect(optimalScale).toBe(0.95)
	})
})
