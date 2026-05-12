import type { ComponentProps } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { TaskStatus, TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import TopicHistoryPanelContent from "../TopicHistoryPanelContent"

const mockUsePaginatedTopics = vi.fn()
const mockReloadTopics = vi.fn()
const mockResetTopics = vi.fn()

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) => {
			if (
				key === "messageHeader.topicPanelTitle" &&
				options &&
				typeof options.count === "number"
			)
				return `messageHeader.topicPanelTitle:${options.count}`
			return key
		},
	}),
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

vi.mock("@radix-ui/react-popover", () => {
	const PopoverContext = React.createContext<{
		open: boolean
		onOpenChange?: (nextOpen: boolean) => void
	} | null>(null)

	function Root({
		open = false,
		onOpenChange,
		children,
	}: {
		open?: boolean
		onOpenChange?: (nextOpen: boolean) => void
		children: React.ReactNode
	}) {
		return (
			<PopoverContext.Provider value={{ open, onOpenChange }}>
				{children}
			</PopoverContext.Provider>
		)
	}

	function Trigger({
		asChild,
		children,
	}: {
		asChild?: boolean
		children: React.ReactElement<{ onClick?: (event: React.MouseEvent) => void }>
	}) {
		const context = React.useContext(PopoverContext)
		if (!asChild || !React.isValidElement(children) || !context) return children

		return React.cloneElement(children, {
			onClick: (event: React.MouseEvent) => {
				children.props.onClick?.(event)
				context.onOpenChange?.(!context.open)
			},
		})
	}

	function Content({
		children,
		onInteractOutside,
		className,
		"data-testid": dataTestId,
	}: {
		children: React.ReactNode
		onInteractOutside?: () => void
		className?: string
		"data-testid"?: string
	}) {
		const context = React.useContext(PopoverContext)
		if (!context?.open) return null

		return (
			<div className={className} data-testid={dataTestId}>
				{children}
				<button
					type="button"
					data-testid="mock-popover-outside"
					onClick={() => {
						onInteractOutside?.()
					}}
				>
					outside
				</button>
			</div>
		)
	}

	return {
		Root,
		Trigger,
		Content,
	}
})

