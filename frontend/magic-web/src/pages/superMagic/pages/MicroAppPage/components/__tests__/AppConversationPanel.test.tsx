import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AppConversationPanel from "../AppConversationPanel"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

const scaffoldMocks = vi.hoisted(() => ({
	messageListProviderValue: null as Record<string, unknown> | null,
	messageHeaderProps: null as Record<string, unknown> | null,
	setSelectedDetail: undefined as ((detail: unknown) => void) | undefined,
	onFileClick: undefined as ((fileItem: unknown) => void) | undefined,
	enableRevokedUserMessageReedit: false,
	revokedEditorContext: null as Record<string, unknown> | null,
}))

const mentionInsertMocks = vi.hoisted(() => ({
	insertCurrentMicroAppMention: vi.fn(),
}))

const scopedProgressMocks = vi.hoisted(() => ({
	params: null as Record<string, unknown> | null,
}))

vi.mock("../../utils/insertCurrentMicroAppMention", () => mentionInsertMocks)

vi.mock("../../context", () => ({
	useAppStore: () => ({
		conversation: { setConversationGenerating: vi.fn() },
	}),
}))

const modelModeMocks = vi.hoisted(() => ({
	resolveMicroAppModelSelectionMode: vi.fn(() => "default"),
	resolveMicroAppRuntimeModelSelectionMode: vi.fn((mode: string) => mode),
}))

vi.mock("../../utils/microAppModelMode", () => modelModeMocks)

const topicModeMocks = vi.hoisted(() => ({
	useCreateTopicListener: vi.fn(),
}))

vi.mock("@/pages/superMagic/components/TopicMode", () => ({
	ModeToggle: () => <div data-testid="runtime-mode-toggle" />,
	useCreateTopicListener: topicModeMocks.useCreateTopicListener,
}))

vi.mock("@/pages/superMagic/components/ConversationPanelScaffold", () => ({
	default: ({
		editor,
		header,
		emptyCompact,
		messageListProviderValue,
		setSelectedDetail,
		onFileClick,
		enableRevokedUserMessageReedit,
		revokedEditorContext,
	}: {
		editor: React.ReactNode
		header: React.ReactNode
		emptyCompact: React.ReactNode
		messageListProviderValue: Record<string, unknown>
		setSelectedDetail?: (detail: unknown) => void
		onFileClick?: (fileItem: unknown) => void
		enableRevokedUserMessageReedit?: boolean
		revokedEditorContext?: Record<string, unknown>
	}) => {
		scaffoldMocks.messageListProviderValue = messageListProviderValue
		scaffoldMocks.setSelectedDetail = setSelectedDetail
		scaffoldMocks.onFileClick = onFileClick
		scaffoldMocks.enableRevokedUserMessageReedit = Boolean(enableRevokedUserMessageReedit)
		scaffoldMocks.revokedEditorContext = revokedEditorContext ?? null
		return (
			<div>
				{header}
				{emptyCompact}
				{editor}
			</div>
		)
	},
}))

vi.mock("@/pages/superMagic/components/ConversationPanelScaffold/ConversationEmptyState", () => ({
	default: ({
		icon,
		title,
		subtitle,
		testId,
	}: {
		icon: React.ReactNode
		title: React.ReactNode
		subtitle: React.ReactNode
		testId: string
	}) => (
		<div data-testid={testId}>
			{icon}
			{title}
			{subtitle}
		</div>
	),
}))

vi.mock(
	"@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer",
	() => ({
		default: ({ editorContext }: { editorContext: Record<string, unknown> }) => {
			const mergeSendParams = editorContext.mergeSendParams as
				| ((params: { defaultParams: Record<string, unknown> }) => Record<string, unknown>)
				| undefined
			const mergedParams = mergeSendParams?.({
				defaultParams: {
					topicMode: "custom_agent",
					extra: { agent_code: "stale-employee" },
				},
			})

			return (
				<div
					data-testid="web-micro-app-editor"
					data-model-topic-mode={editorContext.modelTopicMode}
					data-topic-mode={editorContext.topicMode}
					data-agent-code={editorContext.agentCode}
					data-show-mode-toggle={String(editorContext.showModeToggle)}
					data-show-topic-examples-portal={String(editorContext.showTopicExamplesPortal)}
					data-send-topic-mode={mergedParams?.topicMode}
					data-send-agent-code={
						(mergedParams?.extra as { agent_code?: string } | undefined)?.agent_code
					}
				/>
			)
		},
	}),
)

