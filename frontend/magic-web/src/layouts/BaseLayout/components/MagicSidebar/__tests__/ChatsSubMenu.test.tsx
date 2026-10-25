import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { createRef, type ReactNode } from "react"
import ChatsSubMenu, { type ChatsSubMenuHandle } from "../ChatsSubMenu"

const {
	collapseIfNarrowMock,
	reloadMock,
	setSearchValueMock,
	ensureChatWorkspaceMock,
	createProjectInChatWorkspaceMock,
	switchChatProjectMock,
} = vi.hoisted(() => ({
	collapseIfNarrowMock: vi.fn(),
	reloadMock: vi.fn().mockResolvedValue(undefined),
	setSearchValueMock: vi.fn(),
	ensureChatWorkspaceMock: vi.fn().mockResolvedValue({ id: "workspace-mock-beta" }),
	createProjectInChatWorkspaceMock: vi.fn().mockResolvedValue({
		project: { id: "project-mock-created" },
		topic: { id: "topic-mock-created" },
	}),
	switchChatProjectMock: vi.fn().mockResolvedValue(undefined),
}))

const locationState = vi.hoisted(() => ({ pathname: "/global/super/chat/project-mock-existing" }))
vi.mock("react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-router")>()),
	useLocation: () => locationState,
}))

vi.mock("@/routes/constants", () => ({
	/** Keep route names local to this test so route constants do not pull in the full app route tree. */
	RouteName: {
		SuperChatProjectState: "SuperChatProjectState",
	},
}))

