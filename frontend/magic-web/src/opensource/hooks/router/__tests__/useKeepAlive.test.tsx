import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, render, screen } from "@testing-library/react"
import { useKeepAlive } from "../useKeepAlive"

// Mock react-router
const mockLocation = vi.fn()
const mockOutlet = vi.fn()
const MockOutlet = vi.fn()

vi.mock("react-router", () => ({
	useLocation: () => mockLocation(),
	useOutlet: () => mockOutlet(),
	Outlet: () => MockOutlet(),
}))

// Mock shouldKeepAlive function
const mockShouldKeepAlive = vi.fn()
vi.mock("@/opensource/constants/keepAliveRoutes", () => ({
	keepAliveRoutes: [
		{ path: "/cached-route", exact: true },
		{ path: "/another-cached", exact: true },
	],
	shouldKeepAlive: (pathname: string, routes: any[]) => mockShouldKeepAlive(pathname, routes),
}))

// Mock LoadingFallback component
vi.mock("@/opensource/components/fallback/LoadingFallback", () => ({
	default: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="loading-fallback">{children}</div>
	),
}))

describe("useKeepAlive", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockLocation.mockReturnValue({ pathname: "/test-route" })
		mockOutlet.mockReturnValue(<div data-testid="test-outlet">Test Outlet</div>)
		MockOutlet.mockReturnValue(<div data-testid="mock-outlet">Mock Outlet</div>)
		mockShouldKeepAlive.mockReturnValue(false)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("basic functionality", () => {
		it("should return Content component", () => {
			// Arrange & Act
			const { result } = renderHook(() => useKeepAlive())

			// Assert
			expect(result.current).toHaveProperty("Content")
			expect(typeof result.current.Content).toBe("object")
		})

		it("should render LoadingFallback with Outlet when no cache is needed", () => {
			// Arrange
			mockShouldKeepAlive.mockReturnValue(false)
			const { result } = renderHook(() => useKeepAlive())

			// Act
			render(<>{result.current.Content}</>)

			// Assert
			expect(screen.getByTestId("loading-fallback")).toBeInTheDocument()
			expect(screen.getByTestId("mock-outlet")).toBeInTheDocument()
			expect(mockShouldKeepAlive).toHaveBeenCalledWith("/test-route", expect.any(Array))
		})
	})

	describe("cache management", () => {
		it("should add cache when shouldKeepAlive returns true and outlet exists", () => {
			// Arrange
			mockShouldKeepAlive.mockReturnValue(true)
			mockLocation.mockReturnValue({ pathname: "/cached-route" })
			const testOutlet = <div data-testid="cached-outlet">Cached Content</div>
			mockOutlet.mockReturnValue(testOutlet)

			// Act
			const { result, rerender } = renderHook(() => useKeepAlive())
			rerender()

			// Assert
			render(<>{result.current.Content}</>)
			expect(screen.getByTestId("cached-outlet")).toBeInTheDocument()
		})

		it("should not add cache when outlet is null", () => {
			// Arrange
			mockShouldKeepAlive.mockReturnValue(true)
			mockOutlet.mockReturnValue(null)

			// Act
			const { result } = renderHook(() => useKeepAlive())

			// Assert
			render(<>{result.current.Content}</>)
			expect(screen.queryByTestId("cached-outlet")).not.toBeInTheDocument()
		})

		it("should not cache when shouldKeepAlive returns false from the start", () => {
			// Arrange
			mockLocation.mockReturnValue({ pathname: "/non-cached-route" })
			mockShouldKeepAlive.mockReturnValue(false)
			const testOutlet = <div data-testid="non-cached-outlet">Non-cached Content</div>
			mockOutlet.mockReturnValue(testOutlet)

			// Act
			const { result } = renderHook(() => useKeepAlive())

			// Assert - Should render outlet directly, not cache it
			render(<>{result.current.Content}</>)
			expect(screen.getByTestId("mock-outlet")).toBeInTheDocument()
			expect(screen.queryByTestId("non-cached-outlet")).not.toBeInTheDocument()
		})
	})

	describe("route switching", () => {
		it("should show active cached route and hide inactive ones", () => {
			// Arrange - Add first cached route
			mockLocation.mockReturnValue({ pathname: "/route-1" })
			mockShouldKeepAlive.mockReturnValue(true)
			const outlet1 = <div data-testid="outlet-1">Route 1 Content</div>
			mockOutlet.mockReturnValue(outlet1)

			const { result, rerender } = renderHook(() => useKeepAlive())
			rerender()

			// Add second cached route
			mockLocation.mockReturnValue({ pathname: "/route-2" })
			const outlet2 = <div data-testid="outlet-2">Route 2 Content</div>
			mockOutlet.mockReturnValue(outlet2)
			rerender()

			// Act - Switch back to first route
			mockLocation.mockReturnValue({ pathname: "/route-1" })
			mockOutlet.mockReturnValue(outlet1)
			rerender()

			// Assert
			render(<>{result.current.Content}</>)

			const route1Element = screen.getByTestId("outlet-1")
			const route2Element = screen.getByTestId("outlet-2")

			expect(route1Element).toBeInTheDocument()
			expect(route2Element).toBeInTheDocument()

			// Check that route-1 is visible (active)
			const route1Container = route1Element.closest(
				'[data-keepalive-id="keepalive-/route-1"]',
			)
			const route2Container = route2Element.closest(
				'[data-keepalive-id="keepalive-/route-2"]',
			)

			expect(route1Container).toHaveStyle({ display: "block" })
			expect(route2Container).toHaveStyle({ display: "none" })
		})

		it("should handle multiple cached routes correctly", () => {
			// Arrange
			const routes = ["/route-a", "/route-b", "/route-c"]
			const outlets = routes.map((route, index) => (
				<div key={route} data-testid={`outlet-${index}`}>
					Content for {route}
				</div>
			))

			mockShouldKeepAlive.mockReturnValue(true)

			const { result, rerender } = renderHook(() => useKeepAlive())

			// Act - Visit each route to cache them
			routes.forEach((route, index) => {
				mockLocation.mockReturnValue({ pathname: route })
				mockOutlet.mockReturnValue(outlets[index])
				rerender()
			})

			// Assert
			render(<>{result.current.Content}</>)

			// All outlets should be rendered
			routes.forEach((_, index) => {
				expect(screen.getByTestId(`outlet-${index}`)).toBeInTheDocument()
			})

			// Only the last route should be active
			const containers = routes.map((route) =>
				screen
					.getByTestId(`outlet-${routes.indexOf(route)}`)
					.closest(`[data-keepalive-id="keepalive-${route}"]`),
			)

			containers.forEach((container, index) => {
				if (index === routes.length - 1) {
					expect(container).toHaveStyle({ display: "block" })
				} else {
					expect(container).toHaveStyle({ display: "none" })
				}
			})
		})
	})

	describe("custom keepAliveRoutes configuration", () => {
		it("should use custom keepAliveRoutes when provided", () => {
			// Arrange
			const customRoutes = [{ path: "/custom-route", exact: true }]

			// Act
			renderHook(() => useKeepAlive({ keepAliveRoutes: customRoutes }))

			// Assert
			expect(mockShouldKeepAlive).toHaveBeenCalledWith("/test-route", customRoutes)
		})

		it("should use default keepAliveRoutes when not provided", () => {
			// Act
			renderHook(() => useKeepAlive())

			// Assert
			expect(mockShouldKeepAlive).toHaveBeenCalledWith("/test-route", expect.any(Array))
		})
	})

	describe("performance optimizations", () => {
		it("should not re-add cache for same route", () => {
			// Arrange
			mockLocation.mockReturnValue({ pathname: "/cached-route" })
			mockShouldKeepAlive.mockReturnValue(true)
			const testOutlet = <div data-testid="cached-outlet">Cached Content</div>
			mockOutlet.mockReturnValue(testOutlet)

			const { result, rerender } = renderHook(() => useKeepAlive())

			// Act - Multiple rerenders with same route
			rerender()
			rerender()
			rerender()

			// Assert - Only one cached element should exist
			render(<>{result.current.Content}</>)
			const cachedElements = screen.getAllByTestId("cached-outlet")
			expect(cachedElements).toHaveLength(1)
		})

		it("should memoize Content component properly", () => {
			// Arrange
			mockShouldKeepAlive.mockReturnValue(false)
			const { result, rerender } = renderHook(() => useKeepAlive())
			const firstContent = result.current.Content

			// Act - Rerender without changing dependencies
			rerender()
			const secondContent = result.current.Content

			// Assert - Content should be the same reference (memoized)
			expect(firstContent).toBe(secondContent)
		})
	})

	describe("edge cases", () => {
		it("should handle empty pathname", () => {
			// Arrange
			mockLocation.mockReturnValue({ pathname: "" })
			mockShouldKeepAlive.mockReturnValue(false)

			// Act
			const { result } = renderHook(() => useKeepAlive())

			// Assert
			expect(() => render(<>{result.current.Content}</>)).not.toThrow()
			expect(mockShouldKeepAlive).toHaveBeenCalledWith("", expect.any(Array))
		})

		it("should handle undefined outlet gracefully", () => {
			// Arrange
			mockOutlet.mockReturnValue(undefined)
			mockShouldKeepAlive.mockReturnValue(true)

			// Act
			const { result } = renderHook(() => useKeepAlive())

			// Assert
			expect(() => render(<>{result.current.Content}</>)).not.toThrow()
		})

		it("should handle route switching from cached to non-cached", () => {
			// Arrange - Start with cached route
			mockLocation.mockReturnValue({ pathname: "/cached-route" })
			mockShouldKeepAlive.mockReturnValue(true)
			const cachedOutlet = <div data-testid="cached-outlet">Cached Content</div>
			mockOutlet.mockReturnValue(cachedOutlet)

			const { result, rerender } = renderHook(() => useKeepAlive())
			rerender()

			// Act - Switch to non-cached route
			mockLocation.mockReturnValue({ pathname: "/non-cached-route" })
			mockShouldKeepAlive.mockReturnValue(false)
			const nonCachedOutlet = <div data-testid="non-cached-outlet">Non-cached Content</div>
			mockOutlet.mockReturnValue(nonCachedOutlet)
			rerender()

			// Assert
			render(<>{result.current.Content}</>)
			expect(screen.getByTestId("mock-outlet")).toBeInTheDocument()
			// The cached route should still be in the document but hidden
			// because we switched to a different route, not because the route itself is no longer cacheable
			expect(screen.getByTestId("cached-outlet")).toBeInTheDocument()

			// Check that the cached route is hidden
			const cachedContainer = screen
				.getByTestId("cached-outlet")
				.closest('[data-keepalive-id="keepalive-/cached-route"]')
			expect(cachedContainer).toHaveStyle({ display: "none" })
		})
	})

	describe("data attributes", () => {
		it("should add correct data-keepalive-id attributes", () => {
			// Arrange
			mockLocation.mockReturnValue({ pathname: "/test-route" })
			mockShouldKeepAlive.mockReturnValue(true)
			const testOutlet = <div data-testid="test-outlet">Test Content</div>
			mockOutlet.mockReturnValue(testOutlet)

			// Act
			const { result, rerender } = renderHook(() => useKeepAlive())
			rerender()

			// Assert
			render(<>{result.current.Content}</>)
			const container = screen.getByTestId("test-outlet").closest("[data-keepalive-id]")
			expect(container).toHaveAttribute("data-keepalive-id", "keepalive-/test-route")
		})
	})
})
