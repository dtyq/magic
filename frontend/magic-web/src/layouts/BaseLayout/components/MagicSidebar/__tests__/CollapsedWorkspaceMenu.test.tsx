import { fireEvent, render, screen } from "@testing-library/react"
import {
	forwardRef,
	useImperativeHandle,
	useState,
	type ReactNode,
	type HTMLAttributes,
} from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CollapsedWorkspaceMenu from "../CollapsedWorkspaceMenu"
import type { CollapsedWorkspaceMenuWorkspaceItemProps } from "../CollapsedWorkspaceMenuWorkspaceItem"

const { createChat, workspaceStore } = vi.hoisted(() => ({
	createChat: vi.fn(),
	workspaceStore: {
		selectedWorkspace: null as { id: string } | null,
		workspaces: [{ id: "alpha", name: "Alpha" }],
	},
}))
const locationState = vi.hoisted(() => ({ pathname: "/global/super" }))
vi.mock("react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-router")>()),
	useLocation: () => locationState,
}))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/pages/superMagic/stores/core/workspace", () => ({ default: workspaceStore }))
vi.mock("@/pages/superMagic/stores/core/project", () => ({ default: {} }))
vi.mock("@/pages/superMagic/services", () => ({
	default: { workspace: { fetchWorkspaces: vi.fn().mockResolvedValue([]) } },
}))
vi.mock("../useCollapsedWorkspaceDnd", () => ({ useCollapsedWorkspaceDnd: () => ({}) }))
vi.mock("../WorkspaceList/ProjectPinBoundaryConfirmDialog", () => ({
	useProjectPinBoundaryConfirmation: () => ({}),
}))
vi.mock("../components/SidebarCreateInput", () => ({ default: () => null }))
vi.mock("@/components/base/MagicTooltip", () => ({
	default: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/shadcn-ui/sidebar", () => ({
	SidebarMenuButton: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}))
vi.mock("@/components/shadcn-ui/scroll-area", () => ({
	ScrollArea: forwardRef<HTMLDivElement, { children: ReactNode }>(function ScrollArea(
		{ children },
		ref,
	) {
		return (
			<div ref={ref}>
				<div data-slot="scroll-area-viewport">{children}</div>
			</div>
		)
	}),
}))
// Keep tests focused on submenu lifecycle and coordination, independent of browser portal geometry.
vi.mock("@/components/shadcn-ui/popover", async () => {
	const { createContext, useContext } = await import("react")
	const State = createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({
		open: false,
		onOpenChange: vi.fn(),
	})
	return {
		Popover: ({
			children,
			open,
			onOpenChange,
		}: {
			children: ReactNode
			open: boolean
			onOpenChange: (open: boolean) => void
		}) => <State.Provider value={{ open, onOpenChange }}>{children}</State.Provider>,
		PopoverTrigger: ({ children }: { children: ReactNode }) => {
			const { open, onOpenChange } = useContext(State)
			return <div onClick={() => onOpenChange(!open)}>{children}</div>
		},
		PopoverContent: ({
			children,
			side,
			align,
			...props
		}: HTMLAttributes<HTMLDivElement> & {
			side: string
			align: string
			"data-testid"?: string
		}) => {
			const { open } = useContext(State)
			return open ? (
				<div data-testid={props["data-testid"]} data-side={side} data-align={align}>
					{children}
				</div>
			) : null
		},
	}
})
vi.mock("../CollapsedWorkspaceMenuWorkspaceItem", () => ({
	default: ({
		workspace,
		isActive,
		openProjectMenuId,
		onProjectMenuChange,
	}: CollapsedWorkspaceMenuWorkspaceItemProps) => (
		<button
			data-testid="ordinary-workspace"
			data-active={isActive}
			data-open={openProjectMenuId === workspace.id}
			onClick={() => onProjectMenuChange(workspace.id)}
		>
			{workspace.name}
		</button>
	),
}))
vi.mock("../ChatsSubMenu", () => ({
	default: forwardRef(function Chats(
		{
			onSelect,
			onBusyChange,
			searchKeyword,
		}: { onSelect: () => void; onBusyChange: (busy: boolean) => void; searchKeyword?: string },
		ref,
	) {
		useImperativeHandle(ref, () => ({ create: createChat }), [])
		return (
			<div data-testid="chat-list" data-search={searchKeyword}>
				<button onClick={onSelect}>select-chat</button>
				<button onClick={() => onBusyChange(true)}>open-chat-action</button>
			</div>
		)
	}),
}))

function Harness() {
	const [open, setOpen] = useState(true)
	return (
		<CollapsedWorkspaceMenu
			open={open}
			onOpenChange={setOpen}
			onOpenManager={vi.fn()}
			onBusyChange={vi.fn()}
			icon={<span>spaces</span>}
		/>
	)
}

