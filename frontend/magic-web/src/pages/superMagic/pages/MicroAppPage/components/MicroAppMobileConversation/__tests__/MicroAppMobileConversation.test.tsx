import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import MicroAppConversationFloatingButton from "../MicroAppConversationFloatingButton"
import MicroAppTopicPicker from "../MicroAppTopicPicker"
import MicroAppMobileConversation from ".."

const scopedProgressMocks = vi.hoisted(() => ({
	params: null as Record<string, unknown> | null,
}))

const topicModeMocks = vi.hoisted(() => ({
	useCreateTopicListener: vi.fn(),
}))

const messageListMocks = vi.hoisted(() => ({
	setSelectedDetail: undefined as ((detail: unknown) => void) | undefined,
	onFileClick: undefined as ((file?: unknown) => void) | undefined,
}))

const mentionInsertMocks = vi.hoisted(() => ({
	insertCurrentMicroAppMention: vi.fn(),
}))

vi.mock("../../../utils/insertCurrentMicroAppMention", () => mentionInsertMocks)

const modelModeMocks = vi.hoisted(() => ({
	resolveMicroAppModelSelectionMode: vi.fn(() => "default"),
	resolveMicroAppRuntimeModelSelectionMode: vi.fn((mode: string) => mode),
}))

vi.mock("../../../utils/microAppModelMode", () => modelModeMocks)

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) =>
			options?.count == null ? key : `${key}:${options.count}`,
	}),
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({
		children,
		visible,
		position,
	}: {
		children: ReactNode
		visible?: boolean
		position?: string
	}) =>
		visible ? (
			<div data-testid="micro-app-topic-popup" data-position={position}>
				{children}
			</div>
		) : null,
}))

vi.mock("@/pages/superMagicMobile/components/icons/mobile-resource-type-icon", () => ({
	MobileResourceTypeIcon: () => <span data-testid="topic-status" />,
}))

vi.mock(
	"@/pages/superMagicMobile/pages/ProjectPage/ProjectPageMain/components/TopicsPopup/components/TopicItem/components/ModeTag",
	() => ({
		default: ({ agentCode }: { agentCode?: string }) => <span>{agentCode}</span>,
	}),
)

vi.mock("@/pages/superMagic/components/MessageList", () => ({
	default: ({
		fallbackRender,
		setSelectedDetail,
		onFileClick,
	}: {
		fallbackRender?: ReactNode
		setSelectedDetail?: (detail: unknown) => void
		onFileClick?: (file?: unknown) => void
	}) => {
		messageListMocks.setSelectedDetail = setSelectedDetail
		messageListMocks.onFileClick = onFileClick
		return (
			<div data-testid="mobile-message-list">
				{fallbackRender ?? <div data-testid="message-list-fallback" />}
			</div>
		)
	},
	MessageListProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/pages/superMagic/components/ProjectPageInputContainer", () => ({
	default: ({
		showModeToggle,
		showModelSelector,
		modelTopicMode,
		showTopicModeExamplePortal,
	}: {
		showModeToggle?: boolean
		showModelSelector?: boolean
		modelTopicMode?: string
		showTopicModeExamplePortal?: boolean
	}) => (
		<div
			data-testid="mobile-project-input"
			data-show-mode-toggle={showModeToggle}
			data-show-model-selector={showModelSelector}
			data-model-topic-mode={modelTopicMode}
			data-show-topic-mode-example-portal={String(showTopicModeExamplePortal)}
		/>
	),
}))

vi.mock("@/pages/superMagic/hooks/useRefreshTopicDetailOnTaskComplete", () => ({
	useRefreshTopicDetailOnTaskComplete: vi.fn(),
}))

vi.mock("@/pages/superMagic/components/TopicMode", () => ({
	useCreateTopicListener: topicModeMocks.useCreateTopicListener,
}))

vi.mock("@/pages/superMagic/hooks/useTopicMessages", () => ({
	useTopicMessages: () => ({
		handlePullMoreMessage: vi.fn(),
		isMessagesInitialLoading: false,
		isSelectedTopicMessagesReady: true,
	}),
}))