vi.mock("@/routes/history/helpers", () => ({
	/** Force the test route to look like the desktop chat detail route without constructing real route configs. */
	routesPathMatch: () => true,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({}),
	getAdminLocaleModules: () => ({}),
	loadMagicFlowLocale: vi.fn(),
	loadFallbackLocale: vi.fn(),
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("@/components/base", () => ({
	/** Render trigger and popup together so unit tests can interact with popup actions directly. */
	MagicDropdown: ({
		children,
		popupRender,
	}: {
		children: ReactNode
		popupRender: () => ReactNode
	}) => (
		<div>
			{children}
			{popupRender()}
		</div>
	),
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({
		children,
		onClick,
		disabled,
		...rest
	}: {
		children: ReactNode
		onClick?: () => void
		disabled?: boolean
		[key: string]: unknown
	}) => (
		<button type="button" onClick={onClick} disabled={disabled} {...rest}>
			{children}
		</button>
	),
}))

vi.mock("@/components/shadcn-ui/scroll-area", () => ({
	/** Keep the list content mounted without Radix scroll wrappers in unit tests. */
	ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/pages/superMagic/hooks/useAutoLoadMoreSentinel", () => ({
	useAutoLoadMoreSentinel: () => vi.fn(),
}))

vi.mock("@/pages/superMagic/hooks/useChatWorkspace", () => ({
	useChatWorkspace: () => ({
		chatWorkspace: { id: "workspace-mock-alpha" },
		createProjectInChatWorkspace: createProjectInChatWorkspaceMock,
		ensureChatWorkspace: ensureChatWorkspaceMock,
	}),
}))

vi.mock("@/pages/superMagic/hooks/useDesktopChatProjectActions", () => ({
	useDesktopChatProjectActions: () => ({
		projectActions: [
			{ key: "pinProject", label: "Pin", onClick: vi.fn() },
			{ key: "rename", label: "Rename", onClick: vi.fn() },
			{ key: "saveAsProject", label: "SaveAsProject", onClick: vi.fn() },
			{ key: "delete", label: "Delete", onClick: vi.fn() },
		],
		projectActionComponents: null,
		updateCurrentActionItem: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		switchChatProject: switchChatProjectMock,
	},
}))

vi.mock("@/pages/superMagic/stores", () => ({
	roleStore: {
		currentRole: null,
	},
}))

vi.mock("@/stores/layout", () => ({
	sidebarStore: {
		collapseIfNarrow: collapseIfNarrowMock,
	},
}))

vi.mock("@/pages/superMagicMobile/pages/ChatsPage/hooks/useChatConversationList", () => ({
	/** Supply a stable fictional chat list so the behavior test stays deterministic. */
	useChatConversationList: () => ({
		items: [
			{
				id: "project-mock-existing",
				title: "Mock conversation entry",
				timeLabel: "just now",
				isPinned: false,
				isRunning: false,
				project: { id: "project-mock-existing" },
			},
		],
		isInitialChatListLoading: false,
		isLoadingMore: false,
		searchValue: "",
		setSearchValue: setSearchValueMock,
		isEmpty: false,
		hasMore: false,
		loadMore: vi.fn(),
		reload: reloadMock,
		optimisticUpdatePin: vi.fn(),
	}),
}))

vi.mock("../ChatConversationSubMenuRow", () => ({
	/** Reduce the row to a simple button so this test focuses on ChatsSubMenu side effects. */
	default: ({
		item,
		onOpen,
		isSelected,
	}: {
		isSelected: boolean
		item: { id: string; title: string }
		onOpen: (item: { id: string; title: string }) => void
	}) => (
		<button
			type="button"
			data-selected={isSelected}
			data-testid={`mock-chat-row-${item.id}`}
			onClick={() => onOpen(item)}
		>
			{item.title}
		</button>
	),
}))

/** Render ChatsSubMenu with a minimal trigger so tests can focus on submenu actions. */
function renderChatsSubMenu(standalone = false) {
	return render(
		<ChatsSubMenu standalone={standalone} active={standalone}>
			<button type="button">Open chats</button>
		</ChatsSubMenu>,
	)
}

function renderStandaloneChatsSubMenu() {
	return render(<ChatsSubMenu standalone active />)
}

describe("ChatsSubMenu", () => {
	beforeEach(() => {
		locationState.pathname = "/global/super/chat/project-mock-existing"
		collapseIfNarrowMock.mockClear()
		reloadMock.mockClear()
		setSearchValueMock.mockClear()
		ensureChatWorkspaceMock.mockClear()
		createProjectInChatWorkspaceMock.mockClear()
		switchChatProjectMock.mockClear()
	})

	it("selects the routed conversation and clears it on chat home", () => {
		const { rerender } = render(<ChatsSubMenu standalone workspace active />)
		const row = screen.getByTestId("mock-chat-row-project-mock-existing")
		expect(row).toHaveAttribute("data-selected", "true")
		locationState.pathname = "/global/super/new-chat"
		rerender(<ChatsSubMenu standalone workspace active />)
		expect(row).toHaveAttribute("data-selected", "false")
		locationState.pathname = "/global/super/chat/another-project/topic-1"
		rerender(<ChatsSubMenu standalone workspace active />)
		expect(row).toHaveAttribute("data-selected", "false")
	})
	it.each([false, true])(
		"switches an existing chat without collapsing (standalone=%s)",
		async (standalone) => {
			renderChatsSubMenu(standalone)

			fireEvent.click(screen.getByTestId("mock-chat-row-project-mock-existing"))

			await waitFor(() => {
				expect(switchChatProjectMock).toHaveBeenCalledWith(
					{ id: "project-mock-existing" },
					null,
					{ chatWorkspace: { id: "workspace-mock-alpha" } },
				)
			})
			expect(collapseIfNarrowMock).not.toHaveBeenCalled()
		},
	)

	it.each([false, true])(
		"creates a new chat without collapsing (standalone=%s)",
		async (standalone) => {
			renderChatsSubMenu(standalone)

			fireEvent.click(
				screen.getByTestId(
					standalone
						? "sidebar-workspace-list-add"
						: "sidebar-chats-submenu-new-chat-button",
				),
			)

			await waitFor(() => {
				expect(createProjectInChatWorkspaceMock).toHaveBeenCalled()
				expect(reloadMock).toHaveBeenCalledWith({ silent: true })
				expect(switchChatProjectMock).toHaveBeenCalledWith(
					{ id: "project-mock-created" },
					{ id: "topic-mock-created" },
					{ chatWorkspace: { id: "workspace-mock-alpha" } },
				)
			})
			expect(collapseIfNarrowMock).not.toHaveBeenCalled()
		},
	)

	it("renders the standalone tab panel with search controls", () => {
		renderStandaloneChatsSubMenu()

		expect(screen.getByTestId("sidebar-chats-panel")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("sidebar-workspace-list-search"))
		fireEvent.change(screen.getByTestId("sidebar-workspace-list-search-input"), {
			target: { value: "roadmap" },
		})
		expect(setSearchValueMock).toHaveBeenCalledWith("roadmap")
	})
	it("refreshes the tab list and prevents overlapping manual refreshes", async () => {
		renderStandaloneChatsSubMenu()
		reloadMock.mockClear()
		let finishRefresh: () => void = () => undefined
		reloadMock.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finishRefresh = resolve
				}),
		)
		const refresh = screen.getByTestId("sidebar-workspace-list-refresh")
		fireEvent.click(refresh)
		expect(refresh).toBeDisabled()
		fireEvent.click(refresh)
		// The first request is the manual refresh; a disabled second click cannot start another.
		expect(reloadMock).toHaveBeenCalledTimes(1)
		expect(reloadMock).toHaveBeenCalledWith({ silent: true })
		finishRefresh()
		await waitFor(() => expect(refresh).not.toBeDisabled())
	})

	it("refreshes when returning to the chats tab", () => {
		const { rerender } = render(<ChatsSubMenu standalone active={false} />)
		expect(reloadMock).not.toHaveBeenCalled()
		rerender(<ChatsSubMenu standalone active />)
		expect(reloadMock).toHaveBeenCalledWith({ silent: true })
	})

	it("preserves loaded workspace pages on collapse and re-expansion", async () => {
		const ref = createRef<ChatsSubMenuHandle>()
		const { rerender } = render(<ChatsSubMenu ref={ref} standalone workspace active />)
		rerender(<ChatsSubMenu ref={ref} standalone workspace active={false} />)
		rerender(<ChatsSubMenu ref={ref} standalone workspace active />)
		expect(reloadMock).not.toHaveBeenCalled()
		await act(async () => {
			await ref.current?.refresh()
		})
		expect(reloadMock).toHaveBeenCalledWith({ silent: true })
		expect(screen.queryByTestId("sidebar-chats-toolbar")).not.toBeInTheDocument()
	})

	it("uses the shared search keyword and clears it when search closes", () => {
		const { rerender } = render(
			<ChatsSubMenu standalone workspace active searchKeyword="plan" />,
		)
		expect(setSearchValueMock).toHaveBeenLastCalledWith("plan")
		rerender(<ChatsSubMenu standalone workspace active searchKeyword="" />)
		expect(setSearchValueMock).toHaveBeenLastCalledWith("")
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
	})

	it("uses the workspace toolbar search interaction, including IME and Escape", () => {
		renderStandaloneChatsSubMenu()
		const toolbar = within(screen.getByTestId("sidebar-chats-toolbar"))
		expect(toolbar.getByText("sidebar:chats.title")).toHaveClass(
			"text-xs",
			"text-sidebar-foreground/70",
		)
		expect(toolbar.queryByRole("textbox")).not.toBeInTheDocument()
		fireEvent.click(toolbar.getByTestId("sidebar-workspace-list-search"))
		const input = toolbar.getByRole("textbox")
		expect(input).toHaveFocus()
		fireEvent.compositionStart(input)
		fireEvent.change(input, { target: { value: "对话" } })
		expect(setSearchValueMock).not.toHaveBeenCalled()
		fireEvent.compositionEnd(input)
		expect(setSearchValueMock).toHaveBeenCalledWith("对话")
		fireEvent.keyDown(input, { key: "Escape" })
		expect(toolbar.queryByRole("textbox")).not.toBeInTheDocument()
		expect(setSearchValueMock).toHaveBeenLastCalledWith("")
	})
})
