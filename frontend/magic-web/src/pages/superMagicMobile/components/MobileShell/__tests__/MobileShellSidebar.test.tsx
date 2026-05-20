import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import MobileShellSidebar from "../MobileShellSidebar"
import { MobileShellMenuProvider, type MobileShellMenuContextValue } from "../MobileShellMenuContext"

function TestIcon(props: React.SVGProps<SVGSVGElement>) {
	return <svg {...props} />
}

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

vi.mock("@/pages/superMagicMobile/components/MobileShell/MobileSettingsContext", () => ({
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

	it("keeps recording in the primary menu group with chats and workspaces", () => {
		renderSidebar({
			activeView: "chats",
			navItems: [
				{ key: "chats", icon: TestIcon, label: "对话" },
				{ key: "workspaces", icon: TestIcon, label: "工作空间" },
				{ key: "recording", icon: TestIcon, label: "录音与纪要" },
				{ key: "myCrew", icon: TestIcon, label: "我的 Crew" },
			],
			recentItems: [],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
		})

		const chatsButton = screen.getByTestId("mobile-super-shell-nav-chats")
		const workspacesButton = screen.getByTestId("mobile-super-shell-nav-workspaces")
		const recordingButton = screen.getByTestId("mobile-super-shell-nav-recording")
		const myCrewButton = screen.getByTestId("mobile-super-shell-nav-myCrew")

		expect(chatsButton.parentElement).toBe(workspacesButton.parentElement)
		expect(recordingButton.parentElement).toBe(chatsButton.parentElement)
		expect(myCrewButton.parentElement).not.toBe(chatsButton.parentElement)
	})

	it("keeps my crew in the secondary menu group instead of the chats and workspaces group", () => {
		renderSidebar({
			activeView: "chats",
			navItems: [
				{ key: "chats", icon: TestIcon, label: "对话" },
				{ key: "workspaces", icon: TestIcon, label: "工作空间" },
				{ key: "myCrew", icon: TestIcon, label: "我的 Crew" },
				{ key: "magiClaw", icon: TestIcon, label: "MagiClaw" },
				{ key: "apps", icon: TestIcon, label: "应用" },
				{ key: "trash", icon: TestIcon, label: "回收站" },
			],
			recentItems: [],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
		})

		const chatsButton = screen.getByTestId("mobile-super-shell-nav-chats")
		const workspacesButton = screen.getByTestId("mobile-super-shell-nav-workspaces")
		const myCrewButton = screen.getByTestId("mobile-super-shell-nav-myCrew")

		expect(chatsButton.parentElement).toBe(workspacesButton.parentElement)
		expect(myCrewButton.parentElement).not.toBe(chatsButton.parentElement)
	})
})