describe("TopicHistoryPanelContent", () => {
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

	function renderComponent(
		overrides: Partial<ComponentProps<typeof TopicHistoryPanelContent>> = {},
	) {
		const defaultProps: ComponentProps<typeof TopicHistoryPanelContent> = {
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
		}

		return render(<TopicHistoryPanelContent {...defaultProps} {...overrides} />)
	}

	beforeEach(() => {
		mockReloadTopics.mockReset()
		mockResetTopics.mockReset()
		mockUsePaginatedTopics.mockReturnValue({
			displayTopics: topics,
			isLoading: false,
			reload: mockReloadTopics,
			reset: mockResetTopics,
			total: topics.length,
		})
	})

	it("shows server total in panel title", () => {
		mockUsePaginatedTopics.mockReturnValue({
			displayTopics: topics,
			isLoading: false,
			reload: mockReloadTopics,
			reset: mockResetTopics,
			total: 127,
		})

		renderComponent()

		expect(screen.getByTestId("message-header-history-panel-title")).toHaveTextContent(
			"messageHeader.topicPanelTitle:127",
		)
	})

	it("filters topics by search keyword", () => {
		renderComponent()

		fireEvent.change(screen.getByTestId("message-header-history-search-input"), {
			target: { value: "beta" },
		})

		expect(screen.queryByText("Alpha Topic")).not.toBeInTheDocument()
		expect(screen.getByText("Beta Topic")).toBeInTheDocument()
	})

	it("calls onSelectTopic when clicking a topic item", () => {
		const handleSelectTopic = vi.fn()

		renderComponent({
			onSelectTopic: handleSelectTopic,
		})

		fireEvent.click(screen.getByTestId("message-header-history-item-topic-2"))

		expect(handleSelectTopic).toHaveBeenCalledTimes(1)
		expect(handleSelectTopic).toHaveBeenCalledWith(topics[1])
	})

	it("calls onCreateTopic when clicking create button", () => {
		const handleCreateTopic = vi.fn()

		renderComponent({
			onCreateTopic: handleCreateTopic,
		})

		fireEvent.click(screen.getByTestId("message-header-history-add-topic-button"))

		expect(handleCreateTopic).toHaveBeenCalledTimes(1)
	})

	it("reloads topics after submitting rename", async () => {
		const handleEditSubmit = vi.fn().mockResolvedValue(undefined)

		renderComponent({
			editingTopicId: "topic-1",
			editingValue: "Alpha Topic Updated",
			onEditSubmit: handleEditSubmit,
		})

		fireEvent.blur(screen.getByTestId("message-header-history-item-edit-input-topic-1"))

		await waitFor(() => {
			expect(handleEditSubmit).toHaveBeenCalledWith("topic-1")
			expect(mockReloadTopics).toHaveBeenCalledTimes(2)
		})
	})

	it("renders close button and calls onClose when clicked", () => {
		const handleClose = vi.fn()

		renderComponent({
			onClose: handleClose,
		})

		fireEvent.click(screen.getByTestId("message-header-history-close-button"))

		expect(screen.getByTestId("message-header-history-panel-container")).toBeInTheDocument()
		expect(handleClose).toHaveBeenCalledTimes(1)
	})

	it("does not render close button when onClose is omitted", () => {
		renderComponent()

		expect(screen.queryByTestId("message-header-history-close-button")).not.toBeInTheDocument()
	})

	it("点击外部时关闭话题操作菜单", async () => {
		renderComponent({
			onClose: vi.fn(),
		})

		fireEvent.mouseEnter(screen.getByTestId("message-header-history-item-topic-1"))
		fireEvent.click(screen.getByTestId("message-header-history-item-menu-button-topic-1"))

		expect(screen.getByTestId("message-header-history-item-menu-topic-1")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("mock-popover-outside"))

		await waitFor(() => {
			expect(
				screen.queryByTestId("message-header-history-item-menu-topic-1"),
			).not.toBeInTheDocument()
		})
	})

	it("calls onAiRenameTopic with the paginated topic object and reloads list", async () => {
		const topic3: Topic = {
			id: "topic-3",
			user_id: "user-1",
			chat_topic_id: "chat-topic-3",
			chat_conversation_id: "chat-conversation-3",
			topic_name: "Gamma Topic",
			task_status: TaskStatus.FINISHED,
			task_mode: "chat",
			project_id: "project-1",
			topic_mode: TopicMode.General,
			updated_at: "2026-04-01T00:00:00Z",
			workspace_id: "workspace-1",
			token_used: null,
		}
		const handleAiRenameTopic = vi.fn().mockResolvedValue(undefined)

		mockUsePaginatedTopics.mockReturnValue({
			displayTopics: [...topics, topic3],
			isLoading: false,
			currentPage: 1,
			onScroll: vi.fn(),
			reload: mockReloadTopics,
			reset: mockResetTopics,
			total: 3,
			hasMore: false,
		})

		renderComponent({
			topics,
			onAiRenameTopic: handleAiRenameTopic,
		})

		fireEvent.mouseEnter(screen.getByTestId("message-header-history-item-topic-3"))
		fireEvent.click(screen.getByTestId("message-header-history-item-menu-button-topic-3"))
		fireEvent.click(screen.getByTestId("message-header-history-item-ai-rename"))

		await waitFor(() => {
			expect(handleAiRenameTopic).toHaveBeenCalledTimes(1)
			expect(handleAiRenameTopic).toHaveBeenCalledWith(topic3)
			expect(mockReloadTopics).toHaveBeenCalledTimes(2)
		})
	})

	it("passes reload callback to delete handler success path", async () => {
		const handleDeleteTopic = vi.fn()

		renderComponent({
			onDeleteTopic: handleDeleteTopic,
		})

		fireEvent.mouseEnter(screen.getByTestId("message-header-history-item-topic-1"))
		fireEvent.click(screen.getByTestId("message-header-history-item-menu-button-topic-1"))
		fireEvent.click(screen.getByTestId("message-header-history-item-delete"))

		expect(handleDeleteTopic).toHaveBeenCalledTimes(1)
		const deleteCall = handleDeleteTopic.mock.calls[0]
		expect(deleteCall[0]).toBe("topic-1")
		expect(deleteCall[1]).toBe("Alpha Topic")

		await Promise.resolve(deleteCall[2]?.onSuccess?.())

		expect(mockReloadTopics).toHaveBeenCalledTimes(2)
	})
})
