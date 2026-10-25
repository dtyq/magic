import { useLayoutEffect } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import RecordingDetailChatPanel from "../RecordingDetailChatPanel"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { RECORDING_CHAT_HISTORY_WIDTH } from "../recording-detail-layout"

const messageHeaderMock = vi.hoisted(() => vi.fn())
const historyPanelMock = vi.hoisted(() => vi.fn())
const createTopicListenerMock = vi.hoisted(() => vi.fn())
const refreshTopicDetailMock = vi.hoisted(() => vi.fn())
/** Lets focused tests drive the messages-loading barrier that AiChat reports to the panel overlay. */
const aiChatMessagesLoadingMock = vi.hoisted(() => ({ loading: true }))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/business/RecordingSummary/components/AiChat", () => {
	/** Test double that reports the messages-loading barrier like project-detail AiChat. */
	function MockRecordingDetailAiChat(props: {
		useRecordingSync?: boolean
		projectDetailMode?: boolean
		allowRecordingMode?: boolean
		onToggleHistoryPanel?: () => void
		isConversationPanelCollapsed?: boolean
		onToggleConversationPanel?: () => void
		onExpandConversationPanel?: () => void
		onMessagesInitialLoadingChange?: (loading: boolean) => void
	}) {
		const { onMessagesInitialLoadingChange } = props
		const messagesLoading = aiChatMessagesLoadingMock.loading

		// Mirror production: report the initial messages loading barrier after commit.
		useLayoutEffect(() => {
			onMessagesInitialLoadingChange?.(messagesLoading)
		}, [onMessagesInitialLoadingChange, messagesLoading])

		return (
			<div>
				<div data-testid="recording-detail-message-header" />
				<button type="button" onClick={props.onToggleHistoryPanel}>
					toggle history
				</button>
				<div
					data-testid="recording-detail-ai-chat"
					data-recording-sync={String(props.useRecordingSync)}
					data-project-detail-mode={String(props.projectDetailMode)}
					data-allow-recording-mode={String(props.allowRecordingMode)}
					data-collapsed={String(props.isConversationPanelCollapsed)}
				/>
				<button type="button" onClick={props.onToggleConversationPanel}>
					toggle conversation
				</button>
				<button type="button" onClick={props.onExpandConversationPanel}>
					expand conversation
				</button>
			</div>
		)
	}

	return {
		default: MockRecordingDetailAiChat,
	}
})

vi.mock("@/pages/superMagic/components/TopicMode/useCreateTopicListener", () => ({
	useCreateTopicListener: createTopicListenerMock,
}))

vi.mock("@/pages/superMagic/hooks/useRefreshTopicDetailOnTaskComplete", () => ({
	useRefreshTopicDetailOnTaskComplete: refreshTopicDetailMock,
}))

vi.mock("@/pages/superMagic/components/MessageHeader", () => ({
	default: (props: { onToggleHistoryPanel: () => void; onClick?: () => void }) => {
		messageHeaderMock(props)
		return (
			<div data-testid="recording-detail-message-header">
				<button type="button" onClick={props.onToggleHistoryPanel}>
					toggle history
				</button>
			</div>
		)
	},
	MessageHeaderTopicHistoryPanel: (props: unknown) => {
		historyPanelMock(props)
		return <div data-testid="recording-detail-history-panel" />
	},
}))

/** Builds a fictional topic so the focused panel test never uses production identifiers. */
function createTopic() {
	return {
		id: "mock-topic-001",
		user_id: "mock-user-001",
		chat_topic_id: "mock-chat-topic-001",
		chat_conversation_id: "mock-chat-conversation-001",
		topic_name: "Mock topic",
		task_status: "waiting" as const,
		task_mode: "chat",
		project_id: "mock-project-001",
		topic_mode: "chat" as const,
		updated_at: "2026-01-01T00:00:00Z",
		workspace_id: "mock-workspace-001",
	}
}