vi.mock("@/pages/superMagic/hooks/useTopicMode", () => ({
	default: ({ selectedTopic }: { selectedTopic?: { topic_mode?: string } }) => ({
		topicMode: selectedTopic?.topic_mode ?? "general",
		setTopicMode: vi.fn(),
		recoverTopicMode: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/hooks/useScopedTopicReadProgress", () => ({
	useScopedTopicReadProgress: (params: Record<string, unknown>) => {
		scopedProgressMocks.params = params
		return { handleTopicMessagesChange: vi.fn() }
	},
}))

vi.mock("@/pages/superMagic/hooks/useTopicConversationLoading", () => ({
	useTopicConversationLoading: () => ({ messages: [], showLoading: false }),
}))

vi.mock("@/pages/superMagic/hooks/useInterruptAndUndoMessage", () => ({
	useInterruptAndUndoMessage: vi.fn(),
}))

vi.mock("@/models/user", () => ({
	userStore: { user: { userInfo: null } },
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: { getTopicDetail: vi.fn() },
}))

describe("MicroApp mobile conversation controls", () => {
	const mentionPanelStoreMock = { setPinnedCurrentMicroApp: vi.fn() }
	const mentionPanelStore = mentionPanelStoreMock as never

	it("opens conversation from the floating button", () => {
		const onClick = vi.fn()
		render(<MicroAppConversationFloatingButton onClick={onClick} />)

		fireEvent.click(screen.getByTestId("micro-app-mobile-conversation-button"))

		expect(onClick).toHaveBeenCalledOnce()
		expect(screen.getByLabelText("microAppPage.mobileConversation.open")).toBeInTheDocument()
	})

	it("shows topics in a bottom popup and switches the selected topic", () => {
		const onSelect = vi.fn()
		const topics = [
			{ id: "topic-1", topic_name: "需求讨论" },
			{ id: "topic-2", topic_name: "实现细节" },
		] as never

		render(
			<MicroAppTopicPicker
				projectId="project-1"
				open
				topics={topics}
				selectedTopicId="topic-1"
				onSelect={onSelect}
				onClose={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("micro-app-topic-popup")).toHaveAttribute(
			"data-position",
			"bottom",
		)
		expect(screen.getByText("microAppPage.mobileConversation.topicCount:2")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("micro-app-mobile-topic-topic-2"))
		expect(onSelect).toHaveBeenCalledWith(topics[1])
		expect(screen.queryByTestId("micro-app-mobile-topic-mode-icon")).not.toBeInTheDocument()
	})

	it("shows employee icons in the preview topic list", () => {
		const topics = [
			{
				id: "topic-1",
				topic_name: "需求讨论",
				topic_mode: "custom_agent",
				agent_code: "SMA123",
			},
		] as never

		render(
			<MicroAppTopicPicker
				projectId="project-1"
				open
				topics={topics}
				selectedTopicId="topic-1"
				onSelect={vi.fn()}
				onClose={vi.fn()}
				showModeIcon
			/>,
		)

		expect(screen.getByTestId("micro-app-mobile-topic-mode-icon")).toHaveTextContent("SMA123")
	})

	it("uses default message styling and hides the employee selector", () => {
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "需求讨论" },
			topics: [],
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<MicroAppMobileConversation
				open
				selectedProject={{ id: "project-1", project_name: "微应用" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				attachments={[]}
				onOpenFile={vi.fn()}
				onOpenChange={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mobile-project-input")).toHaveAttribute(
			"data-show-mode-toggle",
			"false",
		)
		expect(screen.getByTestId("mobile-project-input")).toHaveAttribute(
			"data-show-model-selector",
			"true",
		)
		expect(screen.getByTestId("mobile-project-input")).toHaveAttribute(
			"data-model-topic-mode",
			"default",
		)
		expect(screen.getByTestId("mobile-message-list")).toBeInTheDocument()
		expect(screen.queryByText("microAppPage.issuePrompts.trigger")).not.toBeInTheDocument()
		expect(
			screen.getByTestId("micro-app-mobile-conversation-empty-illustration"),
		).toHaveAttribute("data-state", "conversation-empty")
		expect(screen.getByTestId("mobile-project-input")).toHaveAttribute(
			"data-show-topic-mode-example-portal",
			"false",
		)
	})

	it("shows the employee selector in preview mode", () => {
		const topicStore = {
			selectedTopic: {
				id: "topic-1",
				topic_name: "需求讨论",
				topic_mode: "custom_agent",
				agent_code: "SMA123",
			},
			topics: [
				{
					id: "topic-1",
					topic_name: "需求讨论",
					topic_mode: "custom_agent",
					agent_code: "SMA123",
				},
			],
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<MicroAppMobileConversation
				open
				selectedProject={{ id: "runtime-project", project_name: "微应用" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				attachments={[]}
				onOpenFile={vi.fn()}
				onOpenChange={vi.fn()}
				lockToMicroAppMode={false}
			/>,
		)

		expect(screen.getByTestId("mobile-project-input")).toHaveAttribute(
			"data-show-mode-toggle",
			"true",
		)
		expect(screen.getByTestId("mobile-project-input")).toHaveAttribute(
			"data-show-model-selector",
			"false",
		)
		expect(screen.getByTestId("mobile-project-input")).toHaveAttribute(
			"data-model-topic-mode",
			"custom_agent",
		)
		expect(modelModeMocks.resolveMicroAppRuntimeModelSelectionMode).toHaveBeenCalledWith(
			"custom_agent",
			"SMA123",
		)
		expect(screen.getByTestId("mobile-project-input")).toHaveAttribute(
			"data-show-topic-mode-example-portal",
			"true",
		)
		expect(
			screen.queryByTestId("micro-app-mobile-conversation-empty-illustration"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("message-list-fallback")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("micro-app-mobile-topic-switch"))
		expect(screen.getByTestId("micro-app-mobile-topic-mode-icon")).toHaveTextContent("SMA123")
	})

	it("binds create-topic events to the visible conversation store", () => {
		const selectedProject = { id: "runtime-project", project_name: "微应用" } as never
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "需求讨论" },
			topics: [],
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<MicroAppMobileConversation
				open
				selectedProject={selectedProject}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				attachments={[]}
				onOpenFile={vi.fn()}
				onOpenChange={vi.fn()}
				lockToMicroAppMode={false}
			/>,
		)

		expect(topicModeMocks.useCreateTopicListener).toHaveBeenCalledWith({
			selectedProject,
			topicStore,
		})
	})

	it("requests an attachment refresh when the topic reaches a terminal status", () => {
		const checkAttachmentsNowDebounced = vi.fn()
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "需求讨论" },
			topics: [],
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<MicroAppMobileConversation
				open
				selectedProject={{ id: "project-1", project_name: "微应用" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				attachments={[]}
				onOpenFile={vi.fn()}
				onOpenChange={vi.fn()}
				onTerminalTopicStatusChange={checkAttachmentsNowDebounced}
			/>,
		)

		expect(scopedProgressMocks.params).toEqual(
			expect.objectContaining({
				onTerminalTopicStatusChange: checkAttachmentsNowDebounced,
			}),
		)
	})

	it("opens tool details without closing the conversation sheet", () => {
		const onSelectDetail = vi.fn()
		const onOpenFile = vi.fn()
		const onOpenChange = vi.fn()
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "需求讨论" },
			topics: [],
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never
		const detail = {
			type: "shell",
			currentFileId: "tool-1",
			data: { command: "pwd" },
		}

		render(
			<MicroAppMobileConversation
				open
				selectedProject={{ id: "project-1", project_name: "微应用" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				attachments={[]}
				onSelectDetail={onSelectDetail}
				onOpenFile={onOpenFile}
				onOpenChange={onOpenChange}
			/>,
		)

		messageListMocks.setSelectedDetail?.(detail)

		expect(onOpenChange).not.toHaveBeenCalled()
		expect(onSelectDetail).toHaveBeenCalledWith(detail)
		expect(onOpenFile).not.toHaveBeenCalled()
	})

	it("keeps the conversation sheet open when a message file is previewed", () => {
		const onSelectDetail = vi.fn()
		const onOpenFile = vi.fn()
		const onOpenChange = vi.fn()
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "需求讨论" },
			topics: [],
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never
		const file = { file_id: "file-1", file_name: "random_content.md" }

		render(
			<MicroAppMobileConversation
				open
				selectedProject={{ id: "project-1", project_name: "微应用" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				attachments={[]}
				onSelectDetail={onSelectDetail}
				onOpenFile={onOpenFile}
				onOpenChange={onOpenChange}
			/>,
		)

		messageListMocks.onFileClick?.(file)

		expect(onOpenChange).not.toHaveBeenCalled()
		expect(onOpenFile).toHaveBeenCalledWith(file)
		expect(onSelectDetail).not.toHaveBeenCalled()
	})

	it("shows the mention hint and pins the current app in preview", () => {
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "需求讨论" },
			topics: [],
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<MicroAppMobileConversation
				open
				selectedProject={{ id: "runtime-project", project_name: "微应用" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				attachments={[]}
				onOpenFile={vi.fn()}
				onOpenChange={vi.fn()}
				lockToMicroAppMode={false}
				microAppId="app-1"
				microAppName="Todo App"
			/>,
		)

		expect(screen.getByTestId("micro-app-runtime-mention-hint")).toHaveTextContent(
			"microAppPage.conversation.mentionAppHintPrefix",
		)
		expect(screen.getByTestId("micro-app-runtime-mention-hint")).toHaveTextContent(
			"microAppPage.conversation.mentionAppHintAction",
		)
		expect(mentionPanelStoreMock.setPinnedCurrentMicroApp).toHaveBeenCalledWith({
			appId: "app-1",
			appName: "Todo App",
		})

		fireEvent.click(screen.getByTestId("micro-app-runtime-mention-hint"))
		expect(mentionInsertMocks.insertCurrentMicroAppMention).toHaveBeenCalledWith(undefined, {
			appId: "app-1",
			appName: "Todo App",
		})
	})
})

const filterRequests = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock("@/pages/superMagic/hooks/usePaginatedTopics", () => ({
	default: (params: { storeTopics: unknown[]; topicType: string }) => {
		filterRequests.query(params)
		const topics = params.topicType === "all" ? params.storeTopics : []
		return {
			displayTopics: topics,
			total: topics.length,
			isLoading: false,
			error: null,
			hasMore: false,
			reload: vi.fn(),
		}
	},
}))

it("filters the micro-app project without selecting a topic and resets for another project", () => {
	const onSelect = vi.fn()
	const props = {
		open: true,
		topics: [{ id: "ordinary", topic_name: "Ordinary" }] as never,
		onSelect,
		onClose: vi.fn(),
	}
	const { rerender } = render(<MicroAppTopicPicker {...props} projectId="micro-project" />)
	fireEvent.click(screen.getByRole("button", { name: "topicTypeFilter.label" }))
	fireEvent.click(screen.getByRole("checkbox", { name: "topicTypeFilter.topic" }))
	expect(filterRequests.query).toHaveBeenLastCalledWith(
		expect.objectContaining({
			projectId: "micro-project",
			topicType: "scheduled_task",
			enabled: true,
		}),
	)
	expect(screen.queryByText("Ordinary")).not.toBeInTheDocument()
	expect(onSelect).not.toHaveBeenCalled()
	rerender(<MicroAppTopicPicker {...props} projectId="runtime-project" />)
	expect(filterRequests.query).toHaveBeenLastCalledWith(
		expect.objectContaining({ projectId: "runtime-project", topicType: "all" }),
	)
})
