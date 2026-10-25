import type { ComponentProps } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import TopicHistoryPanelContent from "../TopicHistoryPanelContent"
import type { SuperAgentTopicStatusItem } from "@/apis/modules/superMagic"

const mockUsePaginatedTopics = vi.fn()
const mockReloadTopics = vi.fn()
const mockResetTopics = vi.fn()
const {
	mockStartTopicStatusPolling,
	mockStopTopicStatusPolling,
	mockGetTopicDetail,
	mockIsNoHoverCoarsePointer,
} = vi.hoisted(() => ({
	mockStartTopicStatusPolling: vi.fn(),
	mockStopTopicStatusPolling: vi.fn(),
	mockGetTopicDetail: vi.fn(),
	mockIsNoHoverCoarsePointer: vi.fn(() => false),
}))
let latestTopicStatusPollingHandler: ((items: SuperAgentTopicStatusItem[]) => void) | null = null

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
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

// The filter's menu interactions have their own tests; exercise the host's query scope here.
vi.mock("@/pages/superMagic/components/TopicTypeFilter", () => ({
	default: ({ onChange }: { onChange: (value: "scheduled_task") => void }) => (
		<button
			type="button"
			data-testid="topic-type-filter-trigger"
			onClick={() => onChange("scheduled_task")}
		>
			Scheduled tasks
		</button>
	),
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
	default: ({ status }: { status?: string }) => (
		<span data-testid="mock-status-icon" data-status={status} />
	),
}))

vi.mock("@/pages/superMagic/services/statusPollingService", () => ({
	default: {
		startTopicStatusPolling: (options: {
			onResult: (items: SuperAgentTopicStatusItem[]) => void
		}) => {
			latestTopicStatusPollingHandler = options.onResult
			mockStartTopicStatusPolling(options)
		},
		stopTopicStatusPolling: mockStopTopicStatusPolling,
	},
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		topic: {
			// Keep topic detail lookup inert in tests so row selection focuses on panel behavior.
			getTopicDetail: mockGetTopicDetail,
		},
	},
}))

vi.mock("@/utils/devices", () => ({
	isNoHoverCoarsePointer: mockIsNoHoverCoarsePointer,
}))

vi.mock("@/stores/recordingSummary", () => ({
	default: {
		isRecordingTopic: () => false,
	},
}))

vi.mock("@radix-ui/react-dropdown-menu", () => {
	const DropdownContext = React.createContext<{
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
			<DropdownContext.Provider value={{ open, onOpenChange }}>
				{children}
			</DropdownContext.Provider>
		)
	}

	function Trigger({
		asChild,
		children,
	}: {
		asChild?: boolean
		children: React.ReactElement<{ onClick?: (event: React.MouseEvent) => void }>
	}) {
		const context = React.useContext(DropdownContext)
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
		className,
		"data-testid": dataTestId,
	}: {
		children: React.ReactNode
		className?: string
		"data-testid"?: string
	}) {
		const context = React.useContext(DropdownContext)
		if (!context?.open) return null

		return (
			<div className={className} data-testid={dataTestId}>
				{children}
				<button
					type="button"
					data-testid="mock-dropdown-outside"
					onClick={() => {
						context.onOpenChange?.(false)
					}}
				>
					outside
				</button>
			</div>
		)
	}

	function Item({
		children,
		onClick,
		"data-testid": dataTestId,
		disabled,
	}: {
		children: React.ReactNode
		onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
		"data-testid"?: string
		disabled?: boolean
	}) {
		const context = React.useContext(DropdownContext)

		return (
			<button
				type="button"
				disabled={disabled}
				data-testid={dataTestId}
				onClick={(event) => {
					onClick?.(event)
					context?.onOpenChange?.(false)
				}}
			>
				{children}
			</button>
		)
	}

	const Group = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
	const Label = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
	const Separator = () => <div role="separator" />
	const Portal = ({ children }: { children: React.ReactNode }) => <>{children}</>
	const Sub = ({ children }: { children: React.ReactNode }) => <>{children}</>
	const SubTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
	const SubContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
	const CheckboxItem = Item
	const RadioGroup = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
	const RadioItem = Item
	const ItemIndicator = ({ children }: { children: React.ReactNode }) => <>{children}</>

	return {
		Root,
		Portal,
		Trigger,
		Content,
		Group,
		Label,
		Item,
		CheckboxItem,
		RadioGroup,
		RadioItem,
		Separator,
		Sub,
		SubTrigger,
		SubContent,
		ItemIndicator,
	}
})

