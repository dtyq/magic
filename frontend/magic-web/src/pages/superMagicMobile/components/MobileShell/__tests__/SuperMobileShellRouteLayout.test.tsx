import type { ReactNode } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import {
	SuperMobileShellRouteLayout,
	useSuperMobileShellOutlet,
} from "../SuperMobileShellRouteLayout"

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

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => vi.fn(),
}))

vi.mock("./MobileShellAppLayout", () => ({
	MobileShellAppLayout: ({
		panel,
		onCloseSidebar,
	}: {
		panel: ReactNode
		onCloseSidebar: () => void
	}) => (
		<div>
			<button type="button" onClick={onCloseSidebar} data-testid="close-sidebar">
				close
			</button>
			{panel}
		</div>
	),
}))

vi.mock("./MobileShellSidebar", () => ({
	default: () => <div data-testid="mobile-shell-sidebar" />,
}))

vi.mock("./useRecentProjectsForMenu", () => ({
	useRecentProjectsForMenu: () => ({
		recentItems: [],
		reloadRecentItems: reloadRecentItemsMock,
	}),
}))

vi.mock("@/layouts/BaseLayoutMobile/components/MobileSettings", () => ({
	MobileSettingsPanel: () => null,
}))

vi.mock("@/layouts/BaseLayoutMobileV2/MobileSettingsContext", () => ({
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
})
