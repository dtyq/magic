import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { DesktopOnlyRoute, MobileOnlyRoute } from "../ViewportRouteGuard"

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: vi.fn(),
}))

vi.mock("@/routes/components/Navigate", () => ({
	default: ({ name }: { name: string }) => <div data-testid="navigate">{name}</div>,
}))

import { useIsMobile } from "@/hooks/useIsMobile"

describe("ViewportRouteGuard", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("DesktopOnlyRoute redirects when mobile", () => {
		vi.mocked(useIsMobile).mockReturnValue(true)
		render(
			<DesktopOnlyRoute>
				<div data-testid="child" />
			</DesktopOnlyRoute>,
		)
		expect(screen.getByTestId("navigate")).toHaveTextContent("MobileHome")
		expect(screen.queryByTestId("child")).toBeNull()
	})

	it("DesktopOnlyRoute renders children on desktop", () => {
		vi.mocked(useIsMobile).mockReturnValue(false)
		render(
			<DesktopOnlyRoute>
				<div data-testid="child" />
			</DesktopOnlyRoute>,
		)
		expect(screen.getByTestId("child")).toBeInTheDocument()
	})

	it("MobileOnlyRoute redirects when desktop", () => {
		vi.mocked(useIsMobile).mockReturnValue(false)
		render(
			<MobileOnlyRoute>
				<div data-testid="child" />
			</MobileOnlyRoute>,
		)
		expect(screen.getByTestId("navigate")).toHaveTextContent("Super")
	})

	it("MobileOnlyRoute renders children on mobile", () => {
		vi.mocked(useIsMobile).mockReturnValue(true)
		render(
			<MobileOnlyRoute>
				<div data-testid="child" />
			</MobileOnlyRoute>,
		)
		expect(screen.getByTestId("child")).toBeInTheDocument()
	})
})
