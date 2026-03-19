import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
// @ts-ignore
import { usePdfActions } from "../usePdfActions"

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock antd message
vi.mock("antd", () => ({
	message: {
		warning: vi.fn(),
	},
}))

describe("usePdfActions", () => {
	const mockSetters = {
		setPageNumber: vi.fn(),
		setScale: vi.fn(),
		setRotation: vi.fn(),
		setLoading: vi.fn(),
		setError: vi.fn(),
		setNumPages: vi.fn(),
		setReloadKey: vi.fn(),
	}

	const mockRefs = {
		viewerRef: { current: null as HTMLDivElement | null },
		containerRef: { current: null as HTMLDivElement | null },
	}

	const defaultProps = {
		numPages: 10,
		pageNumber: 1,
		scale: 1.0,
		minScale: 0.5,
		maxScale: 3.0,
		scaleStep: 0.1,
		initialScale: 1.0,
		file: null,
		...mockSetters,
		...mockRefs,
	}

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock DOM elements
		const mockViewer = document.createElement("div")
		const mockContainer = document.createElement("div")

		// Mock scrollTo method
		mockViewer.scrollTo = vi.fn()

		mockRefs.viewerRef.current = mockViewer
		mockRefs.containerRef.current = mockContainer
	})

	describe("goToPage", () => {
		it("should navigate to valid page and scroll correctly", () => {
			const { result } = renderHook(() => usePdfActions(defaultProps))

			// Mock page element
			const mockPageElement = document.createElement("div")
			mockPageElement.setAttribute("data-page-number", "5")

			// Mock getBoundingClientRect
			mockPageElement.getBoundingClientRect = vi.fn(() => ({
				top: 500,
				left: 0,
				right: 0,
				bottom: 600,
				width: 400,
				height: 100,
				x: 0,
				y: 500,
				toJSON: vi.fn(),
			}))

			const mockViewer = mockRefs.viewerRef.current!
			mockViewer.getBoundingClientRect = vi.fn(() => ({
				top: 100,
				left: 0,
				right: 0,
				bottom: 700,
				width: 800,
				height: 600,
				x: 0,
				y: 100,
				toJSON: vi.fn(),
			}))

			mockViewer.scrollTop = 0
			mockViewer.querySelector = vi.fn(() => mockPageElement)

			act(() => {
				result.current.goToPage(5)
			})

			expect(mockSetters.setPageNumber).toHaveBeenCalledWith(5)
			expect(mockViewer.scrollTo).toHaveBeenCalledWith({
				top: 380, // 500 - 100 + 0 - 20 = 380
				behavior: "smooth",
			})
		})

		it("should not navigate to invalid page", () => {
			const { result } = renderHook(() => usePdfActions(defaultProps))

			act(() => {
				result.current.goToPage(15) // Invalid page (> numPages)
			})

			expect(mockSetters.setPageNumber).not.toHaveBeenCalled()
		})

		it("should handle missing page element gracefully", () => {
			const { result } = renderHook(() => usePdfActions(defaultProps))

			const mockViewer = mockRefs.viewerRef.current!
			mockViewer.querySelector = vi.fn(() => null)

			act(() => {
				result.current.goToPage(5)
			})

			expect(mockSetters.setPageNumber).toHaveBeenCalledWith(5)
			expect(mockViewer.scrollTo).not.toHaveBeenCalled()
		})
	})

	describe("goToPrevPage", () => {
		it("should navigate to previous page", () => {
			const props = { ...defaultProps, pageNumber: 5 }
			const { result } = renderHook(() => usePdfActions(props))

			const mockViewer = mockRefs.viewerRef.current!
			mockViewer.querySelector = vi.fn(() => null)

			act(() => {
				result.current.goToPrevPage()
			})

			expect(mockSetters.setPageNumber).toHaveBeenCalledWith(4)
		})

		it("should not go below page 1", () => {
			const props = { ...defaultProps, pageNumber: 1 }
			const { result } = renderHook(() => usePdfActions(props))

			const mockViewer = mockRefs.viewerRef.current!
			mockViewer.querySelector = vi.fn(() => null)

			act(() => {
				result.current.goToPrevPage()
			})

			expect(mockSetters.setPageNumber).toHaveBeenCalledWith(1)
		})
	})

	describe("goToNextPage", () => {
		it("should navigate to next page", () => {
			const props = { ...defaultProps, pageNumber: 5 }
			const { result } = renderHook(() => usePdfActions(props))

			const mockViewer = mockRefs.viewerRef.current!
			mockViewer.querySelector = vi.fn(() => null)

			act(() => {
				result.current.goToNextPage()
			})

			expect(mockSetters.setPageNumber).toHaveBeenCalledWith(6)
		})

		it("should not go beyond last page", () => {
			const props = { ...defaultProps, pageNumber: 10 }
			const { result } = renderHook(() => usePdfActions(props))

			const mockViewer = mockRefs.viewerRef.current!
			mockViewer.querySelector = vi.fn(() => null)

			act(() => {
				result.current.goToNextPage()
			})

			expect(mockSetters.setPageNumber).toHaveBeenCalledWith(10)
		})
	})

	describe("zoom actions", () => {
		it("should zoom in within max scale", () => {
			const { result } = renderHook(() => usePdfActions(defaultProps))

			act(() => {
				result.current.zoomIn()
			})

			expect(mockSetters.setScale).toHaveBeenCalledWith(expect.any(Function))
		})

		it("should zoom out within min scale", () => {
			const { result } = renderHook(() => usePdfActions(defaultProps))

			act(() => {
				result.current.zoomOut()
			})

			expect(mockSetters.setScale).toHaveBeenCalledWith(expect.any(Function))
		})

		it("should set zoom scale correctly", () => {
			const { result } = renderHook(() => usePdfActions(defaultProps))

			act(() => {
				result.current.setZoomScale(150) // 150%
			})

			expect(mockSetters.setScale).toHaveBeenCalledWith(1.5)
		})
	})
})
