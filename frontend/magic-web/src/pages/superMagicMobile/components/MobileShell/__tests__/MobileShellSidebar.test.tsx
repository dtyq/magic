import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MagiClawNavIcon } from "@/pages/superMagicMobile/components/icons/MagiClawNavIcon"
import { getAvatarColor } from "@/utils/avatar-color"
import MobileShellSidebar from "../MobileShellSidebar"
import {
	MobileShellMenuProvider,
	type MobileShellMenuContextValue,
} from "../MobileShellMenuContext"

function TestIcon(props: React.SVGProps<SVGSVGElement>) {
	return <svg {...props} />
}

const defaultOpenActionsPopup = vi.fn()
const chatOpenActionsPopup = vi.fn()
const defaultUpdateCurrentActionItem = vi.fn()
const chatUpdateCurrentActionItem = vi.fn()
const mockProjectActions = [
	{ key: "rename", label: "Rename", onClick: vi.fn(), variant: "default" as const },
	{ key: "delete", label: "Delete", onClick: vi.fn(), variant: "danger" as const },
]
const useProjectListActionsMock = vi.fn()

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()

	return {
		...actual,
		useTranslation: (ns?: string | string[]) => {
			const namespace = Array.isArray(ns) ? ns[0] : ns

			return {
				t: (key: string) => {
					if (namespace === "common" && key === "platform.name") {
						return "Configured Brand"
					}
					return key
				},
			}
		},
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

vi.mock("@/pages/superMagicMobile/components/MobileBrandLogo", () => ({
	MobileBrandLogo: () => <img data-testid="brand-logo" alt="Configured Brand" />,
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
	MOBILE_PROJECT_ACTION_ORDER: [
		"rename",
		"move",
		"enterWorkspace",
		"setCollaborators",
		"transfer",
		"delete",
	],
	SHELL_RECENT_CHAT_ACTION_KEYS: ["rename", "saveAsProject", "delete"],
	useMobileShellVisibleActionKeys: () => [
		"rename",
		"move",
		"enterWorkspace",
		"setCollaborators",
		"transfer",
		"delete",
	],
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => vi.fn(),
}))

vi.mock("@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions", () => ({
	useProjectListActions: (options?: unknown) => useProjectListActionsMock(options),
}))

vi.mock("antd-mobile", () => ({
	InfiniteScroll: () => <div data-testid="infinite-scroll" />,
}))

/** Dispatches touch events with coordinates so ahooks useLongPress can read clientX/clientY. */
function touchStart(element: Element) {
	fireEvent.touchStart(element, {
		touches: [{ clientX: 0, clientY: 0 }],
		targetTouches: [{ clientX: 0, clientY: 0 }],
		changedTouches: [{ clientX: 0, clientY: 0 }],
	})
}

function touchEnd(element: Element) {
	fireEvent.touchEnd(element, {
		touches: [],
		targetTouches: [],
		changedTouches: [{ clientX: 0, clientY: 0 }],
	})
}

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
		defaultUpdateCurrentActionItem.mockReset()
		chatUpdateCurrentActionItem.mockReset()
		useProjectListActionsMock.mockReset()
		// Stable implementation so refresh-triggered re-renders do not exhaust one-shot mocks.
		useProjectListActionsMock.mockImplementation((options?: { mode?: string }) => {
			if (options?.mode === "chat") {
				return {
					openActionsPopup: chatOpenActionsPopup,
					updateCurrentActionItem: chatUpdateCurrentActionItem,
					projectActions: mockProjectActions,
					projectActionComponents: <div data-testid="chat-project-actions" />,
				}
			}

			return {
				openActionsPopup: defaultOpenActionsPopup,
				updateCurrentActionItem: defaultUpdateCurrentActionItem,
				projectActions: mockProjectActions,
				projectActionComponents: <div data-testid="default-project-actions" />,
			}
		})
	})

	it("renders configured brand name and logo in the sidebar header", () => {
		renderSidebar({
			activeView: "chats",
			navItems: [],
			recentItems: [],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
			hasMore: false,
			loadMoreRecentItems: vi.fn(),
		})

		expect(screen.getByText("Configured Brand")).toBeInTheDocument()
		expect(screen.getByTestId("brand-logo")).toBeInTheDocument()
	})

	it("renders account pill with prototype shadow, 24px avatar, and colored fallback", () => {
		renderSidebar({
			activeView: "chats",
			navItems: [],
			recentItems: [],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
			hasMore: false,
			loadMoreRecentItems: vi.fn(),
		})

		const pill = screen.getByTestId("mobile-super-shell-account-pill")
		expect(pill.style.boxShadow).toContain("25px 50px -12px")
		expect(pill).toHaveClass("pl-[6px]", "pr-[10px]", "py-[6px]")

		const avatarRoot = pill.querySelector('[data-slot="avatar"]')
		expect(avatarRoot).toHaveClass("size-6")

		const fallback = pill.querySelector('[data-slot="avatar-fallback"]')
		const colors = getAvatarColor("Tester")
		expect(fallback).toHaveStyle({
			backgroundColor: colors.bg,
			color: colors.text,
		})
	})

	it("wires shell-recent project whitelist and chat actions without pin", () => {
		renderSidebar({
			activeView: "chats",
			navItems: [],
			recentItems: [],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
			hasMore: false,
			loadMoreRecentItems: vi.fn(),
		})

		expect(useProjectListActionsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				actionContext: "shell-recent",
				visibleActionKeys: [
					"rename",
					"move",
					"enterWorkspace",
					"setCollaborators",
					"transfer",
					"delete",
				],
			}),
		)
		expect(useProjectListActionsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				mode: "chat",
				visibleActionKeys: ["rename", "saveAsProject", "delete"],
			}),
		)
	})

	describe("recent item touch gestures", () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

	it("navigates on short tap of a recent item title", () => {
		const onRecentNavigate = vi.fn()
		const project = {
			id: "project-1",
			project_name: "Recent",
			workspace_id: "ws-1",
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
					isShared: false,
					isLinked: false,
					isChatProject: false,
				},
			],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate,
			reloadRecentItems: vi.fn(),
			hasMore: false,
			loadMoreRecentItems: vi.fn(),
		})

		const titleButton = screen.getByTestId("mobile-super-shell-recent-project-1")
		touchStart(titleButton)
		touchEnd(titleButton)

		expect(onRecentNavigate).toHaveBeenCalledWith(
			expect.objectContaining({ id: "project-1" }),
		)
		expect(defaultOpenActionsPopup).not.toHaveBeenCalled()
	})

	it("opens floating menu on long press of a recent item title", () => {
		const project = {
			id: "project-1",
			project_name: "Recent",
			workspace_id: "ws-1",
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
					isShared: false,
					isLinked: false,
					isChatProject: false,
				},
			],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
			hasMore: false,
			loadMoreRecentItems: vi.fn(),
		})

		const titleButton = screen.getByTestId("mobile-super-shell-recent-project-1")
		act(() => {
			touchStart(titleButton)
			vi.advanceTimersByTime(500)
			touchEnd(titleButton)
		})

		expect(defaultUpdateCurrentActionItem).toHaveBeenCalledWith(project)
		expect(defaultOpenActionsPopup).not.toHaveBeenCalled()
		expect(screen.getByTestId("mobile-super-shell-recent-floating-menu")).toBeInTheDocument()
		expect(screen.getByText("Rename")).toBeInTheDocument()
		expect(screen.getByText("Delete")).toBeInTheDocument()
	})

	it("does not open actions on long press when recent item has no project", () => {
		renderSidebar({
			activeView: "chats",
			navItems: [],
			recentItems: [
				{
					id: "recent-no-project",
					title: "Recent",
					inProgress: false,
					isShared: false,
					isLinked: false,
					isChatProject: false,
				},
			],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
			hasMore: false,
			loadMoreRecentItems: vi.fn(),
		})

		const titleButton = screen.getByTestId("mobile-super-shell-recent-recent-no-project")
		touchStart(titleButton)
		vi.advanceTimersByTime(500)
		touchEnd(titleButton)

		expect(defaultOpenActionsPopup).not.toHaveBeenCalled()
		expect(chatOpenActionsPopup).not.toHaveBeenCalled()
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
					isShared: false,
					isLinked: false,
					isChatProject: true,
				},
			],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
			hasMore: false,
			loadMoreRecentItems: vi.fn(),
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
				{ key: "myCrew", icon: TestIcon, label: "数字员工" },
			],
			recentItems: [],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
			hasMore: false,
			loadMoreRecentItems: vi.fn(),
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
				{ key: "myCrew", icon: TestIcon, label: "数字员工" },
				{ key: "magiClaw", icon: TestIcon, label: "超级龙虾" },
				{ key: "apps", icon: TestIcon, label: "应用" },
				{ key: "trash", icon: TestIcon, label: "回收站" },
			],
			recentItems: [],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
			hasMore: false,
			loadMoreRecentItems: vi.fn(),
		})

		const chatsButton = screen.getByTestId("mobile-super-shell-nav-chats")
		const workspacesButton = screen.getByTestId("mobile-super-shell-nav-workspaces")
		const myCrewButton = screen.getByTestId("mobile-super-shell-nav-myCrew")

		expect(chatsButton.parentElement).toBe(workspacesButton.parentElement)
		expect(myCrewButton.parentElement).not.toBe(chatsButton.parentElement)
	})

	it("does not apply route-active card styling to nav items", () => {
		renderSidebar({
			activeView: "chats",
			navItems: [{ key: "chats", icon: TestIcon, label: "对话" }],
			recentItems: [],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
			hasMore: false,
			loadMoreRecentItems: vi.fn(),
		})

		const chatsButton = screen.getByTestId("mobile-super-shell-nav-chats")
		expect(chatsButton.className).not.toContain("shadow-sm")
		expect(chatsButton.className).not.toContain("active:bg-black/5")
	})

	it("renders primary nav icons at size-4 (16px) to match prototype", () => {
		renderSidebar({
			activeView: "chats",
			navItems: [
				{ key: "chats", icon: TestIcon, label: "对话" },
				{ key: "magiClaw", icon: MagiClawNavIcon, label: "超级龙虾" },
			],
			recentItems: [],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
			hasMore: false,
			loadMoreRecentItems: vi.fn(),
		})

		const chatsIcon = screen.getByTestId("mobile-super-shell-nav-chats").querySelector("svg")
		const magiClawIcon = screen
			.getByTestId("mobile-super-shell-nav-magiClaw")
			.querySelector("svg")

		expect(chatsIcon).toHaveClass("size-4")
		expect(magiClawIcon).toHaveClass("size-4")
		expect(magiClawIcon).toHaveAttribute("viewBox", "0 0 16 16")
	})

	it("calls reloadRecentItems when recent refresh button is clicked", async () => {
		const reloadRecentItems = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

		renderSidebar({
			activeView: "chats",
			navItems: [],
			recentItems: [
				{
					id: "recent-1",
					title: "Recent",
					inProgress: false,
					isShared: false,
					isLinked: false,
					isChatProject: false,
				},
			],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems,
			hasMore: false,
			loadMoreRecentItems: vi.fn(),
		})

		fireEvent.click(screen.getByTestId("mobile-super-shell-recent-refresh"))

		await waitFor(() => {
			expect(reloadRecentItems).toHaveBeenCalledTimes(1)
		})
	})

	it("renders InfiniteScroll when recent list has more pages", () => {
		renderSidebar({
			activeView: "chats",
			navItems: [],
			recentItems: [
				{
					id: "recent-1",
					title: "Recent",
					inProgress: false,
					isShared: false,
					isLinked: false,
					isChatProject: false,
				},
			],
			onNavigate: vi.fn(),
			onGoHome: vi.fn(),
			onRecentNavigate: vi.fn(),
			reloadRecentItems: vi.fn(),
			hasMore: true,
			loadMoreRecentItems: vi.fn(),
		})

		expect(screen.getByTestId("infinite-scroll")).toBeInTheDocument()
	})
})