vi.mock("@/pages/superMagic/components/MessageHeader", () => ({
	default: (props: Record<string, unknown>) => {
		scaffoldMocks.messageHeaderProps = props
		return <div data-testid="message-header">{props.trailingActions as React.ReactNode}</div>
	},
}))

vi.mock("@/pages/superMagic/components/MessageList/components/MessageListFallback", () => ({
	default: () => <div data-testid="message-list-fallback" />,
}))

vi.mock("@/pages/superMagic/components/MessagePanel/components/MessageQueue", () => ({
	default: () => null,
}))

vi.mock("@/pages/superMagic/components/MessageEditor/utils/draftKey", () => ({
	createMessageEditorDraftKey: () => "micro-app-draft",
}))

vi.mock("@/pages/superMagic/services/messageSendFlowService", () => ({
	messageSendService: { sendContent: vi.fn() },
}))

vi.mock("@/pages/superMagic/services/messageSendPreparation", () => ({
	resolveMessageSendContext: () => ({}),
}))

vi.mock("@/pages/superMagic/services/topicStatusSyncService", () => ({
	applyOptimisticTopicRunningState: vi.fn(),
}))

vi.mock("@/utils/pubsub", () => ({
	default: { publish: vi.fn() },
	PubSubEvents: { Message_Scroll_To_Bottom: "Message_Scroll_To_Bottom" },
}))

vi.mock("@/pages/superMagic/hooks/useRefreshTopicDetailOnTaskComplete", () => ({
	useRefreshTopicDetailOnTaskComplete: vi.fn(),
}))

