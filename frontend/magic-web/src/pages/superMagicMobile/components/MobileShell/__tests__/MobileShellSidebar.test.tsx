import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import MobileShellSidebar from "../MobileShellSidebar"
import { MobileShellMenuProvider, type MobileShellMenuContextValue } from "../MobileShellMenuContext"

const defaultOpenActionsPopup = vi.fn()
const chatOpenActionsPopup = vi.fn()
const useProjectListActionsMock = vi.fn()

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()

	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			userInfo: {
				nickname: "Tester",
				avatar: "",
			},
		},
	},
}))

vi.mock("@/layouts/BaseLayoutMobileV2/MobileSettingsContext", () => ({
	useMobileSettingsController: () => ({
		openSettings: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagicMobile/components/icons/MobileBrandLogoIcon", () => ({
	MobileBrandLogoIcon: () => <div data-testid="brand-icon" />,
}))

vi.mock("./useMobileShellUpgradeAction", () => ({
	useMobileShellUpgradeAction: () => ({
		isVisible: false,
		label: "",
		handleUpgradeClick: vi.fn(),
		handleUpgradePreload: vi.fn(),
	}),
}))

vi.mock("./hooks/useMobileShellVisibleActionKeys", () => ({
	useMobileShellVisibleActionKeys: () => ["rename", "move", "delete"],
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => vi.fn(),
}))

vi.mock("@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions", () => ({
	useProjectListActions: (options?: unknown) => useProjectListActionsMock(options),
}))

function renderSidebar(menuValue: MobileShellMenuContextValue) {
	return render(
		<MobileShellMenuProvider value={menuValue}>
			<MobileShellSidebar />
		</MobileShellMenuProvider>,
	)
}

describe("MobileShellSidebar", () => {
	beforeEach(() => {
		defaultOpenActionsPopup.mockReset()
		chatOpenActionsPopup.mockReset()
		useProjectListActionsMock.mockReset()
		useProjectListActionsMock
			.mockReturnValueOnce({
				openActionsPopup: defaultOpenActionsPopup,
				projectActionComponents: <div data-testid="default-project-actions" />,
			})
			.mockReturnValueOnce({
				openActionsPopup: chatOpenActionsPopup,
				projectActionComponents: <div data-testid="chat-project-actions" />,
			})
	})

	it("opens chat actions for recent chat items instead of default project actions", () => {
		const project = {
			id: "chat-project-1",
			project_name: "Recent chat",
			workspace_id: "chat-workspace",
		} as any

		renderSidebar({
			activeView: "chats",
			navItems: [],
			recentItems: [
				{
					id: project.id,
					title: project.project_name,
					project,
					inProgress: false,
					isPinned: false,
					isShared: false,
					isLinked: false,
					isChatProject: true,
				},
			],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
		})

		fireEvent.click(screen.getByTestId("mobile-super-shell-recent-actions-chat-project-1"))

		expect(chatOpenActionsPopup).toHaveBeenCalledWith(project)
		expect(defaultOpenActionsPopup).not.toHaveBeenCalled()
	})
})