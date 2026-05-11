import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type {
	ComponentProps,
	HTMLAttributes,
	ReactElement,
	ReactNode,
	MouseEvent as ReactMouseEvent,
} from "react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { TaskStatus, TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import TopicHistoryDropdown from "../TopicHistoryDropdown"

const mockUsePaginatedTopics = vi.fn()

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/base", () => ({
	MagicDropdown: ({
		children,
		open,
		onOpenChange,
		popupRender,
	}: {
		children: ReactNode
		open?: boolean
		onOpenChange?: (open: boolean) => void
		popupRender?: () => ReactNode
	}) => (
		<div data-testid="magic-dropdown">
			<button
				type="button"
				data-testid="dropdown-trigger"
				onClick={() => onOpenChange?.(!open)}
			>
				{children}
			</button>
			{open ? (
				<div data-testid="dropdown-content">
					<button
						type="button"
						data-testid="dropdown-request-close"
						onClick={() => onOpenChange?.(false)}
					>
						close
					</button>
					{popupRender?.()}
				</div>
			) : null}
		</div>
	),
}))

vi.mock("@/pages/superMagic/hooks/usePaginatedTopics", () => ({
	default: (options: unknown) => mockUsePaginatedTopics(options),
}))

vi.mock("@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip", () => ({
	default: ({ text, ...props }: { text: string }) => <span {...props}>{text}</span>,
}))

vi.mock(
	"@/pages/superMagicMobile/components/HierarchicalWorkspacePopup/components/ModeTag",
	() => ({
		default: () => <span data-testid="mock-mode-tag" />,
	}),
)

vi.mock("../StatusIcon", () => ({
	default: () => <span data-testid="mock-status-icon" />,
}))

vi.mock("@/stores/recordingSummary", () => ({
	default: {
		isRecordingTopic: () => false,
	},
}))

vi.mock("@radix-ui/react-popover", async () => {
	const React = await import("react")

	const PopoverContext = React.createContext<{
		open: boolean
		onOpenChange?: (open: boolean) => void
	}>({
		open: false,
	})

	function Root({
		open = false,
		onOpenChange,
		children,
	}: {
		open?: boolean
		onOpenChange?: (open: boolean) => void
		children: ReactNode
	}) {
		return (
			<PopoverContext.Provider value={{ open, onOpenChange }}>
				{children}
			</PopoverContext.Provider>
		)
	}

	function Trigger({
		children,
	}: {
		children: ReactElement<{ onClick?: (event: ReactMouseEvent) => void }>
	}) {
		const { open, onOpenChange } = React.useContext(PopoverContext)

		return React.cloneElement(children, {
			onClick: (event: ReactMouseEvent) => {
				children.props.onClick?.(event)
				onOpenChange?.(!open)
			},
		})
	}

	function Content({
		children,
		align: _align,
		side: _side,
		sideOffset: _sideOffset,
		onInteractOutside: _onInteractOutside,
		...props
	}: HTMLAttributes<HTMLDivElement> & {
		children: ReactNode
		align?: string
		side?: string
		sideOffset?: number
		onInteractOutside?: (event: Event) => void
	}) {
		const { open } = React.useContext(PopoverContext)
		if (!open) return null

		return <div {...props}>{children}</div>
	}

	return {
		Root,
		Trigger,
		Content,
	}
})