vi.mock("@/pages/superMagic/hooks/useTopicMessages", () => ({
	useTopicMessages: () => ({
		handlePullMoreMessage: vi.fn(),
		isMessagesInitialLoading: false,
		isSelectedTopicMessagesReady: true,
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

vi.mock("@/pages/superMagic/hooks/useScopedMessageHeaderTopicActions", () => ({
	useScopedMessageHeaderTopicActions: () => ({}),
}))

vi.mock("@/pages/superMagic/hooks/useTopicMode", () => ({
	default: ({ selectedTopic }: { selectedTopic?: { topic_mode?: string } }) => ({
		topicMode: selectedTopic?.topic_mode ?? "general",
		setTopicMode: vi.fn(),
		recoverTopicMode: vi.fn(),
	}),
}))

vi.mock("@/services/superMagic/DefaultAgentSelectionService", () => ({
	resolveAgentSelection: (mode: string, agentCode?: string) => ({
		agentCode: mode.startsWith("SMA") ? mode : agentCode,
	}),
}))

vi.mock("@/pages/superMagic/components/MessagePanel/hooks/useMessageQueue", () => ({
	default: () => ({
		queue: [],
		queueStats: {},
		editingQueueItem: null,
		removeFromQueue: vi.fn(),
		sendQueuedMessage: vi.fn(),
		startEditQueueItem: vi.fn(),
		cancelEditQueueItem: vi.fn(),
		addToQueue: vi.fn(),
		finishEditQueueItem: vi.fn(),
		editorRef: { current: { editor: {} } },
	}),
}))

vi.mock("@/pages/superMagic/components/MessageEditor/hooks/useTopicModel", () => ({
	default: () => ({ topicModelStore: {} }),
}))

vi.mock("@/stores/superMagic/topicModelStore", () => ({
	createSuperMagicTopicModelStore: () => ({}),
}))

vi.mock("@/models/user", () => ({
	userStore: { user: { userInfo: null } },
}))

describe("AppConversationPanel", () => {
	const mentionPanelStoreMock = { setPinnedCurrentMicroApp: vi.fn() }
	const mentionPanelStore = mentionPanelStoreMock as never

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("forwards page actions to the shared message header", () => {
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "Topic" },
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{ workspaceFileTree: [] } as never}
				trailingActions={<button data-testid="page-action">attachment</button>}
			/>,
		)

		expect(screen.getByTestId("page-action")).toBeInTheDocument()
		expect(scaffoldMocks.messageHeaderProps?.trailingActions).toBeTruthy()
		expect(scaffoldMocks.messageHeaderProps?.hideTopicListModeIcon).toBe(true)
	})

	it("uses the micro app conversation illustration and action-oriented copy", () => {
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "Topic" },
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
			/>,
		)

		const emptyState = screen.getByTestId("micro-app-conversation-empty-compact")
		expect(emptyState).toBeInTheDocument()
		expect(
			screen.getByTestId("micro-app-conversation-empty-compact-illustration"),
		).toHaveAttribute("data-state", "conversation-empty")
		expect(emptyState).toHaveTextContent("microAppPage.conversation.emptyTitle")
		expect(emptyState).toHaveTextContent("microAppPage.conversation.emptyDescription")
		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-show-topic-examples-portal",
			"false",
		)
	})

	it("uses the shared message list fallback in preview and published chats", () => {
		const topicStore = {
			selectedTopic: {
				id: "topic-1",
				topic_name: "Topic",
				topic_mode: "custom_agent",
				agent_code: "SMA123",
			},
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				lockToMicroAppMode={false}
			/>,
		)

		expect(screen.queryByTestId("micro-app-conversation-empty-compact")).not.toBeInTheDocument()
		expect(screen.getByTestId("message-list-fallback")).toBeInTheDocument()
		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-show-topic-examples-portal",
			"true",
		)
	})

	it("uses the default model catalog and locks development sends to micro-app mode", () => {
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "Topic" },
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
			/>,
		)

		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-model-topic-mode",
			"default",
		)
		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-send-topic-mode",
			"micro-app",
		)
		expect(screen.queryByTestId("runtime-mode-toggle")).not.toBeInTheDocument()
	})

	it("keeps the selected employee available in published conversations", () => {
		const topicStore = {
			selectedTopic: {
				id: "topic-1",
				topic_name: "Topic",
				topic_mode: "custom_agent",
				agent_code: "SMA123",
			},
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				lockToMicroAppMode={false}
			/>,
		)

		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-topic-mode",
			"custom_agent",
		)
		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-model-topic-mode",
			"custom_agent",
		)
		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-agent-code",
			"SMA123",
		)
		expect(modelModeMocks.resolveMicroAppRuntimeModelSelectionMode).toHaveBeenCalledWith(
			"custom_agent",
			"SMA123",
		)
		expect(screen.getByTestId("web-micro-app-editor")).not.toHaveAttribute(
			"data-send-topic-mode",
		)
		expect(screen.getByTestId("runtime-mode-toggle")).toBeInTheDocument()
		expect(scaffoldMocks.messageHeaderProps?.hideTopicListModeIcon).toBe(false)
	})

	it("falls back to the default catalog when a custom employee has no models", () => {
		modelModeMocks.resolveMicroAppRuntimeModelSelectionMode.mockReturnValueOnce("default")
		const topicStore = {
			selectedTopic: {
				id: "topic-1",
				topic_name: "Topic",
				topic_mode: "custom_agent",
				agent_code: "SMA123",
			},
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				lockToMicroAppMode={false}
			/>,
		)

		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-topic-mode",
			"custom_agent",
		)
		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-model-topic-mode",
			"default",
		)
		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-agent-code",
			"SMA123",
		)
	})

	it("binds create-topic events to the visible conversation store", () => {
		const selectedProject = { id: "runtime-project-1", project_name: "Published App" } as never
		const topicStore = {
			selectedTopic: {
				id: "topic-1",
				topic_name: "Topic",
				topic_mode: "custom_agent",
				agent_code: "SMA123",
			},
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={selectedProject}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				lockToMicroAppMode={false}
			/>,
		)

		expect(topicModeMocks.useCreateTopicListener).toHaveBeenCalledWith({
			selectedProject,
			topicStore,
		})
		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-show-mode-toggle",
			"false",
		)
	})

	it("only forces micro-app send parameters while development mode is active", () => {
		const topicStore = {
			selectedTopic: {
				id: "topic-1",
				topic_name: "Topic",
				topic_mode: "custom_agent",
				agent_code: "SMA123",
			},
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never
		const props = {
			selectedProject: { id: "project-1", project_name: "Micro App" } as never,
			topicStore,
			mentionPanelStore,
			projectFilesStore: {} as never,
		}

		const { rerender } = render(<AppConversationPanel {...props} lockToMicroAppMode />)
		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-send-topic-mode",
			"micro-app",
		)

		rerender(<AppConversationPanel {...props} lockToMicroAppMode={false} />)
		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-agent-code",
			"SMA123",
		)
		expect(screen.getByTestId("web-micro-app-editor")).not.toHaveAttribute(
			"data-send-topic-mode",
		)
		expect(screen.getByTestId("runtime-mode-toggle")).toBeInTheDocument()
		expect(scaffoldMocks.messageHeaderProps?.hideTopicListModeIcon).toBe(false)

		rerender(<AppConversationPanel {...props} lockToMicroAppMode />)
		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-send-topic-mode",
			"micro-app",
		)
		expect(screen.getByTestId("web-micro-app-editor")).not.toHaveAttribute("data-agent-code")
		expect(screen.queryByTestId("runtime-mode-toggle")).not.toBeInTheDocument()
	})

	it("stretches the runtime editor without adding a second bordered container", () => {
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "Topic" },
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
			/>,
		)

		const editorLayout = screen.getByTestId("web-micro-app-editor").parentElement
		expect(editorLayout).toHaveClass("items-stretch")
		for (const className of [
			"items-start",
			"rounded-2xl",
			"border",
			"border-border",
			"bg-sidebar",
			"p-2",
		]) {
			expect(editorLayout).not.toHaveClass(className)
		}
	})

	it("provides the project attachment store to the message list", () => {
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "Topic" },
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never
		const projectFilesStore = {
			workspaceFilesList: [{ file_id: "file-1", file_name: "index.html" }],
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={projectFilesStore}
			/>,
		)

		expect(scaffoldMocks.messageListProviderValue).toEqual(
			expect.objectContaining({ projectFilesStore }),
		)
	})

	it("enables the revoked user message editor", () => {
		const selectedProject = { id: "project-1", project_name: "Micro App" } as never
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "Topic", topic_mode: "micro-app" },
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={selectedProject}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
			/>,
		)

		expect(scaffoldMocks.enableRevokedUserMessageReedit).toBe(true)
		expect(scaffoldMocks.revokedEditorContext).toEqual(
			expect.objectContaining({
				selectedProject,
				topicMode: "micro-app",
				modelTopicMode: "default",
				agentCode: undefined,
				topicStore,
			}),
		)
		const mergeSendParams = scaffoldMocks.revokedEditorContext?.mergeSendParams as
			| ((params: { defaultParams: Record<string, unknown> }) => Record<string, unknown>)
			| undefined
		expect(
			mergeSendParams?.({
				defaultParams: {
					topicMode: "custom_agent",
					extra: { agent_code: "stale-employee", request_id: "request-1" },
				},
			}),
		).toEqual(
			expect.objectContaining({
				topicMode: "micro-app",
				extra: { request_id: "request-1" },
			}),
		)
	})

	it("removes a stale employee from development send parameters", () => {
		const topicStore = {
			selectedTopic: {
				id: "topic-1",
				topic_name: "Topic",
				topic_mode: "custom_agent",
				agent_code: "SMA123",
			},
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
			/>,
		)

		expect(screen.getByTestId("web-micro-app-editor")).toHaveAttribute(
			"data-send-topic-mode",
			"micro-app",
		)
		expect(screen.getByTestId("web-micro-app-editor")).not.toHaveAttribute(
			"data-send-agent-code",
		)
	})

	it("forwards tool details to the page preview handler", () => {
		const onSelectDetail = vi.fn()
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "Topic" },
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				onSelectDetail={onSelectDetail}
			/>,
		)

		expect(scaffoldMocks.setSelectedDetail).toBe(onSelectDetail)
	})

	it("forwards message attachment clicks to the host preview handler", () => {
		const onFileClick = vi.fn()
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "Topic" },
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				onFileClick={onFileClick}
			/>,
		)

		expect(scaffoldMocks.onFileClick).toBe(onFileClick)
	})

	it("requests an attachment refresh when the topic reaches a terminal status", () => {
		const checkAttachmentsNowDebounced = vi.fn()
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "Topic" },
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				onTerminalTopicStatusChange={checkAttachmentsNowDebounced}
			/>,
		)

		expect(scopedProgressMocks.params).toEqual(
			expect.objectContaining({
				onTerminalTopicStatusChange: checkAttachmentsNowDebounced,
			}),
		)
	})

	it("shows the mention hint and pins the current app in preview", () => {
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "Topic" },
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "runtime-project", project_name: "Published App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
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
		expect(mentionInsertMocks.insertCurrentMicroAppMention).toHaveBeenCalledWith(
			{},
			{ appId: "app-1", appName: "Todo App" },
		)
	})

	it("does not show the mention hint or pin the app in development", () => {
		const topicStore = {
			selectedTopic: { id: "topic-1", topic_name: "Topic" },
			setSelectedTopic: vi.fn(),
			updateTopic: vi.fn(),
		} as never

		render(
			<AppConversationPanel
				selectedProject={{ id: "project-1", project_name: "Micro App" } as never}
				topicStore={topicStore}
				mentionPanelStore={mentionPanelStore}
				projectFilesStore={{} as never}
				microAppId="app-1"
				microAppName="Todo App"
			/>,
		)

		expect(screen.queryByTestId("micro-app-runtime-mention-hint")).not.toBeInTheDocument()
		expect(mentionPanelStoreMock.setPinnedCurrentMicroApp).toHaveBeenCalledWith(null)
	})
})
