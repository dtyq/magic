import { forwardRef, type ReactNode } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { runInAction } from "mobx"
import { describe, expect, it, vi, beforeEach } from "vitest"

import MobileHomePage from "../index"
import "@/pages/superMagic/stores/core"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"

const homeState = vi.hoisted(() => ({
	search: "",
	navigate: vi.fn(),
	context: null as SceneEditorContext | null,
}))
vi.mock("@/pages/superMagic/components/MessageEditor/services/UploadTokenService", () => ({
	UploadTokenService: class {},
}))
vi.mock("@/routes/hooks/useNavigate", () => ({ default: () => homeState.navigate }))
vi.mock("@/pages/superMagic/pages/ChatHomePage/useChatHomeContext", () => ({
	useChatHomeContext: () => ({
		selectedProject: null,
		selectedTopic: null,
		selectedWorkspace: null,
		draftKey: { workspaceId: "chat-home" },
	}),
}))
vi.mock("../hooks/useTaskHomeContext", () => ({
	useTaskHomeContext: () => ({
		context: {
			selectedProject: null,
			selectedTopic: null,
			draftKey: { workspaceId: "task-home" },
		},
		workspace: { id: "task-workspace", name: "Task workspace" },
		selectWorkspace: vi.fn(),
		loading: false,
		error: false,
	}),
}))
vi.mock("@/pages/superMagic/components/MessageEditor/stores", () => ({
	MessageEditorStore: class {
		fileUploadStore = { isAllFilesUploaded: true }
		dispose = vi.fn()
	},
	MessageEditorStoreProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/pages/superMagic/components/MainInputContainer/stores", () => ({
	createSceneStateStore: () => ({}),
	SceneStateProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/shadcn-ui/scroll-area", () => ({
	ScrollArea: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("../components/TaskWorkspaceSheet", () => ({ default: () => null }))
vi.mock("@/components/shadcn-ui/smooth-tabs", () => ({
	SmoothTabs: ({
		tabs,
		value,
		onChange,
		"data-testid": dataTestId,
	}: {
		tabs: { value: string; label: string; "data-testid"?: string }[]
		value: string
		onChange: (value: string) => void
		"data-testid"?: string
	}) => (
		<div role="tablist" data-testid={dataTestId}>
			{tabs.map((tab) => (
				<button
					role="tab"
					data-testid={tab["data-testid"]}
					aria-selected={tab.value === value}
					key={tab.value}
					onClick={() => onChange(tab.value)}
				>
					{tab.label}
				</button>
			))}
		</div>
	),
}))

const mockUseOptionalSuperMobileShellOutlet = vi.fn()
const {
	applyResolvedRoleMock,
	recoverTopicModeMock,
	refreshFeaturedModeListMock,
	isModeValidMock,
	getRawGlobalTopicModeMock,
	roleStoreState,
	selectedContextStores,
	selectedUserStore,
	topicModeState,
} = vi.hoisted(() => ({
	applyResolvedRoleMock: vi.fn(),
	recoverTopicModeMock: vi.fn(),
	refreshFeaturedModeListMock: vi.fn(),
	isModeValidMock: vi.fn(),
	getRawGlobalTopicModeMock: vi.fn(),
	roleStoreState: {
		currentRole: "unavailable-agent",
	},
	selectedContextStores: {
		topicStore: null as null | { selectedTopic: unknown },
		projectStore: null as null | { selectedProject: unknown },
	},
	selectedUserStore: {
		user: null as null | { organizationCode: string; userInfo: { user_id: string } },
	},
	topicModeState: {
		value: "unavailable-agent",
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell", () => ({
	SuperMobileShellRouteLayout: ({ children }: { children: ReactNode }) => (
		<div data-testid="shell">{children}</div>
	),
	useOptionalSuperMobileShellOutlet: () => mockUseOptionalSuperMobileShellOutlet(),
}))

vi.mock("react-router", () => ({
	useLocation: () => ({
		pathname: "/global/mobile-home",
		search: homeState.search,
	}),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
	useMount: () => undefined,
}))

vi.mock("@/routes/history/helpers", () => ({
	routesPathMatch: (name: string, pathname: string) => {
		if (name === "MobileHome") return pathname === "/global/mobile-home"
		if (name === "MobileTabs") return pathname === "/global/mobile-tabs"
		return false
	},
}))

vi.mock("@/routes/constants", () => ({
	RouteName: {
		MobileHome: "MobileHome",
		MobileTabs: "MobileTabs",
	},
}))

vi.mock("@/routes/components/ViewportRouteGuard", () => ({
	MobileOnlyRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("../components/ChatPageHeader", () => ({
	__esModule: true,
	default: ({
		onMenuClick,
		onPrimaryAction,
	}: {
		onMenuClick: () => void
		onPrimaryAction?: () => void
	}) => (
		<>
			<button type="button" data-testid="mobile-shell-menu-button" onClick={onMenuClick}>
				menu
			</button>
			{onPrimaryAction ? (
				<button
					type="button"
					data-testid="mobile-header-primary-button"
					onClick={onPrimaryAction}
				>
					new chat
				</button>
			) : null}
		</>
	),
}))

vi.mock("../components/SloganSection", () => ({
	__esModule: true,
	default: () => <div data-testid="slogan-section" />,
}))

vi.mock("../components/MobileInputContainer", () => ({
	__esModule: true,
	default: forwardRef<HTMLDivElement, { editorContext: SceneEditorContext }>(
		({ editorContext }, ref) => {
			homeState.context = editorContext
			return <div ref={ref} data-testid="mobile-input-container" />
		},
	),
}))

vi.mock("@/pages/mobileTabs/constants", () => ({
	MobileTabParam: {
		Super: "super",
	},
}))

vi.mock("@/pages/superMagic/pages/Workspace/types", () => ({
	TaskStatus: {
		RUNNING: "RUNNING",
	},
}))

vi.mock("@/pages/superMagic/pages/Workspace/TopicMode", () => ({
	TopicMode: {
		General: "general",
	},
}))

vi.mock("@/pages/superMagic/stores/RoleStore", () => ({
	roleStore: {
		get currentRole() {
			return roleStoreState.currentRole
		},
		setCurrentRole: vi.fn(),
		applyResolvedRole: applyResolvedRoleMock,
	},
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/components/editors/constant", () => ({
	MOBILE_LAYOUT_CONFIG: {},
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/constants", () => ({
	INPUT_CONTAINER_MIN_HEIGHT: {
		HomePage: 88,
	},
}))

vi.mock("@/pages/superMagic/stores/core", async () => {
	const { observable } = await import("mobx")
	const topicStore = observable({
		selectedTopic: null as null | { id: string; agent_code?: string },
		setSelectedTopic: vi.fn(),
	})
	const projectStore = observable({
		selectedProject: null as null | { id: string; workspace_id: string },
		setSelectedProject: vi.fn(),
	})
	selectedContextStores.topicStore = topicStore
	selectedContextStores.projectStore = projectStore

	return {
		topicStore,
		projectStore,
		workspaceStore: {
			setSelectedWorkspace: vi.fn(),
		},
	}
})

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		messages: new Map(),
	},
}))

vi.mock("@/models/user", async () => {
	const { observable } = await import("mobx")
	const user = observable({
		organizationCode: "org-initial",
		userInfo: { user_id: "user-test" },
	})
	selectedUserStore.user = user
	return { userStore: { user } }
})

vi.mock("@/pages/superMagic/hooks/useTaskInterrupt", () => ({
	useTaskInterrupt: () => ({
		handleInterrupt: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/hooks/useChatWorkspace", () => ({
	useChatWorkspace: () => ({
		chatWorkspace: null,
		createProjectInChatWorkspace: vi.fn(),
	}),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	__esModule: true,
	default: {
		error: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/services", () => ({
	__esModule: true,
	default: {
		switchChatProject: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/hooks/useAgentCodeModeFromSearch", () => ({
	__esModule: true,
	default: () => undefined,
}))

vi.mock("@/pages/superMagic/hooks/useTopicMode", () => ({
	__esModule: true,
	default: () => ({
		topicMode: topicModeState.value,
		setTopicMode: vi.fn(),
		recoverTopicMode: recoverTopicModeMock,
	}),
}))

vi.mock("@/pages/superMagic/hooks/useFeaturedModeListRefresh", () => ({
	refreshFeaturedModeList: refreshFeaturedModeListMock,
}))

vi.mock("@/pages/superMagic/services/topicStatusSyncService", () => ({
	applyOptimisticTopicRunningState: vi.fn(),
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	__esModule: true,
	default: {
		isModeValid: isModeValidMock,
	},
}))

vi.mock("@/services/superMagic/ProjectTopicService", () => ({
	__esModule: true,
	default: {
		getRawGlobalTopicMode: getRawGlobalTopicModeMock,
	},
}))

vi.mock("@/services/superMagic/DefaultAgentSelectionService", () => ({
	getFallbackTopicModeIdentifier: () => "summary",
	resolveDefaultAgentSelection: () => ({
		topicPattern: "custom_agent",
		modeIdentifier: "SMA-default",
		agentCode: "SMA-default",
	}),
	resolveProjectModeForCreate: (mode?: string | null) => mode || "summary",
}))

vi.mock("@/stores/interface", () => ({
	interfaceStore: {
		mobileTabBarVisible: false,
	},
}))

vi.mock("../agentCodeRoutePolicy", () => ({
	shouldClearResolvedAgentCodeFromUrl: () => false,
}))

vi.mock("../homepageModeState", () => ({
	resolveHomepageDisplayTopicMode: ({ topicMode }: { topicMode: string }) => topicMode,
}))

function getSelectedContextStores() {
	const { topicStore, projectStore } = selectedContextStores
	if (!topicStore || !projectStore) {
		throw new Error("Selected context stores are not initialized")
	}
	return { topicStore, projectStore }
}

describe("MobileHomePage", () => {
	beforeEach(() => {
		const { topicStore, projectStore } = getSelectedContextStores()
		vi.clearAllMocks()
		homeState.search = ""
		mockUseOptionalSuperMobileShellOutlet.mockReset()
		mockUseOptionalSuperMobileShellOutlet.mockReturnValue({ openSidebar: vi.fn() })
		roleStoreState.currentRole = "unavailable-agent"
		topicModeState.value = "unavailable-agent"
		getRawGlobalTopicModeMock.mockReturnValue("unavailable-agent")
		runInAction(() => {
			topicStore.selectedTopic = null
			projectStore.selectedProject = null
			if (selectedUserStore.user) selectedUserStore.user.organizationCode = "org-initial"
		})
		refreshFeaturedModeListMock.mockResolvedValue([
			{
				mode: { identifier: "first-agent" },
				agent: { is_visible: true },
			},
			{
				mode: { identifier: "summary" },
				agent: { is_visible: true },
			},
			{
				mode: { identifier: "hidden-agent" },
				agent: { is_visible: false },
			},
		])
		isModeValidMock.mockImplementation((mode: string) =>
			["general", "first-agent", "summary", "hidden-agent"].includes(mode),
		)
	})

	it("does not crash when the panel temporarily renders before shell outlet is ready", () => {
		refreshFeaturedModeListMock.mockResolvedValueOnce([])
		mockUseOptionalSuperMobileShellOutlet
			.mockReturnValueOnce({ openSidebar: vi.fn() })
			.mockReturnValueOnce(null)

		render(<MobileHomePage />)

		expect(screen.getByTestId("mobile-shell-menu-button")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-input-container")).toBeInTheDocument()
	})

	it("does not expose a separate homepage new-chat action", () => {
		refreshFeaturedModeListMock.mockResolvedValue([])
		render(<MobileHomePage />)

		expect(screen.queryByTestId("mobile-header-primary-button")).not.toBeInTheDocument()
	})

	it("defaults to task mode with workspace selection", () => {
		refreshFeaturedModeListMock.mockResolvedValue([])
		render(<MobileHomePage />)
		expect(screen.getByTestId("mobile-home-mode-controls")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-home-mode-tabs")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-home-mode-chat-tab")).toHaveAttribute(
			"aria-selected",
			"false",
		)
		expect(screen.getByTestId("mobile-home-mode-task-tab")).toHaveAttribute(
			"aria-selected",
			"true",
		)
		expect(screen.getByRole("tab", { name: "homeMode.task" })).toHaveAttribute(
			"aria-selected",
			"true",
		)
		expect(homeState.context?.showModeToggle).toBe(true)
		expect(homeState.context?.showModelSelector).toBe(false)
		expect(screen.getByTestId("mobile-home-workspace")).toBeInTheDocument()
	})

	it("switches mode without a page transition and shows task workspace separately", () => {
		refreshFeaturedModeListMock.mockResolvedValue([])
		homeState.search = "?homeMode=chat"
		const view = render(<MobileHomePage />)
		fireEvent.click(screen.getByRole("tab", { name: "homeMode.task" }))
		expect(homeState.navigate).toHaveBeenCalledWith(
			expect.objectContaining({
				query: { homeMode: "task" },
				viewTransition: false,
				replace: true,
			}),
		)
		homeState.search = "?homeMode=task"
		view.rerender(<MobileHomePage key="task-route" />)
		expect(screen.getByTestId("mobile-home-workspace")).toBeInTheDocument()
		expect(homeState.context?.showModeToggle).toBe(true)
		expect(screen.getAllByTestId("mobile-input-container")).toHaveLength(1)
	})

	it("preserves employee deep links as task entries", () => {
		refreshFeaturedModeListMock.mockResolvedValue([])
		homeState.search = "?agentCode=SMA-explicit"
		render(<MobileHomePage />)
		expect(screen.getByRole("tab", { name: "homeMode.task" })).toHaveAttribute(
			"aria-selected",
			"true",
		)
	})

	it("uses the configured default when the saved employee is unavailable", async () => {
		render(<MobileHomePage />)

		await waitFor(() => {
			expect(recoverTopicModeMock).toHaveBeenCalledWith("summary")
			expect(applyResolvedRoleMock).toHaveBeenCalledWith("summary")
		})

		expect(applyResolvedRoleMock).not.toHaveBeenCalledWith("first-agent")
	})

	it("uses the first employee when the saved and configured defaults are unavailable", async () => {
		isModeValidMock.mockImplementation((mode: string) => mode === "first-agent")

		render(<MobileHomePage />)

		await waitFor(() => {
			expect(recoverTopicModeMock).toHaveBeenCalledWith("first-agent")
			expect(applyResolvedRoleMock).toHaveBeenCalledWith("first-agent")
		})
	})

	it("skips hidden employees when falling back to the first available employee", async () => {
		refreshFeaturedModeListMock.mockResolvedValueOnce([
			{ mode: { identifier: "hidden-first-agent" }, agent: { is_visible: false } },
			{ mode: { identifier: "visible-next-agent" }, agent: { is_visible: true } },
		])
		isModeValidMock.mockReturnValue(false)

		render(<MobileHomePage />)

		await waitFor(() => {
			expect(recoverTopicModeMock).toHaveBeenCalledWith("visible-next-agent")
		})
		expect(recoverTopicModeMock).not.toHaveBeenCalledWith("hidden-first-agent")
	})

	it("restores the saved employee when a valid legacy homepage mode is displayed", async () => {
		topicModeState.value = "ppt"
		getRawGlobalTopicModeMock.mockReturnValue("general")
		isModeValidMock.mockImplementation((mode: string) =>
			["general", "ppt", "summary"].includes(mode),
		)

		render(<MobileHomePage />)

		await waitFor(() => {
			expect(recoverTopicModeMock).toHaveBeenCalledWith("general")
			expect(applyResolvedRoleMock).toHaveBeenCalledWith("general")
		})
	})

	it("keeps a hidden employee when it is still available", async () => {
		roleStoreState.currentRole = "hidden-agent"
		topicModeState.value = "hidden-agent"
		getRawGlobalTopicModeMock.mockReturnValue("hidden-agent")
		render(<MobileHomePage />)

		await waitFor(() => {
			expect(refreshFeaturedModeListMock).toHaveBeenCalledTimes(1)
		})

		expect(recoverTopicModeMock).not.toHaveBeenCalled()
		expect(applyResolvedRoleMock).not.toHaveBeenCalled()
	})

	it("restores the saved employee without inheriting the previously visited topic", async () => {
		const { topicStore, projectStore } = getSelectedContextStores()
		roleStoreState.currentRole = "unavailable-agent"
		getRawGlobalTopicModeMock.mockReturnValue("general")
		runInAction(() => {
			topicStore.selectedTopic = {
				id: "previous-topic",
				agent_code: "unavailable-agent",
			}
			projectStore.selectedProject = {
				id: "previous-project",
				workspace_id: "workspace-1",
			}
		})
		render(<MobileHomePage />)

		expect(homeState.context?.selectedProject).toBeNull()
		expect(homeState.context?.selectedTopic).toBeNull()

		await waitFor(() => {
			expect(recoverTopicModeMock).toHaveBeenCalledWith("general")
			expect(applyResolvedRoleMock).toHaveBeenCalledWith("general")
		})
		expect(recoverTopicModeMock).not.toHaveBeenCalledWith("summary")
	})

	it("refreshes the homepage mode after the organization context changes", async () => {
		if (!selectedUserStore.user) throw new Error("User store is not initialized")

		refreshFeaturedModeListMock
			.mockResolvedValueOnce([
				{ mode: { identifier: "initial-agent" }, agent: { is_visible: true } },
			])
			.mockResolvedValueOnce([
				{ mode: { identifier: "next-org-agent" }, agent: { is_visible: true } },
			])
		isModeValidMock.mockImplementation((mode: string) =>
			["initial-agent", "next-org-agent"].includes(mode),
		)

		render(<MobileHomePage />)

		await waitFor(() => {
			expect(refreshFeaturedModeListMock).toHaveBeenCalledTimes(1)
			expect(recoverTopicModeMock).toHaveBeenCalledWith("initial-agent")
		})

		act(() => {
			runInAction(() => {
				if (selectedUserStore.user) {
					selectedUserStore.user.organizationCode = "org-next"
				}
			})
		})

		await waitFor(() => {
			expect(refreshFeaturedModeListMock).toHaveBeenCalledTimes(2)
			expect(recoverTopicModeMock).toHaveBeenCalledWith("next-org-agent")
		})
	})

	it("ignores an outdated homepage mode refresh result", async () => {
		if (!selectedUserStore.user) throw new Error("User store is not initialized")

		type MockModeItem = {
			mode: { identifier: string }
			agent: { is_visible: boolean }
		}
		let resolveInitialRequest: (modeList: MockModeItem[]) => void = () => undefined
		let resolveNextRequest: (modeList: MockModeItem[]) => void = () => undefined
		const initialRequest = new Promise<MockModeItem[]>((resolve) => {
			resolveInitialRequest = resolve
		})
		const nextRequest = new Promise<MockModeItem[]>((resolve) => {
			resolveNextRequest = resolve
		})
		refreshFeaturedModeListMock
			.mockReturnValueOnce(initialRequest)
			.mockReturnValueOnce(nextRequest)
		isModeValidMock.mockImplementation((mode: string) =>
			["initial-agent", "next-org-agent"].includes(mode),
		)

		render(<MobileHomePage />)
		await waitFor(() => expect(refreshFeaturedModeListMock).toHaveBeenCalledTimes(1))

		act(() => {
			runInAction(() => {
				if (selectedUserStore.user) {
					selectedUserStore.user.organizationCode = "org-next"
				}
			})
		})
		await waitFor(() => expect(refreshFeaturedModeListMock).toHaveBeenCalledTimes(2))

		await act(async () => {
			resolveInitialRequest([
				{ mode: { identifier: "initial-agent" }, agent: { is_visible: true } },
			])
			await Promise.resolve()
		})
		expect(recoverTopicModeMock).not.toHaveBeenCalledWith("initial-agent")

		await act(async () => {
			resolveNextRequest([
				{ mode: { identifier: "next-org-agent" }, agent: { is_visible: true } },
			])
			await Promise.resolve()
		})
		await waitFor(() => {
			expect(recoverTopicModeMock).toHaveBeenCalledWith("next-org-agent")
		})
	})
})
