import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: vi.fn(),
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()

	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

/** Tracks whether the mobile shell layout was mounted for the current render. */
const superMobileShellRouteLayoutMock = vi.fn(
	({ children }: { children: ReactNode }) => (
		<div data-testid="super-mobile-shell-route-layout">{children}</div>
	),
)

vi.mock("../SuperMobileShellRouteLayout", () => ({
	SuperMobileShellRouteLayout: (props: { children: ReactNode }) =>
		superMobileShellRouteLayoutMock(props),
}))

import { useIsMobile } from "@/hooks/useIsMobile"
import SuperMobileShellAppRouteLayout from "../SuperMobileShellAppRouteLayout"

/** Renders the app route layout with a child outlet page for shell mount assertions. */
function renderAppRouteLayout(initialPath = "/demo/super/chats") {
	return render(
		<MemoryRouter initialEntries={[initialPath]}>
			<Routes>
				<Route path="/:clusterCode/super/*" element={<SuperMobileShellAppRouteLayout />}>
					<Route path="chats" element={<div data-testid="child-page">child</div>} />
				</Route>
			</Routes>
		</MemoryRouter>,
	)
}

describe("SuperMobileShellAppRouteLayout", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("does not mount SuperMobileShellRouteLayout on desktop", () => {
		vi.mocked(useIsMobile).mockReturnValue(false)

		renderAppRouteLayout()

		expect(screen.queryByTestId("super-mobile-shell-route-layout")).toBeNull()
		expect(screen.getByTestId("child-page")).toBeInTheDocument()
		expect(superMobileShellRouteLayoutMock).not.toHaveBeenCalled()
	})

	it("mounts SuperMobileShellRouteLayout on mobile", () => {
		vi.mocked(useIsMobile).mockReturnValue(true)

		renderAppRouteLayout()

		expect(screen.getByTestId("super-mobile-shell-route-layout")).toBeInTheDocument()
		expect(screen.getByTestId("child-page")).toBeInTheDocument()
		expect(superMobileShellRouteLayoutMock).toHaveBeenCalled()
	})
})