describe("RecordingDetailChatPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		aiChatMessagesLoadingMock.loading = true
	})

	it("uses the project-detail header and opens the scoped history panel", () => {
		const topicStore = new TopicStore()
		const topic = createTopic()
		topicStore.setTopics([topic])
		topicStore.setSelectedTopic(topic)
		const toggleHistory = vi.fn()
		const toggleConversation = vi.fn()
		const expandConversation = vi.fn()

		render(
			<RecordingDetailChatPanel
				isConversationPanelCollapsed={false}
				historyOpen={false}
				onToggleConversationPanel={toggleConversation}
				onExpandConversationPanel={expandConversation}
				onToggleHistory={toggleHistory}
				topicsLoading={false}
				topicStore={topicStore}
				topicActions={{} as never}
				selectedTopic={topic}
				project={{ id: "mock-project-001" } as never}
				workspace={{ id: "mock-workspace-001" } as never}
				setSelectedTopic={vi.fn()}
				projectFilesStore={{} as never}
				mentionPanelStore={{} as never}
				attachments={[]}
				attachmentList={[]}
			/>,
		)

		expect(screen.getByTestId("recording-detail-message-header")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-chat-panel")).not.toHaveClass("border")
		expect(screen.getByTestId("recording-detail-chat-panel")).toHaveClass(
			"h-full",
			"bg-sidebar",
		)
		expect(screen.getByTestId("recording-detail-ai-chat")).toHaveAttribute(
			"data-recording-sync",
			"false",
		)
		expect(screen.getByTestId("recording-detail-ai-chat")).toHaveAttribute(
			"data-project-detail-mode",
			"true",
		)
		expect(screen.getByTestId("recording-detail-ai-chat")).toHaveAttribute(
			"data-allow-recording-mode",
			"false",
		)
		expect(createTopicListenerMock).toHaveBeenCalledWith({
			enabled: true,
			selectedProject: { id: "mock-project-001" },
			topicStore,
		})
		expect(refreshTopicDetailMock).toHaveBeenCalledWith({
			selectedTopic: topic,
			onTopicDetailLoaded: topicStore.updateTopic,
		})
		fireEvent.click(screen.getByText("toggle history"))
		expect(toggleHistory).toHaveBeenCalledTimes(1)
		fireEvent.click(screen.getByText("toggle conversation"))
		expect(toggleConversation).toHaveBeenCalledTimes(1)
		fireEvent.click(screen.getByText("expand conversation"))
		expect(expandConversation).toHaveBeenCalledTimes(1)
	})

	it("writes refreshed topic details into the scoped store and follows topic changes", () => {
		const topicStore = new TopicStore()
		const topic = createTopic()
		const nextTopic = {
			...createTopic(),
			id: "mock-topic-002",
			chat_topic_id: "mock-chat-topic-002",
		}
		topicStore.setTopics([topic, nextTopic])
		topicStore.setSelectedTopic(topic)

		const { rerender } = render(
			<RecordingDetailChatPanel
				isConversationPanelCollapsed={false}
				historyOpen={false}
				onToggleConversationPanel={vi.fn()}
				onExpandConversationPanel={vi.fn()}
				onToggleHistory={vi.fn()}
				topicsLoading={false}
				topicStore={topicStore}
				topicActions={{} as never}
				selectedTopic={topic}
				project={{ id: "mock-project-001" } as never}
				workspace={{ id: "mock-workspace-001" } as never}
				setSelectedTopic={vi.fn()}
				projectFilesStore={{} as never}
				mentionPanelStore={{} as never}
				attachments={[]}
				attachmentList={[]}
			/>,
		)

		const initialRefresh = refreshTopicDetailMock.mock.calls.at(-1)?.[0]
		initialRefresh.onTopicDetailLoaded({ ...topic, task_status: "finished" })
		expect(topicStore.selectedTopic?.task_status).toBe("finished")

		rerender(
			<RecordingDetailChatPanel
				isConversationPanelCollapsed={false}
				historyOpen={false}
				onToggleConversationPanel={vi.fn()}
				onExpandConversationPanel={vi.fn()}
				onToggleHistory={vi.fn()}
				topicsLoading={false}
				topicStore={topicStore}
				topicActions={{} as never}
				selectedTopic={nextTopic}
				project={{ id: "mock-project-001" } as never}
				workspace={{ id: "mock-workspace-001" } as never}
				setSelectedTopic={vi.fn()}
				projectFilesStore={{} as never}
				mentionPanelStore={{} as never}
				attachments={[]}
				attachmentList={[]}
			/>,
		)

		expect(refreshTopicDetailMock).toHaveBeenLastCalledWith({
			selectedTopic: nextTopic,
			onTopicDetailLoaded: topicStore.updateTopic,
		})
	})

	it("keeps the project conversation mounted in the collapsed narrow state", () => {
		const topicStore = new TopicStore()
		const topic = createTopic()
		topicStore.setTopics([topic])
		topicStore.setSelectedTopic(topic)

		render(
			<RecordingDetailChatPanel
				isConversationPanelCollapsed
				historyOpen={false}
				onToggleConversationPanel={vi.fn()}
				onExpandConversationPanel={vi.fn()}
				onToggleHistory={vi.fn()}
				topicsLoading={false}
				topicStore={topicStore}
				topicActions={{} as never}
				selectedTopic={topic}
				project={{ id: "mock-project-001" } as never}
				workspace={{ id: "mock-workspace-001" } as never}
				setSelectedTopic={vi.fn()}
				projectFilesStore={{} as never}
				mentionPanelStore={{} as never}
				attachments={[]}
				attachmentList={[]}
			/>,
		)

		expect(screen.getByTestId("recording-detail-chat-panel")).toHaveAttribute(
			"data-collapsed",
			"true",
		)
		expect(screen.getByTestId("recording-detail-ai-chat")).toHaveAttribute(
			"data-collapsed",
			"true",
		)
	})

	it("renders the project-detail history panel when it is open", () => {
		const topicStore = new TopicStore()
		const topic = createTopic()
		topicStore.setTopics([topic])
		topicStore.setSelectedTopic(topic)

		render(
			<RecordingDetailChatPanel
				isConversationPanelCollapsed={false}
				historyOpen
				onToggleConversationPanel={vi.fn()}
				onExpandConversationPanel={vi.fn()}
				onToggleHistory={vi.fn()}
				topicsLoading={false}
				topicStore={topicStore}
				topicActions={{} as never}
				selectedTopic={topic}
				project={{ id: "mock-project-001" } as never}
				workspace={{ id: "mock-workspace-001" } as never}
				setSelectedTopic={vi.fn()}
				projectFilesStore={{} as never}
				mentionPanelStore={{} as never}
				attachments={[]}
				attachmentList={[]}
			/>,
		)

		expect(screen.getByTestId("recording-detail-topic-history")).toHaveStyle({
			width: `${RECORDING_CHAT_HISTORY_WIDTH}px`,
		})
		expect(screen.getByTestId("recording-detail-history-panel")).toBeInTheDocument()
		expect(historyPanelMock).toHaveBeenLastCalledWith(
			expect.objectContaining({ hideTopicTypeFilter: true }),
		)
	})

	it("keeps task completion refresh safe when no topic is selected", () => {
		const topicStore = new TopicStore()

		render(
			<RecordingDetailChatPanel
				isConversationPanelCollapsed={false}
				historyOpen={false}
				onToggleConversationPanel={vi.fn()}
				onExpandConversationPanel={vi.fn()}
				onToggleHistory={vi.fn()}
				topicsLoading={false}
				topicStore={topicStore}
				topicActions={{} as never}
				selectedTopic={null}
				project={{ id: "mock-project-001" } as never}
				workspace={{ id: "mock-workspace-001" } as never}
				setSelectedTopic={vi.fn()}
				projectFilesStore={{} as never}
				mentionPanelStore={{} as never}
				attachments={[]}
				attachmentList={[]}
			/>,
		)

		expect(refreshTopicDetailMock).toHaveBeenCalledWith({
			selectedTopic: null,
			onTopicDetailLoaded: topicStore.updateTopic,
		})
	})

	it("shows the chat skeleton while topics are loading before the project is ready", () => {
		const topicStore = new TopicStore()

		render(
			<RecordingDetailChatPanel
				isConversationPanelCollapsed={false}
				historyOpen={false}
				onToggleConversationPanel={vi.fn()}
				onExpandConversationPanel={vi.fn()}
				onToggleHistory={vi.fn()}
				topicsLoading
				topicStore={topicStore}
				topicActions={{} as never}
				selectedTopic={null}
				project={null}
				workspace={null}
				setSelectedTopic={vi.fn()}
				projectFilesStore={{} as never}
				mentionPanelStore={{} as never}
				attachments={[]}
				attachmentList={[]}
			/>,
		)

		expect(screen.getByTestId("recording-detail-chat-skeleton")).toBeInTheDocument()
		expect(screen.queryByTestId("recording-detail-ai-chat")).not.toBeInTheDocument()
	})

	it("skips the topics-loading skeleton when the conversation rail is collapsed", () => {
		const topicStore = new TopicStore()

		render(
			<RecordingDetailChatPanel
				isConversationPanelCollapsed
				historyOpen={false}
				onToggleConversationPanel={vi.fn()}
				onExpandConversationPanel={vi.fn()}
				onToggleHistory={vi.fn()}
				topicsLoading
				topicStore={topicStore}
				topicActions={{} as never}
				selectedTopic={null}
				project={null}
				workspace={null}
				setSelectedTopic={vi.fn()}
				projectFilesStore={{} as never}
				mentionPanelStore={{} as never}
				attachments={[]}
				attachmentList={[]}
			/>,
		)

		expect(screen.queryByTestId("recording-detail-chat-skeleton")).not.toBeInTheDocument()
		// Collapsed rail must not leak the topics-loading "loading" copy while the project is unresolved.
		expect(screen.queryByText("loading")).not.toBeInTheDocument()
	})

	it("keeps AiChat mounted under a messages-loading skeleton overlay", () => {
		const topicStore = new TopicStore()
		const topic = createTopic()
		topicStore.setTopics([topic])
		topicStore.setSelectedTopic(topic)

		render(
			<RecordingDetailChatPanel
				isConversationPanelCollapsed={false}
				historyOpen={false}
				onToggleConversationPanel={vi.fn()}
				onExpandConversationPanel={vi.fn()}
				onToggleHistory={vi.fn()}
				topicsLoading={false}
				topicStore={topicStore}
				topicActions={{} as never}
				selectedTopic={topic}
				project={{ id: "mock-project-001" } as never}
				workspace={{ id: "mock-workspace-001" } as never}
				setSelectedTopic={vi.fn()}
				projectFilesStore={{} as never}
				mentionPanelStore={{} as never}
				attachments={[]}
				attachmentList={[]}
			/>,
		)

		// Overlay covers the surface while hydration runs; the real chat stays mounted underneath.
		expect(screen.getByTestId("recording-detail-ai-chat")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-chat-skeleton")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-chat-skeleton-overlay")).toBeInTheDocument()
	})

	it("hides the messages-loading skeleton once AiChat reports ready", () => {
		const topicStore = new TopicStore()
		const topic = createTopic()
		topicStore.setTopics([topic])
		topicStore.setSelectedTopic(topic)

		const { rerender } = render(
			<RecordingDetailChatPanel
				isConversationPanelCollapsed={false}
				historyOpen={false}
				onToggleConversationPanel={vi.fn()}
				onExpandConversationPanel={vi.fn()}
				onToggleHistory={vi.fn()}
				topicsLoading={false}
				topicStore={topicStore}
				topicActions={{} as never}
				selectedTopic={topic}
				project={{ id: "mock-project-001" } as never}
				workspace={{ id: "mock-workspace-001" } as never}
				setSelectedTopic={vi.fn()}
				projectFilesStore={{} as never}
				mentionPanelStore={{} as never}
				attachments={[]}
				attachmentList={[]}
			/>,
		)

		expect(screen.getByTestId("recording-detail-chat-skeleton")).toBeInTheDocument()

		aiChatMessagesLoadingMock.loading = false
		rerender(
			<RecordingDetailChatPanel
				isConversationPanelCollapsed={false}
				historyOpen={false}
				onToggleConversationPanel={vi.fn()}
				onExpandConversationPanel={vi.fn()}
				onToggleHistory={vi.fn()}
				topicsLoading={false}
				topicStore={topicStore}
				topicActions={{} as never}
				selectedTopic={topic}
				project={{ id: "mock-project-001" } as never}
				workspace={{ id: "mock-workspace-001" } as never}
				setSelectedTopic={vi.fn()}
				projectFilesStore={{} as never}
				mentionPanelStore={{} as never}
				attachments={[]}
				attachmentList={[]}
			/>,
		)

		expect(screen.getByTestId("recording-detail-ai-chat")).toBeInTheDocument()
		expect(screen.queryByTestId("recording-detail-chat-skeleton")).not.toBeInTheDocument()
	})
})
