import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createRef, forwardRef, useImperativeHandle, type HTMLAttributes } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
	mockSilentRefreshSidebarLoadedCaches,
	mockRefreshResourceStatus,
	mockFetchWorkspaces,
	mockRefreshChats,
	mockSearchWorkspaces,
	mockSearchProjects,
	workspaceStoreMock,
} = vi.hoisted(() => ({
	mockSilentRefreshSidebarLoadedCaches: vi.fn(),
	mockRefreshResourceStatus: vi.fn(),
	mockFetchWorkspaces: vi.fn(),
	mockRefreshChats: vi.fn().mockResolvedValue(undefined),
	mockSearchWorkspaces: vi.fn().mockResolvedValue({ list: [], total: 0 }),
	mockSearchProjects: vi.fn().mockResolvedValue({ list: [], total: 0 }),
	workspaceStoreMock: {
		workspaces: [] as Array<{ id: string; name: string; workspace_status?: string }>,
		selectedWorkspace: null as { id: string } | null,
		isWorkspaceListLoading: false,
	},
}))

const locationState = vi.hoisted(() => ({ pathname: "/global/super" }))
vi.mock("react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-router")>()),
	useLocation: () => locationState,
}))
vi.mock("mobx-react-lite", () => ({
	observer: (component: unknown) => component,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/stores/layout", () => ({
	sidebarStore: {
		workspacesExpanded: true,
		expandedWorkspaces: new Set(),
		navigationScrollPositions: new Map(),
		selectNavigationSection: vi.fn(),
		setActiveWorkspace: vi.fn(),
		setWorkspaceExpanded: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getWorkspaces: mockSearchWorkspaces,
		getProjectsWithCollaboration: mockSearchProjects,
	},
}))
vi.mock("../useWorkspaceListDnd", () => ({ useWorkspaceListDnd: () => ({}) }))
vi.mock("../ProjectPinBoundaryConfirmDialog", () => ({
	useProjectPinBoundaryConfirmation: () => ({}),
}))
vi.mock("@/pages/superMagic/services/workspaceListSearchInvalidation", () => ({
	subscribeWorkspaceSearchInvalidation: () => () => undefined,
}))
vi.mock("../../ChatWorkspaceItem", () => ({
	default: forwardRef(function ChatWorkspace({ searchKeyword }: { searchKeyword: string }, ref) {
		useImperativeHandle(ref, () => ({ refresh: mockRefreshChats }), [])
		return <div data-testid="chat-workspace" data-search={searchKeyword} />
	}),
}))

vi.mock("@/pages/superMagic/stores/core/workspace", () => ({
	default: workspaceStoreMock,
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		silentRefreshSidebarLoadedCaches: mockSilentRefreshSidebarLoadedCaches,
		workspace: {
			fetchWorkspaces: mockFetchWorkspaces,
		},
	},
}))

vi.mock("@/pages/superMagic/services/statusPollingService", () => ({
	default: {
		refreshResourceStatus: mockRefreshResourceStatus,
	},
}))

vi.mock("../WorkspaceItem", () => ({
	default: ({ workspace }: { workspace: { id: string; name: string } }) => (
		<div data-testid={`workspace-item-${workspace.id}`}>{workspace.name}</div>
	),
}))

vi.mock("../CreateWorkspaceInput", () => ({
	default: () => <div data-testid="create-workspace-input" />,
}))

vi.mock("@/components/shadcn-ui/scroll-area", () => ({
	ScrollArea: (props: HTMLAttributes<HTMLDivElement> & { viewportClassName?: string }) => {
		const { children, ...restProps } = props
		// Drop the testing-only viewport prop before forwarding to a DOM node.
		delete (restProps as { viewportClassName?: string }).viewportClassName
		return <div {...restProps}>{children}</div>
	},
}))

vi.mock("@/components/shadcn-ui/sidebar", () => ({
	SidebarGroup: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
		<div {...props}>{children}</div>
	),
	SidebarGroupContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
		<div {...props}>{children}</div>
	),
	SidebarGroupLabel: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
		<div {...props}>{children}</div>
	),
	SidebarMenu: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
		<div {...props}>{children}</div>
	),
}))