describe("CollapsedWorkspaceMenu conversation submenu", () => {
	beforeEach(() => {
		locationState.pathname = "/global/super"
		workspaceStore.selectedWorkspace = null
		vi.clearAllMocks()
	})

	it.each(["/global/super/new-chat", "/global/super/chat/project-1/topic-1"])(
		"does not select the cached workspace on %s",
		(pathname) => {
			workspaceStore.selectedWorkspace = { id: "alpha" }
			locationState.pathname = pathname
			render(<Harness />)
			expect(screen.getByTestId("ordinary-workspace")).toHaveAttribute("data-active", "false")
			expect(workspaceStore.selectedWorkspace).toEqual({ id: "alpha" })
		},
	)
	it("restores the cached workspace selection on task pages", () => {
		workspaceStore.selectedWorkspace = { id: "alpha" }
		render(<Harness />)
		expect(screen.getByTestId("ordinary-workspace")).toHaveAttribute("data-active", "true")
	})
	it.each(["/global/super/new-chat", "/global/super/chat/project-1/topic-1"])(
		"selects my chats in the collapsed menu on %s",
		(pathname) => {
			locationState.pathname = pathname
			render(<Harness />)
			expect(screen.getByTestId("sidebar-collapsed-my-chats")).toHaveAttribute(
				"aria-current",
				"page",
			)
		},
	)

	it("orders shared workspace and chats before ordinary workspaces without loading chats", () => {
		render(<Harness />)
		const shared = screen.getByTestId("sidebar-collapsed-workspace-share")
		const chats = screen.getByTestId("sidebar-collapsed-my-chats")
		const workspace = screen.getByTestId("ordinary-workspace")
		expect(
			shared.compareDocumentPosition(chats) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		expect(
			chats.compareDocumentPosition(workspace) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		expect(screen.queryByTestId("chat-list")).not.toBeInTheDocument()
	})

	it("opens chats to the right and switches exclusively between workspace submenus", () => {
		render(<Harness />)
		fireEvent.click(screen.getByTestId("sidebar-collapsed-my-chats"))
		expect(screen.getByTestId("chat-list")).toBeInTheDocument()
		expect(screen.getByTestId("sidebar-collapsed-my-chats-popover")).toHaveAttribute(
			"data-side",
			"right",
		)
		expect(screen.getByTestId("sidebar-collapsed-my-chats-popover")).toHaveAttribute(
			"data-align",
			"center",
		)
		fireEvent.click(screen.getByTestId("ordinary-workspace"))
		expect(screen.queryByTestId("chat-list")).not.toBeInTheDocument()
		expect(screen.getByTestId("ordinary-workspace")).toHaveAttribute("data-open", "true")
		fireEvent.click(screen.getByTestId("sidebar-collapsed-my-chats"))
		expect(screen.getByTestId("ordinary-workspace")).toHaveAttribute("data-open", "false")
	})

	it("creates from the submenu action and closes both levels when selecting a chat", () => {
		render(<Harness />)
		fireEvent.click(screen.getByTestId("sidebar-collapsed-my-chats"))
		fireEvent.click(screen.getByTestId("sidebar-collapsed-my-chats-add"))
		expect(createChat).toHaveBeenCalledTimes(1)
		fireEvent.click(screen.getByText("select-chat"))
		expect(screen.queryByTestId("sidebar-collapsed-workspace-popover")).not.toBeInTheDocument()
	})

	it("searches committed input, clears with Escape and resets on reopening", () => {
		render(<Harness />)
		fireEvent.click(screen.getByTestId("sidebar-collapsed-my-chats"))
		const input = screen.getByTestId("sidebar-collapsed-my-chats-search")
		fireEvent.compositionStart(input)
		fireEvent.change(input, { target: { value: "计划" } })
		expect(screen.getByTestId("chat-list")).toHaveAttribute("data-search", "")
		fireEvent.compositionEnd(input)
		expect(screen.getByTestId("chat-list")).toHaveAttribute("data-search", "计划")
		fireEvent.keyDown(input, { key: "Escape" })
		expect(input).toHaveValue("")
		expect(screen.getByTestId("chat-list")).toHaveAttribute("data-search", "")
		fireEvent.change(input, { target: { value: "draft" } })
		fireEvent.click(screen.getByTestId("ordinary-workspace"))
		fireEvent.click(screen.getByTestId("sidebar-collapsed-my-chats"))
		expect(screen.getByTestId("sidebar-collapsed-my-chats-search")).toHaveValue("")
		expect(screen.getByTestId("chat-list")).toHaveAttribute("data-search", "")
	})

	it("keeps the chat submenu open while a conversation action is active", () => {
		render(<Harness />)
		fireEvent.click(screen.getByTestId("sidebar-collapsed-my-chats"))
		fireEvent.click(screen.getByText("open-chat-action"))
		fireEvent.click(screen.getByTestId("ordinary-workspace"))
		fireEvent.click(screen.getByTestId("sidebar-collapsed-my-chats"))
		expect(screen.getByTestId("chat-list")).toBeInTheDocument()
		expect(screen.getByTestId("ordinary-workspace")).toHaveAttribute("data-open", "false")
	})
})
