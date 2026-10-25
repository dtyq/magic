import type { ReactNode } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
	switchChatProjectMock,
	deleteProjectMock,
	pinProjectMock,
	reloadMock,
	optimisticRemoveMock,
	optimisticUpdatePinMock,
	openProjectDeleteConfirmMock,
	useProjectListActionsMock,
	locationStateMock,
	navigateMock,
} = vi.hoisted(() => ({
	switchChatProjectMock: vi.fn(),
	deleteProjectMock: vi.fn(),
	pinProjectMock: vi.fn(),
	reloadMock: vi.fn(),
	optimisticRemoveMock: vi.fn(),
	optimisticUpdatePinMock: vi.fn(),
	openProjectDeleteConfirmMock: vi.fn(),
	useProjectListActionsMock: vi.fn(),
	locationStateMock: {
		current: null as null | {
			pendingDeletedProjectId?: string
		},
	},
	navigateMock: vi.fn(),
}))

import ChatsPage from "../index"
import { SuperMobileShellRouteLayout } from "@/pages/superMagicMobile/components/MobileShell/SuperMobileShellRouteLayout"

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/routes/components/ViewportRouteGuard", () => ({
	MobileOnlyRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("react-router", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-router")>()
	return {
		...actual,
		useLocation: () => ({
			pathname: "/super/chats",
			search: "",
			hash: "",
			key: "test-location",
			state: locationStateMock.current,
		}),
	}
})

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		switchChatProject: switchChatProjectMock,
		deleteProject: deleteProjectMock,
		project: {
			pinProject: pinProjectMock,
		},
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/stores", () => ({
	roleStore: {
		currentRole: null,
	},
}))

vi.mock("@/pages/superMagic/pages/Workspace/TopicMode", () => ({
	TopicMode: {
		General: "general",
	},
}))