describe("TopicHistoryDropdown", () => {
	const topics: Topic[] = [
		{
			id: "topic-1",
			user_id: "user-1",
			chat_topic_id: "chat-topic-1",
			chat_conversation_id: "chat-conversation-1",
			topic_name: "Alpha Topic",
			task_status: TaskStatus.FINISHED,
			task_mode: "chat",
			project_id: "project-1",
			topic_mode: TopicMode.General,
			updated_at: "2026-04-01T00:00:00Z",
			workspace_id: "workspace-1",
			token_used: null,
		},
		{
			id: "topic-2",
			user_id: "user-1",
			chat_topic_id: "chat-topic-2",
			chat_conversation_id: "chat-conversation-2",
			topic_name: "Beta Topic",
			task_status: TaskStatus.RUNNING,
			task_mode: "chat",
			project_id: "project-1",
			topic_mode: TopicMode.General,
			updated_at: "2026-04-01T00:00:00Z",
			workspace_id: "workspace-1",
			token_used: null,
		},
	]

	function renderComponent(overrides: Partial<ComponentProps<typeof TopicHistoryDropdown>> = {}) {
		const defaultProps: ComponentProps<typeof TopicHistoryDropdown> = {
			topics,
			projectId: "project-1",
			selectedTopicId: "topic-1",
			editingTopicId: null,
			editingValue: "",
			onEditingValueChange: vi.fn(),
			onEditSubmit: vi.fn(),
			onEditCancel: vi.fn(),
			onEditTopic: vi.fn(),
			onAiRenameTopic: vi.fn(),
			onDeleteTopic: vi.fn(),
			onPinTopic: vi.fn(),
			onUnpinTopic: vi.fn(),
			onArchiveTopic: vi.fn(),
			onUnarchiveTopic: vi.fn(),
			onSelectTopic: vi.fn(),
			canDeleteTopic: true,
			onCreateTopic: vi.fn(),
			children: <span>trigger</span>,
		}

		return render(<TopicHistoryDropdown {...defaultProps} {...overrides} />)
	}

	beforeEach(() => {
		mockUsePaginatedTopics.mockReturnValue({
			displayTopics: topics,
			isLoading: false,
			reload: vi.fn(),
			reset: vi.fn(),
			total: topics.length,
		})
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("closes dropdown after selecting a topic", async () => {
		const handleSelectTopic = vi.fn()

		renderComponent({
			onSelectTopic: handleSelectTopic,
		})

		fireEvent.click(screen.getByTestId("dropdown-trigger"))
		fireEvent.click(screen.getByTestId("message-header-history-item-topic-2"))

		expect(handleSelectTopic).toHaveBeenCalledWith(topics[1])

		await waitFor(() => {
			expect(screen.queryByTestId("dropdown-content")).not.toBeInTheDocument()
		})
	})

	it("closes dropdown after creating a topic", async () => {
		const handleCreateTopic = vi.fn()

		renderComponent({
			onCreateTopic: handleCreateTopic,
		})

		fireEvent.click(screen.getByTestId("dropdown-trigger"))
		fireEvent.click(screen.getByTestId("message-header-history-add-topic-button"))

		expect(handleCreateTopic).toHaveBeenCalledTimes(1)

		await waitFor(() => {
			expect(screen.queryByTestId("dropdown-content")).not.toBeInTheDocument()
		})
	})

	it("focuses search input after dropdown opens", async () => {
		vi.useFakeTimers()

		renderComponent()

		fireEvent.click(screen.getByTestId("dropdown-trigger"))

		act(() => {
			vi.advanceTimersByTime(150)
		})

		expect(screen.getByTestId("message-header-history-search-input")).toHaveFocus()
	})

	it("keeps dropdown open for the immediate close request after a menu action", async () => {
		const handleEditTopic = vi.fn()

		renderComponent({
			onEditTopic: handleEditTopic,
		})

		fireEvent.click(screen.getByTestId("dropdown-trigger"))
		fireEvent.mouseEnter(screen.getByTestId("message-header-history-item-topic-2"))
		fireEvent.click(screen.getByTestId("message-header-history-item-menu-button-topic-2"))
		fireEvent.click(screen.getByTestId("message-header-history-item-rename"))

		expect(handleEditTopic).toHaveBeenCalledWith(topics[1])

		fireEvent.click(screen.getByTestId("dropdown-request-close"))

		await waitFor(() => {
			expect(screen.getByTestId("dropdown-content")).toBeInTheDocument()
		})
	})

	it("allows the next normal close after a menu action", async () => {
		const handleEditTopic = vi.fn()

		renderComponent({
			onEditTopic: handleEditTopic,
		})

		fireEvent.click(screen.getByTestId("dropdown-trigger"))
		fireEvent.mouseEnter(screen.getByTestId("message-header-history-item-topic-2"))
		fireEvent.click(screen.getByTestId("message-header-history-item-menu-button-topic-2"))
		fireEvent.click(screen.getByTestId("message-header-history-item-rename"))

		expect(handleEditTopic).toHaveBeenCalledWith(topics[1])

		fireEvent.click(screen.getByTestId("dropdown-request-close"))

		await waitFor(() => {
			expect(screen.getByTestId("dropdown-content")).toBeInTheDocument()
		})

		fireEvent.click(screen.getByTestId("dropdown-request-close"))

		await waitFor(() => {
			expect(screen.queryByTestId("dropdown-content")).not.toBeInTheDocument()
		})
	})

	it("does not render close button in dropdown mode", () => {
		renderComponent()

		fireEvent.click(screen.getByTestId("dropdown-trigger"))

		expect(screen.queryByTestId("message-header-history-close-button")).not.toBeInTheDocument()
	})
})
