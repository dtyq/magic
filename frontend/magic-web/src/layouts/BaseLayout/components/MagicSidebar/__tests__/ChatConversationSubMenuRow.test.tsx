import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ChatConversationListItem } from "@/pages/superMagicMobile/pages/ChatsPage/hooks/useChatConversationList"
import type { MagicDropdownProps } from "@/components/base/MagicDropdown"
import ChatConversationSubMenuRow from "../ChatConversationSubMenuRow"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Exercise the row's context-menu events and action wiring independently of portal geometry.
vi.mock("@/components/base/MagicDropdown", () => ({
	default: ({ children, open, onOpenChange, menu, overlayClassName }: MagicDropdownProps) => (
		<div onContextMenu={() => onOpenChange?.(true)}>
			{children}
			{open && (
				<div role="menu" className={overlayClassName}>
					{menu?.items?.map((entry, index) => {
						if (!entry) return null
						if (entry.type === "divider") return <hr key={index} />
						if (entry.type === "group" || "children" in entry) return null
						return (
							<button
								key={entry.key}
								role="menuitem"
								onClick={(domEvent) => {
									const info = {
										key: String(entry.key),
										keyPath: [String(entry.key)],
										domEvent,
									}
									menu.onClick?.(info)
									entry.onClick?.(info)
									onOpenChange?.(false)
								}}
							>
								{entry.label}
							</button>
						)
					})}
				</div>
			)}
		</div>
	),
}))

/** Builds a minimal chat row fixture with fictional ids and titles for unit tests. */
function createListItem(
	overrides: Partial<ChatConversationListItem> = {},
): ChatConversationListItem {
	return {
		id: "chat-project-alpha",
		title: "Mock conversation alpha",
		timeLabel: "2 minutes ago",
		isPinned: false,
		isRunning: false,
		project: { id: "chat-project-alpha" } as ChatConversationListItem["project"],
		...overrides,
	}
}

const defaultRowProps = {
	moreAriaLabel: "More actions",
	pinLabel: "Pin",
	renameLabel: "Rename",
	saveAsLabel: "Save as project",
	deleteLabel: "Delete",
	onOpen: vi.fn(),
	onMenuOpenChange: vi.fn(),
	onPin: vi.fn(),
	onRename: vi.fn(),
	onSaveAsProject: vi.fn(),
	onDelete: vi.fn(),
}

describe("ChatConversationSubMenuRow", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("does not mark an unselected row as selected", () => {
		render(
			<ChatConversationSubMenuRow
				item={createListItem()}
				isSelected={false}
				{...defaultRowProps}
			/>,
		)

		const row = screen.getByTestId("sidebar-chats-submenu-item-chat-project-alpha")
		expect(row).toHaveAttribute("data-selected", "false")
		expect(row).not.toHaveClass("bg-sidebar-accent")
	})

	it("applies selected styling when isSelected is true", () => {
		render(
			<ChatConversationSubMenuRow item={createListItem()} isSelected {...defaultRowProps} />,
		)

		const row = screen.getByTestId("sidebar-chats-submenu-item-chat-project-alpha")
		expect(row).toHaveAttribute("data-selected", "true")
		expect(row).toHaveClass("bg-sidebar-accent")
		expect(screen.getByText("Mock conversation alpha")).toHaveClass(
			"text-sidebar-accent-foreground",
		)
	})

	it("renders pin action and pinned badge when the chat is pinned", () => {
		render(
			<ChatConversationSubMenuRow
				item={createListItem({ isPinned: true })}
				{...defaultRowProps}
				pinLabel="Unpin"
			/>,
		)

		fireEvent.click(screen.getByTestId("sidebar-chats-submenu-more-chat-project-alpha"))
		expect(screen.getByRole("menuitem", { name: "Unpin" })).toBeInTheDocument()
		expect(screen.getByTestId("project-item-pinned-tag")).toBeInTheDocument()
	})

	it("renders only the title without the conversation update time", () => {
		render(<ChatConversationSubMenuRow item={createListItem()} {...defaultRowProps} />)

		expect(screen.queryByText("2 minutes ago")).not.toBeInTheDocument()
	})

	it("keeps more actions from opening the conversation row", () => {
		const onOpen = vi.fn()
		render(
			<ChatConversationSubMenuRow
				item={createListItem()}
				{...defaultRowProps}
				onOpen={onOpen}
			/>,
		)

		fireEvent.click(screen.getByTestId("sidebar-chats-submenu-more-chat-project-alpha"))

		expect(screen.getByRole("menu")).toBeInTheDocument()
		expect(onOpen).not.toHaveBeenCalled()
	})

	it("opens the project-style context menu at the more-button click position", () => {
		render(<ChatConversationSubMenuRow item={createListItem()} {...defaultRowProps} />)
		const trigger = screen.getByTestId("sidebar-chats-submenu-more-chat-project-alpha")
		const contextMenu = vi.fn()
		trigger.addEventListener("contextmenu", contextMenu)
		fireEvent.click(trigger, { detail: 1, clientX: 210, clientY: 320 })
		expect(contextMenu).toHaveBeenCalledWith(
			expect.objectContaining({ clientX: 210, clientY: 320 }),
		)
		expect(screen.getByRole("menu")).toHaveClass("min-w-[160px]", "max-w-[280px]")
		fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }))
		expect(defaultRowProps.onRename).toHaveBeenCalledTimes(1)
		expect(defaultRowProps.onOpen).not.toHaveBeenCalled()
	})

	it("supports right-clicking the conversation row", () => {
		render(<ChatConversationSubMenuRow item={createListItem()} {...defaultRowProps} />)
		fireEvent.contextMenu(screen.getByText("Mock conversation alpha"), {
			clientX: 80,
			clientY: 240,
		})
		expect(screen.getByRole("menuitem", { name: "Save as project" })).toBeInTheDocument()
		expect(defaultRowProps.onMenuOpenChange).toHaveBeenCalledWith(
			true,
			expect.objectContaining({ id: "chat-project-alpha" }),
		)
		expect(defaultRowProps.onOpen).not.toHaveBeenCalled()
	})

	it("uses the workspace action hover and keyboard-focus treatment", () => {
		render(<ChatConversationSubMenuRow item={createListItem()} {...defaultRowProps} />)

		expect(screen.getByTestId("sidebar-chats-submenu-more-chat-project-alpha")).toHaveClass(
			"hover:before:bg-sidebar-foreground/10",
			"focus-visible:before:bg-sidebar-foreground/10",
			"focus-visible:ring-0",
			"group-focus-within/project-row:w-7",
		)
	})

	it("keeps the more trigger available on coarse pointer desktop layouts", () => {
		render(<ChatConversationSubMenuRow item={createListItem()} {...defaultRowProps} />)

		expect(screen.getByTestId("sidebar-chats-submenu-more-chat-project-alpha")).toHaveClass(
			"no-hover:w-7",
		)
	})

	it("clears the pending row-click suppression timer on unmount", () => {
		const clearTimeoutSpy = vi.spyOn(window, "clearTimeout")
		const { unmount } = render(
			<ChatConversationSubMenuRow item={createListItem()} {...defaultRowProps} />,
		)

		fireEvent.click(screen.getByTestId("sidebar-chats-submenu-more-chat-project-alpha"))
		unmount()

		expect(clearTimeoutSpy).toHaveBeenCalled()
	})
})
