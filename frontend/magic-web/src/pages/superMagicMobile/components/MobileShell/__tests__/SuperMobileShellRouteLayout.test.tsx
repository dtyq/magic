import type { ReactNode } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	SuperMobileShellRouteLayout,
	useSuperMobileShellOutlet,
} from "../SuperMobileShellRouteLayout"

const setDocumentThemeSidebarOpenMock = vi.fn()

vi.mock("@/pages/superMagicMobile/components/MobileDocumentTheme", () => ({
	useMobileDocumentThemeControl: () => ({
		setSidebarOpen: setDocumentThemeSidebarOpenMock,
	}),
}))

const reloadRecentItemsMock = vi.fn<() => Promise<void>>()

vi.mock("@/layouts/BaseLayoutMobile/components/MobileTabBar/constants/tabsConfig.shared", () => ({
	hasOrganizationAppsShortcuts: () => false,
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			isPersonalOrganization: false,
		},
	},
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

const { navigateMock } = vi.hoisted(() => ({
	navigateMock: vi.fn(),
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => navigateMock,
}))

vi.mock("../MobileShellAppLayout", () => ({
	MobileShellAppLayout: ({
		panel,
		isSidebarOpen,
		onCloseSidebar,
		menuValue,
	}: {
		panel: ReactNode
		isSidebarOpen: boolean
		onCloseSidebar: () => void
		menuValue: { onGoHome: () => void; onNavigate: (key: string) => void }
	}) => (
		<div data-sidebar-open={isSidebarOpen}>
			<button type="button" onClick={onCloseSidebar} data-testid="close-sidebar">
				close
			</button>
			<button type="button" onClick={menuValue.onGoHome} data-testid="go-home">
				home
			</button>
			<button
				type="button"
				onClick={() => menuValue.onNavigate("workspaces")}
				data-testid="go-workspaces"
			>
				workspaces
			</button>
			{panel}
		</div>
	),
}))

vi.mock("../MobileShellSidebar", () => ({
	default: () => <div data-testid="mobile-shell-sidebar" />,
}))

vi.mock("../useRecentProjectsForMenu", () => ({
	useRecentProjectsForMenu: () => ({
		recentItems: [],
		reloadRecentItems: reloadRecentItemsMock,
		loadMoreRecentItems: vi.fn(),
		hasMore: false,
	}),
}))

vi.mock("@/layouts/BaseLayoutMobile/components/MobileSettings", () => ({
	MobileSettingsPanel: () => null,
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell/MobileSettingsContext", () => ({
	MobileSettingsProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/pages/superMagicMobile/components/icons/MagiClawNavIcon", () => ({
	MagiClawNavIcon: () => null,
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		switchChatProject: vi.fn(),
		switchProjectInMobile: vi.fn(),
	},
}))

function OpenSidebarButton() {
	const { openSidebar } = useSuperMobileShellOutlet()

	return (
		<button type="button" onClick={openSidebar} data-testid="open-sidebar">
			open
		</button>
	)
}

describe("SuperMobileShellRouteLayout", () => {
	beforeEach(() => {
		reloadRecentItemsMock.mockReset()
		reloadRecentItemsMock.mockResolvedValue(undefined)
		setDocumentThemeSidebarOpenMock.mockReset()
		navigateMock.mockReset()
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			return window.setTimeout(() => callback(performance.now()), 0)
		})
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
			window.clearTimeout(frameId)
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("silently reloads recent items whenever the sidebar opens", async () => {
		render(
			<SuperMobileShellRouteLayout activeView="chats" closeSidebarAriaLabel="close">
				<OpenSidebarButton />
			</SuperMobileShellRouteLayout>,
		)

		expect(reloadRecentItemsMock).not.toHaveBeenCalled()

		fireEvent.click(screen.getByTestId("open-sidebar"))

		await waitFor(() => {
			expect(reloadRecentItemsMock).toHaveBeenCalledTimes(1)
		})

		fireEvent.click(screen.getByTestId("close-sidebar"))
		fireEvent.click(screen.getByTestId("open-sidebar"))

		await waitFor(() => {
			expect(reloadRecentItemsMock).toHaveBeenCalledTimes(2)
		})
	})

	it("navigates home without view transition when brand logo is clicked", () => {
		render(
			<SuperMobileShellRouteLayout activeView="chats" closeSidebarAriaLabel="close">
				<div />
			</SuperMobileShellRouteLayout>,
		)

		fireEvent.click(screen.getByTestId("go-home"))

		expect(navigateMock).toHaveBeenCalledWith({
			name: "MobileHome",
			viewTransition: false,
		})
	})

	it("navigates shell menu items without view transition", () => {
		render(
			<SuperMobileShellRouteLayout activeView="myCrew" closeSidebarAriaLabel="close">
				<div />
			</SuperMobileShellRouteLayout>,
		)

		fireEvent.click(screen.getByTestId("go-workspaces"))

		expect(navigateMock).toHaveBeenCalledWith({
			name: "SuperWorkspacesList",
			viewTransition: false,
		})
	})

	it("defers sidebar menu navigation until the close transition has started", async () => {
		render(
			<SuperMobileShellRouteLayout activeView="myCrew" closeSidebarAriaLabel="close">
				<OpenSidebarButton />
			</SuperMobileShellRouteLayout>,
		)

		fireEvent.click(screen.getByTestId("open-sidebar"))
		fireEvent.click(screen.getByTestId("go-workspaces"))

		expect(navigateMock).not.toHaveBeenCalled()

		await waitFor(() => {
			expect(navigateMock).toHaveBeenCalledWith({
				name: "SuperWorkspacesList",
				viewTransition: false,
			})
		})
	})
})