vi.mock("@/utils/cn", () => ({
	cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}))

vi.mock("@/utils/testid", () => ({
	toTestIdSegment: (value: string) => value,
}))

/**
 * The workspace toolbar coordinates project caches and conversations without status-only polling.
 */
describe("WorkspaceList", () => {
	beforeEach(() => {
		locationState.pathname = "/global/super"
		vi.clearAllMocks()
		workspaceStoreMock.workspaces = [
			{
				id: "workspace-1",
				name: "Workspace One",
				workspace_status: "running",
			},
		]
		workspaceStoreMock.selectedWorkspace = { id: "workspace-1" }
		workspaceStoreMock.isWorkspaceListLoading = false
		mockSilentRefreshSidebarLoadedCaches.mockResolvedValue(undefined)
		mockRefreshResourceStatus.mockResolvedValue(undefined)
		mockFetchWorkspaces.mockResolvedValue([])
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0)
			return 1
		})
		vi.stubGlobal("cancelAnimationFrame", vi.fn())
	})

	it.each(["/global/super/new-chat", "/global/super/chat/project-1"])(
		"does not auto-expand the cached workspace on %s",
		async (pathname) => {
			locationState.pathname = pathname
			const { default: WorkspaceList } = await import("../WorkspaceList")
			const { sidebarStore } = await import("@/stores/layout")
			render(
				<WorkspaceList
					scrollRef={createRef()}
					scrollAreaRef={createRef()}
					onOpenManager={vi.fn()}
				/>,
			)
			expect(sidebarStore.setActiveWorkspace).not.toHaveBeenCalled()
			expect(sidebarStore.setWorkspaceExpanded).not.toHaveBeenCalled()
			expect(workspaceStoreMock.selectedWorkspace).toEqual({ id: "workspace-1" })
		},
	)
	it("refresh button refreshes both sidebar caches and conversations", async () => {
		const { default: WorkspaceList } = await import("../WorkspaceList")

		render(
			<WorkspaceList
				scrollRef={createRef()}
				scrollAreaRef={createRef()}
				onOpenManager={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("sidebar-workspace-list-refresh"))

		await waitFor(() => {
			expect(mockSilentRefreshSidebarLoadedCaches).toHaveBeenCalledTimes(1)
		})
		expect(mockFetchWorkspaces).not.toHaveBeenCalled()
		expect(mockRefreshResourceStatus).not.toHaveBeenCalled()
		expect(mockRefreshChats).toHaveBeenCalledTimes(1)
	})

	it("shares committed search text with conversations and clears it on exit", async () => {
		const { default: WorkspaceList } = await import("../WorkspaceList")
		render(
			<WorkspaceList
				scrollRef={createRef()}
				scrollAreaRef={createRef()}
				onOpenManager={vi.fn()}
			/>,
		)
		fireEvent.click(screen.getByTestId("sidebar-workspace-list-search"))
		const input = screen.getByTestId("sidebar-workspace-list-search-input")
		fireEvent.compositionStart(input)
		fireEvent.change(input, { target: { value: "计划" } })
		expect(screen.getByTestId("chat-workspace")).toHaveAttribute("data-search", "")
		fireEvent.compositionEnd(input)
		expect(screen.getByTestId("chat-workspace")).toHaveAttribute("data-search", "计划")
		await waitFor(() =>
			expect(mockSearchWorkspaces).toHaveBeenCalledWith(
				expect.objectContaining({ workspace_name: "计划" }),
			),
		)
		expect(mockSearchProjects).toHaveBeenCalledWith(
			expect.objectContaining({ project_name: "计划" }),
		)
		fireEvent.click(screen.getByTestId("sidebar-workspace-list-search-close"))
		expect(screen.getByTestId("chat-workspace")).toHaveAttribute("data-search", "")
	})
})
