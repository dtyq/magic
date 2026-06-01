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
	({
		children,
		activeView,
		testIdPrefix,
	}: {
		children: ReactNode
		activeView: string
		testIdPrefix: string
	}) => (
		<div
			data-testid="super-mobile-shell-route-layout"
			data-active-view={activeView}
			data-prefix={testIdPrefix}
		>
			{children}
		</div>
	),
)

vi.mock("../SuperMobileShellRouteLayout", () => ({
	SuperMobileShellRouteLayout: (props: {
		children: ReactNode
		activeView: string
		testIdPrefix: string
	}) => superMobileShellRouteLayoutMock(props),
}))

import { useIsMobile } from "@/hooks/useIsMobile"
import SuperMobileShellAppRouteLayout from "../SuperMobileShellAppRouteLayout"

/** Renders the app route layout with a child outlet page for shell mount assertions. */
function renderAppRouteLayout(initialPath = "/demo/super/chats") {
	return render(
		<MemoryRouter initialEntries={[initialPath]}>
			<Routes>
				<Route path="/:clusterCode/*" element={<SuperMobileShellAppRouteLayout />}>
					<Route path="super/chats" element={<div data-testid="child-page">child</div>} />
					<Route path="my-crew" element={<div data-testid="child-page">child</div>} />
					<Route path="claw" element={<div data-testid="child-page">child</div>} />
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

	it.each([
		["/demo/my-crew", "myCrew", "my-crew-shell"],
		["/demo/claw", "magiClaw", "magi-claw-shell"],
	])("resolves persistent shell state for %s", (initialPath, activeView, testIdPrefix) => {
		vi.mocked(useIsMobile).mockReturnValue(true)

		renderAppRouteLayout(initialPath)

		const shell = screen.getByTestId("super-mobile-shell-route-layout")
		expect(shell).toHaveAttribute("data-active-view", activeView)
		expect(shell).toHaveAttribute("data-prefix", testIdPrefix)
		expect(screen.getByTestId("child-page")).toBeInTheDocument()
	})
})