vi.mock("@radix-ui/react-context-menu", () => {
	const ContextMenuContext = React.createContext<{
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
			<ContextMenuContext.Provider value={{ open, onOpenChange }}>
				{children}
			</ContextMenuContext.Provider>
		)
	}

	function Trigger({
		asChild,
		children,
	}: {
		asChild?: boolean
		children: React.ReactElement<{ onContextMenu?: (event: React.MouseEvent) => void }>
	}) {
		const context = React.useContext(ContextMenuContext)
		if (!asChild || !React.isValidElement(children) || !context) return children

		return React.cloneElement(children, {
			onContextMenu: (event: React.MouseEvent) => {
				event.preventDefault()
				children.props.onContextMenu?.(event)
				context.onOpenChange?.(!context.open)
			},
		})
	}

	function Content({
		children,
		className,
		"data-testid": dataTestId,
	}: {
		children: React.ReactNode
		className?: string
		"data-testid"?: string
	}) {
		const context = React.useContext(ContextMenuContext)
		if (!context?.open) return null

		return (
			<div className={className} data-testid={dataTestId}>
				{children}
				<button
					type="button"
					data-testid="mock-context-menu-outside"
					onClick={() => {
						context.onOpenChange?.(false)
					}}
				>
					outside
				</button>
			</div>
		)
	}

	function Item({
		children,
		onSelect,
		disabled,
		"data-testid": dataTestId,
	}: {
		children: React.ReactNode
		onSelect?: (event: Event) => void
		disabled?: boolean
		"data-testid"?: string
	}) {
		const context = React.useContext(ContextMenuContext)

		return (
			<button
				type="button"
				disabled={disabled}
				data-testid={dataTestId}
				onClick={() => {
					onSelect?.(new Event("select"))
					context?.onOpenChange?.(false)
				}}
			>
				{children}
			</button>
		)
	}

	const Group = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
	const Label = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
	const Separator = () => <div role="separator" />
	const Portal = ({ children }: { children: React.ReactNode }) => <>{children}</>
	const Sub = ({ children }: { children: React.ReactNode }) => <>{children}</>
	const SubTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
	const SubContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
	const CheckboxItem = Item
	const RadioGroup = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
	const RadioItem = Item
	const ItemIndicator = ({ children }: { children: React.ReactNode }) => <>{children}</>

	return {
		Root,
		Trigger,
		Content,
		Item,
		CheckboxItem,
		RadioItem,
		Label,
		Separator,
		Group,
		Portal,
		Sub,
		SubContent,
		SubTrigger,
		RadioGroup,
		ItemIndicator,
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

		const result = render(<TopicHistoryPanelContent {...defaultProps} {...overrides} />)
		return {
			...result,
			rerenderComponent: (next: Partial<ComponentProps<typeof TopicHistoryPanelContent>>) =>
				result.rerender(
					<TopicHistoryPanelContent {...defaultProps} {...overrides} {...next} />,
				),
		}
	}

	beforeEach(() => {
		mockReloadTopics.mockReset()
		mockResetTopics.mockReset()
		mockStartTopicStatusPolling.mockClear()
		mockStopTopicStatusPolling.mockClear()
		mockGetTopicDetail.mockReset()
		mockIsNoHoverCoarsePointer.mockReset()
		mockIsNoHoverCoarsePointer.mockReturnValue(false)
		latestTopicStatusPollingHandler = null
		mockUsePaginatedTopics.mockImplementation(
			(options?: { storeTopics?: Topic[]; searchKeyword?: string }) => {
				const sourceTopics = options?.storeTopics ?? topics
				const normalizedKeyword = options?.searchKeyword?.toLowerCase().trim() ?? ""
				const filteredTopics = normalizedKeyword
					? sourceTopics.filter((topic) =>
							(topic.topic_name ?? "").toLowerCase().includes(normalizedKeyword),
						)
					: sourceTopics

				return {
					displayTopics: filteredTopics,
					isLoading: false,
					isReloading: false,
					reload: mockReloadTopics,
					reset: mockResetTopics,
					total: filteredTopics.length,
				}
			},
		)
	})

	it("keeps topic-type filtering available for regular project histories", () => {
		renderComponent()

		expect(screen.getByTestId("topic-type-filter-trigger")).toBeInTheDocument()
	})

	it("hides topic-type filtering and loads all topics for scoped histories", () => {
		renderComponent({ hideTopicTypeFilter: true })

		expect(screen.queryByTestId("topic-type-filter-trigger")).toBeNull()
		expect(mockUsePaginatedTopics).toHaveBeenLastCalledWith(
			expect.objectContaining({ topicType: "all" }),
		)
		expect(screen.getByText("Alpha Topic")).toBeInTheDocument()
		expect(screen.getByText("Beta Topic")).toBeInTheDocument()
	})

	it("stops applying a selected type when filtering becomes hidden", () => {
		const { rerenderComponent } = renderComponent()
		fireEvent.click(screen.getByTestId("topic-type-filter-trigger"))
		expect(mockUsePaginatedTopics).toHaveBeenLastCalledWith(
			expect.objectContaining({ topicType: "scheduled_task" }),
		)

		rerenderComponent({ hideTopicTypeFilter: true })

		expect(screen.queryByTestId("topic-type-filter-trigger")).toBeNull()
		expect(mockUsePaginatedTopics).toHaveBeenLastCalledWith(
			expect.objectContaining({ topicType: "all" }),
		)
	})

	it("shows server total in panel title", () => {
		mockUsePaginatedTopics.mockReturnValue({
			displayTopics: topics,
			isLoading: false,
			isReloading: false,
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

		return waitFor(() => {
			expect(screen.queryByText("Alpha Topic")).not.toBeInTheDocument()
			expect(screen.getByText("Beta Topic")).toBeInTheDocument()
		})
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

	it("expands the conversation panel before selecting a topic when it is collapsed", () => {
		const callOrder: string[] = []
		const handleExpandConversationPanel = vi.fn(() => {
			callOrder.push("expand")
		})
		const handleSelectTopic = vi.fn(() => {
			callOrder.push("select")
		})

		renderComponent({
			isConversationPanelCollapsed: true,
			onExpandConversationPanel: handleExpandConversationPanel,
			onSelectTopic: handleSelectTopic,
		})

		fireEvent.click(screen.getByTestId("message-header-history-item-topic-2"))

		expect(handleExpandConversationPanel).toHaveBeenCalledTimes(1)
		expect(handleSelectTopic).toHaveBeenCalledTimes(1)
		expect(callOrder).toEqual(["expand", "select"])
	})

	it("keeps the history panel open after selecting a topic", () => {
		const handleClose = vi.fn()
		const handleSelectTopic = vi.fn()

		renderComponent({
			onClose: handleClose,
			onSelectTopic: handleSelectTopic,
		})

		fireEvent.click(screen.getByTestId("message-header-history-item-topic-2"))

		expect(handleSelectTopic).toHaveBeenCalledTimes(1)
		expect(handleClose).not.toHaveBeenCalled()
		expect(screen.getByTestId("message-header-history-panel-container")).toBeInTheDocument()
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
			expect(mockReloadTopics).toHaveBeenCalledTimes(1)
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

	it("shows refresh button spinning while topics are reloading", () => {
		mockUsePaginatedTopics.mockReturnValue({
			displayTopics: topics,
			isLoading: false,
			isReloading: true,
			reload: mockReloadTopics,
			reset: mockResetTopics,
			total: topics.length,
		})

		renderComponent({
			onClose: vi.fn(),
		})

		const refreshButton = screen.getByTestId("message-header-history-refresh-button")
		expect(refreshButton).toBeDisabled()
		expect(refreshButton.querySelector("svg")?.classList.contains("animate-spin")).toBe(true)
	})

	it("does not render close button when onClose is omitted", () => {
		renderComponent()

		expect(screen.queryByTestId("message-header-history-close-button")).not.toBeInTheDocument()
	})

	it("点击外部时关闭话题操作菜单", async () => {
		renderComponent({
			onClose: vi.fn(),
		})

		fireEvent.mouseEnter(screen.getByTestId("message-header-history-item-topic-2"))
		fireEvent.click(screen.getByTestId("message-header-history-item-menu-button-topic-2"))

		await waitFor(() => {
			expect(
				screen.getByTestId("message-header-history-item-menu-topic-topic-2"),
			).toBeInTheDocument()
		})

		fireEvent.click(screen.getByTestId("mock-dropdown-outside"))

		await waitFor(() => {
			expect(
				screen.queryByTestId("message-header-history-item-menu-topic-topic-2"),
			).not.toBeInTheDocument()
		})
	})

	it("keeps desktop topic actions hidden until the row is hovered", () => {
		renderComponent()

		expect(
			screen.queryByTestId("message-header-history-item-menu-button-topic-2"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("message-header-history-item-pin-button-topic-2"),
		).not.toBeInTheDocument()

		fireEvent.mouseEnter(screen.getByTestId("message-header-history-item-topic-2"))

		expect(
			screen.getByTestId("message-header-history-item-menu-button-topic-2"),
		).toBeInTheDocument()
		expect(
			screen.getByTestId("message-header-history-item-pin-button-topic-2"),
		).toBeInTheDocument()
	})

	it("shows no-hover browser topic actions without hover and moves pin into the more menu", async () => {
		const handlePinTopic = vi.fn().mockResolvedValue(undefined)
		mockIsNoHoverCoarsePointer.mockReturnValue(true)

		renderComponent({
			onPinTopic: handlePinTopic,
		})

		expect(screen.getAllByTestId("mock-status-icon")).toHaveLength(2)
		expect(
			screen.queryByTestId("message-header-history-item-pin-button-topic-2"),
		).not.toBeInTheDocument()
		expect(
			screen.getByTestId("message-header-history-item-menu-button-topic-2"),
		).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("message-header-history-item-menu-button-topic-2"))
		expect(
			screen
				.getByTestId("message-header-history-item-menu-topic-topic-2")
				.querySelector("button"),
		).toBe(screen.getByTestId("message-header-history-item-pin"))
		fireEvent.click(screen.getByTestId("message-header-history-item-pin"))

		await waitFor(() => {
			expect(handlePinTopic).toHaveBeenCalledTimes(1)
			expect(handlePinTopic).toHaveBeenCalledWith("topic-2")
			expect(mockReloadTopics).toHaveBeenCalledTimes(1)
		})
	})

	it("right click opens context menu without selecting topic", () => {
		const handleSelectTopic = vi.fn()

		renderComponent({
			onSelectTopic: handleSelectTopic,
		})

		fireEvent.contextMenu(screen.getByTestId("message-header-history-item-topic-2"))

		expect(
			screen.getByTestId("message-header-history-item-context-menu-topic-topic-2"),
		).toBeInTheDocument()
		expect(handleSelectTopic).not.toHaveBeenCalled()
	})

	it.each([false, true])(
		"toggles pinned=%s from the context menu without selecting the topic",
		async (isPinned) => {
			const onPinTopic = vi.fn().mockResolvedValue(undefined)
			const onUnpinTopic = vi.fn().mockResolvedValue(undefined)
			const onSelectTopic = vi.fn()
			renderComponent({
				topics: [{ ...topics[1], is_pinned: isPinned }],
				onPinTopic,
				onUnpinTopic,
				onSelectTopic,
			})
			fireEvent.contextMenu(screen.getByTestId("message-header-history-item-topic-2"))
			const item = screen.getByTestId("message-header-history-context-pin")
			expect(item).toHaveTextContent(isPinned ? "messageHeader.unpin" : "messageHeader.pin")
			fireEvent.click(item)
			await waitFor(() => expect(mockReloadTopics).toHaveBeenCalledTimes(1))
			expect(isPinned ? onUnpinTopic : onPinTopic).toHaveBeenCalledWith("topic-2")
			expect(isPinned ? onPinTopic : onUnpinTopic).not.toHaveBeenCalled()
			expect(onSelectTopic).not.toHaveBeenCalled()
		},
	)

	it("calls onEditTopic from context menu", () => {
		const handleEditTopic = vi.fn()

		renderComponent({
			onEditTopic: handleEditTopic,
		})

		fireEvent.contextMenu(screen.getByTestId("message-header-history-item-topic-2"))
		fireEvent.click(screen.getByTestId("message-header-history-item-rename"))

		expect(handleEditTopic).toHaveBeenCalledTimes(1)
		expect(handleEditTopic).toHaveBeenCalledWith(topics[1])
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
			isReloading: false,
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
			expect(mockReloadTopics).toHaveBeenCalledTimes(1)
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

		expect(mockReloadTopics).toHaveBeenCalledTimes(1)
	})

	it("reconciles stale running patches back to finished when store topics complete", async () => {
		const runningTopic = {
			...topics[0],
			task_status: TaskStatus.RUNNING,
			status: TaskStatus.RUNNING,
		}
		const finishedTopic = {
			...topics[0],
			task_status: TaskStatus.FINISHED,
			status: TaskStatus.FINISHED,
		}

		mockUsePaginatedTopics.mockReturnValue({
			displayTopics: [runningTopic],
			isLoading: false,
			isReloading: false,
			reload: mockReloadTopics,
			reset: mockResetTopics,
			total: 1,
		})

		const { rerender } = renderComponent({
			topics: [runningTopic],
			selectedTopicId: runningTopic.id,
		})

		expect(screen.getByTestId("mock-status-icon")).toHaveAttribute(
			"data-status",
			TaskStatus.RUNNING,
		)

		act(() => {
			latestTopicStatusPollingHandler?.([
				{
					id: runningTopic.id,
					status: TaskStatus.RUNNING,
					has_unread: false,
				} as SuperAgentTopicStatusItem,
			])
		})

		mockUsePaginatedTopics.mockReturnValue({
			displayTopics: [finishedTopic],
			isLoading: false,
			isReloading: false,
			reload: mockReloadTopics,
			reset: mockResetTopics,
			total: 1,
		})

		rerender(
			<TopicHistoryPanelContent
				topics={[finishedTopic]}
				projectId="project-1"
				selectedTopicId={finishedTopic.id}
				editingTopicId={null}
				editingValue=""
				onEditingValueChange={vi.fn()}
				onEditSubmit={vi.fn()}
				onEditCancel={vi.fn()}
				onEditTopic={vi.fn()}
				onAiRenameTopic={vi.fn()}
				onDeleteTopic={vi.fn()}
				onPinTopic={vi.fn()}
				onUnpinTopic={vi.fn()}
				onArchiveTopic={vi.fn()}
				onUnarchiveTopic={vi.fn()}
				onSelectTopic={vi.fn()}
				canDeleteTopic={true}
				onCreateTopic={vi.fn()}
			/>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("mock-status-icon")).toHaveAttribute(
				"data-status",
				TaskStatus.FINISHED,
			)
		})
	})
})