vi.mock("@/pages/superMagic/hooks/useChatWorkspace", () => ({
	useChatWorkspace: () => ({
		createProjectInChatWorkspace: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions", () => ({
	useProjectListActions: (options: Record<string, unknown>) => {
		useProjectListActionsMock(options)
		return {
			projectActions: [],
			projectActionComponents: null,
			updateCurrentActionItem: vi.fn(),
			openProjectDeleteConfirm: openProjectDeleteConfirmMock,
		}
	},
}))

vi.mock("../hooks/useChatConversationList", () => ({
	useChatConversationList: () => ({
		items: [
			{
				id: "chat-project-1",
				title: "Mock Chat",
				timeLabel: "just now",
				isPinned: false,
				isRunning: false,
				project: {
					id: "chat-project-1",
					project_name: "Mock Chat",
					workspace_id: "chat-workspace-1",
				},
			},
		],
		isInitialChatListLoading: false,
		searchValue: "",
		setSearchValue: vi.fn(),
		debouncedSearchValue: "",
		isEmpty: false,
		isSearchEmpty: false,
		hasMore: false,
		reload: reloadMock,
		loadMore: vi.fn(),
		optimisticRemove: optimisticRemoveMock,
		optimisticUpdatePin: optimisticUpdatePinMock,
	}),
}))

vi.mock("../components/ChatConversationListView", () => ({
	ChatConversationListView: ({
		items,
		onCreateChat,
		onOpenSidebar,
		onPin,
		onDelete,
	}: {
		items: Array<{
			id: string
			title: string
			isPinned: boolean
			project: { id: string; project_name: string; workspace_id: string }
		}>
		onCreateChat: () => void
		onOpenSidebar: () => void
		onPin?: (item: (typeof items)[number]) => void
		onDelete?: (item: (typeof items)[number]) => void
	}) => (
		<div>
			<button type="button" data-testid="chat-list-create" onClick={onCreateChat}>
				create
			</button>
			<button type="button" data-testid="chat-list" onClick={onOpenSidebar}>
				list
			</button>
			<button
				type="button"
				data-testid="chat-list-delete"
				onClick={() => {
					const firstItem = items[0]
					if (firstItem) onDelete?.(firstItem)
				}}
			>
				delete
			</button>
			<button
				type="button"
				data-testid="chat-list-pin"
				onClick={() => {
					if (onPin) {
						onPin(items[0]!)
					}
				}}
			>
				pin
			</button>
		</div>
	),
}))

vi.mock("@/pages/superMagicMobile/components/ConversationActionsPopup", () => ({
	default: () => null,
}))

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

vi.mock("@/platform/native", () => ({
	getNativePort: () => ({
		navigation: {
			changeBottomTab: vi.fn(),
		},
	}),
}))

vi.mock("@/pages/superMagicMobile/components/icons/MagiClawNavIcon", () => ({
	MagiClawNavIcon: () => null,
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => navigateMock,
}))

vi.mock("@/layouts/BaseLayoutMobile/components/MobileSettings", () => ({
	MobileSettingsPanel: () => null,
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell/MobileSettingsContext", () => ({
	MobileSettingsProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell/useRecentProjectsForMenu", () => ({
	useRecentProjectsForMenu: () => ({
		recentItems: [],
		reloadRecentItems: vi.fn(),
		loadMoreRecentItems: vi.fn(),
		hasMore: false,
	}),
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell/MobileShellSidebar", () => ({
	default: () => <div data-testid="mobile-shell-sidebar" />,
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell/MobileShellAppLayout", () => ({
	MobileShellAppLayout: ({ panel }: { panel: ReactNode }) => (
		<div data-testid="shell">{panel}</div>
	),
}))

describe("ChatsPage", () => {
	beforeEach(() => {
		locationStateMock.current = null
		vi.clearAllMocks()
	})

	it("pins a chat with optimistic reorder before reloading the chat queries list", async () => {
		pinProjectMock.mockResolvedValue(undefined)
		reloadMock.mockResolvedValue(undefined)

		render(<ChatsPage />)

		fireEvent.click(screen.getByTestId("chat-list-pin"))

		await waitFor(() => {
			expect(pinProjectMock).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "chat-project-1",
					workspace_id: "chat-workspace-1",
				}),
				true,
			)
			expect(optimisticUpdatePinMock).toHaveBeenCalledWith("chat-project-1", true)
			expect(reloadMock).toHaveBeenCalledWith({ silent: true })
		})
	})

	it("opens the shared delete confirmation before deleting a swiped chat", async () => {
		render(<ChatsPage />)

		fireEvent.click(screen.getByTestId("chat-list-delete"))

		expect(openProjectDeleteConfirmMock).toHaveBeenCalledWith(
			expect.objectContaining({ id: "chat-project-1" }),
		)
		expect(deleteProjectMock).not.toHaveBeenCalled()

		const actionOptions = useProjectListActionsMock.mock.calls[0]?.[0] as {
			onDeleteProjectConfirmed: (project: {
				id: string
				workspace_id: string
			}) => Promise<void>
		}
		await actionOptions.onDeleteProjectConfirmed({
			id: "chat-project-1",
			workspace_id: "chat-workspace-1",
		})

		expect(optimisticRemoveMock).toHaveBeenCalledWith("chat-project-1")
		expect(deleteProjectMock).toHaveBeenCalledWith(
			expect.objectContaining({ id: "chat-project-1" }),
			{ selectedProjectBehavior: "navigate-home" },
		)
	})

	it("reuses list deletion handling when returning from deleted chat detail", async () => {
		locationStateMock.current = { pendingDeletedProjectId: "chat-project-1" }
		reloadMock.mockResolvedValue(undefined)

		render(<ChatsPage />)

		await waitFor(() => {
			expect(optimisticRemoveMock).toHaveBeenCalledWith("chat-project-1")
			expect(reloadMock).toHaveBeenCalledWith({ silent: true })
			expect(navigateMock).toHaveBeenCalledWith({
				name: "SuperChatsList",
				replace: true,
				state: undefined,
				viewTransition: false,
			})
		})
	})

	it("navigates to the existing mobile home with the default mobile transition", () => {
		render(<ChatsPage />)

		fireEvent.click(screen.getByTestId("chat-list-create"))

		expect(navigateMock).toHaveBeenCalledWith({
			name: "MobileHome",
			query: { homeMode: "chat" },
		})
		expect(reloadMock).not.toHaveBeenCalled()
	})

	it("falls back to its own shell when rendered without route shell context", () => {
		render(<ChatsPage />)

		expect(screen.getByTestId("shell")).toBeInTheDocument()
		expect(screen.getByTestId("chat-list")).toBeInTheDocument()
	})

	it("reuses the existing shell context when already wrapped by the route shell", () => {
		render(
			<SuperMobileShellRouteLayout activeView="chats" closeSidebarAriaLabel="close">
				<ChatsPage />
			</SuperMobileShellRouteLayout>,
		)

		expect(screen.getByTestId("chat-list")).toBeInTheDocument()
	})
})

vi.mock("@/services/recordSummary/projectDeletionRecordingNotice", () => ({
	canDeleteRecordingProjects: vi.fn(() => true),
	handleRecordingProjectDeletionError: vi.fn(() => false),
}))
