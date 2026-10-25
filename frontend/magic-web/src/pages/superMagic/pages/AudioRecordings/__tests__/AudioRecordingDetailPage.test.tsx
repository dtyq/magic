import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import AudioRecordingDetailPage from "../AudioRecordingDetailPage"
import { RouteName } from "@/routes/constants"
import { AUDIO_RECORDINGS_PAGE_SHELL_CLASS } from "../constants/page-shell"
import {
	RECORDING_CHAT_EXPANDED_WIDTH,
	RECORDING_CHAT_HISTORY_WIDTH,
} from "../components/recording-detail/recording-detail-layout"
import { RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY } from "../hooks/useRecordingDetailConversationPanelState"

const navigateMock = vi.fn()
const storageMock = vi.hoisted(() => ({
	getItem: vi.fn(() => null),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
	key: vi.fn(() => null),
	length: 0,
}))
const audioPlayerMock = vi.hoisted(() => ({
	seekTo: vi.fn(),
	playSegment: vi.fn(),
	toggle: vi.fn(),
	setPlaybackRate: vi.fn(),
}))
const locationStateMock = vi.hoisted(() => ({
	projectName: "Weekly sync",
	cardStatus: "summarized" as "summarized" | "not_summarized" | "summarizing",
	audioFileId: undefined as string | undefined,
}))
const routeParamsMock = vi.hoisted(() => ({
	projectId: "project-alpha",
}))
const shareControlsMock = vi.hoisted(() => ({
	shareManagementOpen: false,
	openManageShare: vi.fn(),
	closeManageShare: vi.fn(),
}))
const saveMediaSpeakersMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const superMagicApiMock = vi.hoisted(() => ({
	getProjectDetail: vi.fn().mockResolvedValue({
		id: "project-alpha",
		workspace_id: "workspace-alpha",
	}),
	getTopicsByProjectId: vi.fn().mockResolvedValue({ list: [], total: 0 }),
	createTopic: vi.fn().mockResolvedValue(null),
	getTopicDetail: vi.fn(),
	getWorkspaceDetail: vi.fn().mockResolvedValue(null),
	editTopic: vi.fn(),
	deleteTopic: vi.fn(),
	pinTopic: vi.fn(),
	unpinTopic: vi.fn(),
	archiveTopic: vi.fn(),
	unarchiveTopic: vi.fn(),
}))

/** Creates a synthetic topic with complete chat identifiers for detail-page tests. */
function createMockTopic(id: string, name: string) {
	return {
		id,
		topic_name: name,
		project_id: "project-alpha",
		workspace_id: "workspace-alpha",
		chat_topic_id: `chat-${id}`,
		chat_conversation_id: `conversation-${id}`,
		task_status: "finished",
		updated_at: "2026-07-01T00:00:00Z",
	}
}
vi.hoisted(() => {
	Object.defineProperty(globalThis, "localStorage", {
		value: storageMock,
		configurable: true,
	})
	Object.defineProperty(globalThis, "sessionStorage", {
		value: storageMock,
		configurable: true,
	})
})

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("react-router", async () => {
	const actual = await vi.importActual<typeof import("react-router")>("react-router")
	return {
		...actual,
		useParams: () => ({ projectId: routeParamsMock.projectId }),
		useLocation: () => ({
			state: locationStateMock,
		}),
	}
})

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => navigateMock,
}))

vi.mock("@/stores/interface", () => ({
	interfaceStore: {},
}))

vi.mock("@/apis/clients/chatWebSocket", () => ({
	default: {},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: superMagicApiMock,
}))

vi.mock("@/pages/superMagic/services/projectAttachmentsLoader", () => ({
	loadProjectAttachments: vi.fn().mockResolvedValue({ tree: [], list: [] }),
}))

vi.mock("@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime", () => ({
	useProjectAttachmentsChangeRealtime: vi.fn(),
}))

vi.mock("@dtyq/magic-admin", () => ({
	RouteName: {
		Admin: "admin",
		AdminPlatformAIModel: "admin-platform-ai-model",
	},
	PlatformPackageRoutes: {},
	AiManageRoutes: {},
	otherRoutes: [],
}))
vi.mock("@dtyq/magic-admin/components", () => ({}))
vi.mock("@dtyq/magic-admin/provider", () => ({}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({}),
	getAdminLocaleModules: () => ({}),
	loadFallbackLocale: vi.fn(),
	loadMagicFlowLocale: vi.fn(),
}))

vi.mock("@/models/config/stores/theme.store", () => ({
	themeStore: {
		theme: "light",
		setTheme: vi.fn(),
		syncDocumentDarkClass: vi.fn(),
	},
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, options?: Record<string, unknown>) => {
				const labels: Record<string, string> = {
					"detail.back": "Back",
					"detail.loading": "Loading",
					"detail.loadFailed": "Failed to load",
					"detail.untitled": "Untitled",
					"detail.transcriptCount": "Transcript {{count}} segments",
					"detail.exportSection": "Export",
					"detail.share": "Share",
					"detail.tabs.notes": "Notes",
					"detail.emptyTranscript":
						"Summarizing now. It will appear automatically when ready.",
					"detail.emptyNotes":
						"Summarizing now. It will appear automatically when ready.",
					"detail.openSpeakerSettings": "Speaker settings",
					"card.summarized": "Summarized",
					"card.notSummarized": "Not summarized",
					"card.summarizing": "Summarizing",
					"actions.cancel": "Cancel",
					"actions.confirm": "Confirm",
					"actions.deleteTitle": "Delete",
					"actions.deleteConfirmSingle": "Delete this recording?",
				}
				if (key === "detail.transcriptCount") {
					return `Transcript ${options?.count ?? 0} segments`
				}
				return labels[key] ?? key
			},
		}),
	}
})

const mockDetailData = vi.hoisted(() => ({
	loading: false,
	error: false,
	projectItem: {
		id: "project-alpha",
		project_name: "Weekly sync",
		created_at: 1710000000,
		duration: 120,
		card_status: "summarized" as const,
		current_phase: "summarizing" as const,
		phase_status: "completed" as const,
		audio_source: "recorded" as const,
		workspace_id: "group-a",
	},
	fileMap: {
		summaryFiles: [],
	},
	texts: {
		transcript: { content: "Speaker-mock says hello" },
		magicProject: { fileId: "mock-magic-project-file", content: "export default {}" },
		summary: {},
	},
	audioUrl: "https://example.test/audio.wav",
	title: "Weekly sync",
	attachmentTree: [],
	attachmentList: [],
	refresh: vi.fn(),
	mutateAudioProjectItem: vi.fn(),
}))

vi.mock("../hooks/useRecordingDetailData", () => ({
	useRecordingDetailData: () => mockDetailData,
}))

vi.mock("../hooks/useRecordingAudioPlayer", () => ({
	useRecordingAudioPlayer: () => ({
		audioRef: { current: null },
		currentTime: 0,
		duration: 120,
		playing: false,
		progress: 0,
		playbackRate: 1,
		setPlaybackRate: audioPlayerMock.setPlaybackRate,
		seekTo: audioPlayerMock.seekTo,
		playSegment: audioPlayerMock.playSegment,
		toggle: audioPlayerMock.toggle,
	}),
}))

vi.mock("../hooks/useRecordingPlayerCurrentSec", () => ({
	useRecordingPlayerCurrentSec: () => 0,
}))

vi.mock("../hooks/useRecordingDetailActions", () => ({
	useRecordingDetailActions: () => ({
		renaming: false,
		deleting: false,
		moving: false,
		summarySubmitting: false,
		downloading: false,
		exportAvailability: {
			hasAudio: true,
			hasTranscript: true,
			hasNotes: false,
			hasSummaryFiles: false,
			hasAnyExportable: true,
		},
		canGenerateSummary: false,
		renameProject: vi.fn().mockResolvedValue(true),
		deleteProject: vi.fn(),
		moveToGroup: vi.fn(),
		submitSummary: vi.fn(),
		downloadAudio: vi.fn(),
		downloadTranscript: vi.fn(),
		downloadNotes: vi.fn(),
		downloadSummaryType: vi.fn(),
		downloadAll: vi.fn(),
	}),
}))

vi.mock("../components/recording-detail/useRecordingDetailShareControls", () => ({
	useRecordingDetailShareControls: () => ({
		shareModalOpen: false,
		shareManagementOpen: shareControlsMock.shareManagementOpen,
		attachments: [],
		attachmentList: [],
		defaultSelectedFileIds: [],
		requiredFileIds: [],
		openCreateShare: vi.fn(),
		openManageShare: shareControlsMock.openManageShare,
		closeManageShare: shareControlsMock.closeManageShare,
		closeShareModal: vi.fn(),
	}),
}))

vi.mock("../components/recording-detail/RecordingShareManagementDialog", () => ({
	default: ({
		open,
		projectId,
		onClose,
	}: {
		open: boolean
		projectId: string
		onClose: () => void
	}) =>
		open ? (
			<button
				type="button"
				data-testid="recording-share-management-dialog"
				data-project-id={projectId}
				onClick={onClose}
			>
				Recording share management
			</button>
		) : null,
}))

vi.mock("../components/AudioRecordingGroupDialogs", () => ({
	AudioRecordingMoveGroupDialog: () => null,
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/media/utils", () => ({
	saveMediaSpeakersAndMagicProjectJs: saveMediaSpeakersMock,
}))

vi.mock("@/pages/superMagic/components/Share/Modal", () => ({
	default: () => null,
}))

vi.mock("react-markdown", () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/base/MagicMarkmap", () => ({
	default: () => <div data-testid="magic-markmap-mock" />,
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer", () => ({
	default: () => <div data-testid="isolated-html-mock" />,
}))

vi.mock("../components/recording-detail/RecordingDetailHeader", () => ({
	RecordingDetailHeader: ({
		title,
		onOpenProject,
	}: {
		title: string
		onOpenProject?: () => void
	}) => (
		<div data-testid="recording-detail-header">
			<h1>{title}</h1>
			<button
				type="button"
				data-testid="recording-detail-open-project"
				onClick={onOpenProject}
			>
				Open project
			</button>
		</div>
	),
}))

vi.mock("../components/recording-detail/RecordingDetailLeftColumn", () => ({
	RecordingDetailLeftColumn: ({
		onPlaySegment,
		speakerNameMap,
	}: {
		onPlaySegment: (segment: { id: string; start: number; end?: number; text: string }) => void
		speakerNameMap: Record<string, string>
	}) => (
		<div data-testid="recording-detail-left-column">
			<div data-testid="recording-detail-speaker-name">
				{speakerNameMap["Speaker-mock"] ?? "Speaker-mock"}
			</div>
			<div data-testid="recording-detail-audio-player" />
			<div
				className="flex h-full min-h-full w-full flex-1 items-center justify-center"
				data-testid="recording-detail-region-empty-slot"
			>
				<div data-testid="recording-detail-empty-noTranscript">
					Summarizing now. It will appear automatically when ready.
				</div>
			</div>
			<button
				type="button"
				data-testid="recording-detail-trigger-transcript-play"
				onClick={() =>
					onPlaySegment({
						id: "segment-1",
						start: 55,
						end: 73,
						text: "Mock transcript line",
					})
				}
			>
				Play transcript segment
			</button>
		</div>
	),
}))

vi.mock("../components/recording-detail/RecordingDetailRightPanel", () => ({
	RecordingDetailRightPanel: () => (
		<div data-testid="recording-detail-right-panel">
			<div
				className="flex h-full min-h-full w-full flex-1 items-center justify-center"
				data-testid="recording-detail-region-empty-slot"
			>
				<div data-testid="recording-detail-empty-noNotes">
					Summarizing now. It will appear automatically when ready.
				</div>
			</div>
		</div>
	),
}))

vi.mock("../components/recording-detail/RecordingDetailChatPanel", () => ({
	default: ({
		selectedTopic,
		topicActions,
		isConversationPanelCollapsed,
		historyOpen,
		onToggleConversationPanel,
		onToggleHistory,
	}: {
		selectedTopic?: { id?: string; topic_name?: string } | null
		topicActions: {
			updateTopicName: (topicId: string, topicName: string) => void
		}
		isConversationPanelCollapsed: boolean
		historyOpen: boolean
		onToggleConversationPanel: () => void
		onToggleHistory: () => void
	}) => (
		<div
			data-testid="recording-detail-chat-panel"
			data-collapsed={String(isConversationPanelCollapsed)}
			data-history-open={String(historyOpen)}
		>
			<span data-testid="recording-detail-selected-topic">{selectedTopic?.id ?? "none"}</span>
			<span data-testid="recording-detail-selected-topic-name">
				{selectedTopic?.topic_name ?? "none"}
			</span>
			<button
				type="button"
				data-testid="recording-detail-toggle-chat"
				onClick={onToggleConversationPanel}
			>
				Toggle chat
			</button>
			<button
				type="button"
				data-testid="recording-detail-toggle-history"
				onClick={onToggleHistory}
			>
				Toggle history
			</button>
			<button
				type="button"
				data-testid="recording-detail-update-topic-name"
				onClick={() => {
					if (selectedTopic?.id)
						topicActions.updateTopicName(selectedTopic.id, "Local rename")
				}}
			>
				Update topic name
			</button>
		</div>
	),
}))

vi.mock("../components/recording-detail/RecordingDetailSpeakerDialog", () => ({
	RecordingDetailSpeakerDialog: ({
		onValueChange,
		onConfirm,
	}: {
		onValueChange: (next: Record<string, string>) => void
		onConfirm: () => void
	}) => (
		<>
			<button
				type="button"
				data-testid="recording-detail-edit-speaker"
				onClick={() => onValueChange({ "Speaker-mock": "Updated speaker" })}
			>
				Edit speaker
			</button>
			<button type="button" data-testid="recording-detail-save-speakers" onClick={onConfirm}>
				Save speakers
			</button>
		</>
	),
}))

vi.mock("../components/AudioRecordingCopyDialog", () => ({
	AudioRecordingCopyDialog: () => null,
}))

vi.mock("../hooks/useAudioRecordingCopyToProject", () => ({
	useAudioRecordingCopyToProject: () => ({
		open: false,
		openDialog: vi.fn(),
		closeDialog: vi.fn(),
	}),
}))

vi.mock("@/services/audioRecordings", () => ({
	recordingGroupsService: {
		listGroups: vi.fn().mockResolvedValue({ groups: [], totalCount: 0, ungroupedCount: 0 }),
	},
	UNGROUPED_RECORDING_GROUP_ID: "ungrouped",
}))

describe("AudioRecordingDetailPage", () => {
	beforeEach(() => {
		routeParamsMock.projectId = "project-alpha"
		storageMock.getItem.mockImplementation(() => null)
		storageMock.setItem.mockReset()
		storageMock.removeItem.mockReset()
		storageMock.clear.mockReset()
		navigateMock.mockReset()
		audioPlayerMock.seekTo.mockReset()
		audioPlayerMock.playSegment.mockReset()
		audioPlayerMock.toggle.mockReset()
		audioPlayerMock.setPlaybackRate.mockReset()
		mockDetailData.refresh.mockReset()
		saveMediaSpeakersMock.mockReset()
		saveMediaSpeakersMock.mockResolvedValue(undefined)
		shareControlsMock.shareManagementOpen = false
		shareControlsMock.openManageShare.mockReset()
		shareControlsMock.closeManageShare.mockReset()
		mockDetailData.loading = false
		mockDetailData.error = false
		superMagicApiMock.getProjectDetail.mockReset()
		superMagicApiMock.getProjectDetail.mockResolvedValue({
			id: "project-alpha",
			workspace_id: "workspace-alpha",
			current_topic_id: "",
		})
		superMagicApiMock.getTopicsByProjectId.mockReset()
		superMagicApiMock.getTopicsByProjectId.mockResolvedValue({ list: [], total: 0 })
		superMagicApiMock.createTopic.mockReset()
		superMagicApiMock.createTopic.mockResolvedValue(null)
		superMagicApiMock.getTopicDetail.mockReset()
		superMagicApiMock.getWorkspaceDetail.mockReset()
		superMagicApiMock.getWorkspaceDetail.mockResolvedValue(null)
		superMagicApiMock.editTopic.mockReset()
	})

	it("renders desktop workbench layout", () => {
		render(<AudioRecordingDetailPage />)

		expect(screen.getByTestId("recording-detail-workbench")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-header")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-right-panel")).toBeInTheDocument()
	})

	it("silently refreshes after saving speaker names while keeping the local override", async () => {
		render(<AudioRecordingDetailPage />)

		fireEvent.click(screen.getByTestId("recording-detail-edit-speaker"))
		fireEvent.click(screen.getByTestId("recording-detail-save-speakers"))

		await waitFor(() => {
			expect(saveMediaSpeakersMock).toHaveBeenCalled()
			expect(mockDetailData.refresh).toHaveBeenCalledWith({ silent: true })
		})
		expect(screen.getByTestId("recording-detail-speaker-name")).toHaveTextContent(
			"Updated speaker",
		)
	})

	it("defaults the conversation rail to collapsed and persists the user's choice", () => {
		render(<AudioRecordingDetailPage />)

		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveAttribute(
			"data-collapsed",
			"true",
		)
		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveStyle({
			width: "24px",
			minWidth: "24px",
		})

		expect(
			screen.queryByTestId("recording-detail-conversation-resize-handle"),
		).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("recording-detail-toggle-chat"))
		expect(storageMock.setItem).toHaveBeenCalledWith(
			RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY,
			JSON.stringify({ collapsed: false, width: RECORDING_CHAT_EXPANDED_WIDTH }),
		)
		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveStyle({
			width: `${RECORDING_CHAT_EXPANDED_WIDTH}px`,
			minWidth: `${RECORDING_CHAT_EXPANDED_WIDTH}px`,
		})
		expect(
			screen.getByTestId("recording-detail-conversation-resize-handle"),
		).toBeInTheDocument()
		expect(
			screen.getByTestId("recording-detail-conversation-resize-handle").className,
		).toContain("-translate-x-full")
		expect(screen.getByTestId("recording-detail-chat-rail")).not.toHaveClass("overflow-hidden")
	})

	it("restores an expanded preference for the detail rail while attachments are still loading", () => {
		storageMock.getItem.mockImplementation((key: string) =>
			key === RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY ? "false" : null,
		)

		const { unmount } = render(<AudioRecordingDetailPage />)
		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveAttribute(
			"data-collapsed",
			"false",
		)
		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveStyle({
			width: `${RECORDING_CHAT_EXPANDED_WIDTH}px`,
			minWidth: `${RECORDING_CHAT_EXPANDED_WIDTH}px`,
		})
		unmount()

		mockDetailData.loading = true
		render(<AudioRecordingDetailPage />)

		// Detail attachment loading no longer swaps the chat rail for a skeleton.
		expect(screen.getByTestId("recording-detail-chat-rail")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveStyle({
			width: `${RECORDING_CHAT_EXPANDED_WIDTH}px`,
			minWidth: `${RECORDING_CHAT_EXPANDED_WIDTH}px`,
		})
		expect(screen.queryByTestId("recording-detail-chat-skeleton-rail")).not.toBeInTheDocument()
	})

	it("keeps the persisted conversation preference when switching recordings", () => {
		storageMock.getItem.mockImplementation((key: string) =>
			key === RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY ? "false" : null,
		)
		const { rerender } = render(<AudioRecordingDetailPage />)

		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveAttribute(
			"data-collapsed",
			"false",
		)
		routeParamsMock.projectId = "project-beta"
		rerender(<AudioRecordingDetailPage />)

		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveAttribute(
			"data-collapsed",
			"false",
		)
		expect(storageMock.setItem).not.toHaveBeenCalled()
	})

	it("keeps the conversation rail mounted while detail attachments load with a collapsed preference", () => {
		mockDetailData.loading = true

		render(<AudioRecordingDetailPage />)

		expect(screen.getByTestId("recording-detail-page-skeleton")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-chat-rail")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveAttribute(
			"data-collapsed",
			"true",
		)
		expect(screen.queryByTestId("recording-detail-chat-skeleton-rail")).not.toBeInTheDocument()
		expect(screen.queryByTestId("recording-detail-chat-skeleton")).not.toBeInTheDocument()
	})

	it("keeps the conversation rail mounted while detail attachments load with an expanded preference", () => {
		storageMock.getItem.mockImplementation((key: string) =>
			key === RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY ? "false" : null,
		)
		mockDetailData.loading = true

		render(<AudioRecordingDetailPage />)

		expect(screen.getByTestId("recording-detail-page-skeleton")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-chat-rail")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveAttribute(
			"data-collapsed",
			"false",
		)
		expect(screen.queryByTestId("recording-detail-chat-skeleton-rail")).not.toBeInTheDocument()
		expect(screen.queryByTestId("recording-detail-chat-skeleton")).not.toBeInTheDocument()
	})

	it("selects the project current topic and keeps it while the chat panel is collapsed", async () => {
		const firstTopic = createMockTopic("topic-first", "First topic")
		const currentTopic = createMockTopic("topic-current", "Current topic")
		superMagicApiMock.getProjectDetail.mockResolvedValue({
			id: "project-alpha",
			workspace_id: "workspace-alpha",
			current_topic_id: currentTopic.id,
		})
		superMagicApiMock.getTopicsByProjectId.mockResolvedValue({
			list: [firstTopic, currentTopic],
			total: 2,
		})

		render(<AudioRecordingDetailPage />)

		expect(await screen.findByTestId("recording-detail-selected-topic")).toHaveTextContent(
			currentTopic.id,
		)
		expect(screen.getByTestId("recording-detail-chat-panel")).toHaveAttribute(
			"data-collapsed",
			"true",
		)
		fireEvent.click(screen.getByTestId("recording-detail-toggle-chat"))
		expect(screen.getByTestId("recording-detail-chat-panel")).toHaveAttribute(
			"data-collapsed",
			"false",
		)
		fireEvent.click(screen.getByTestId("recording-detail-toggle-chat"))
		expect(screen.getByTestId("recording-detail-chat-panel")).toHaveAttribute(
			"data-collapsed",
			"true",
		)
		expect(screen.getByTestId("recording-detail-selected-topic")).toHaveTextContent(
			currentTopic.id,
		)
		expect(superMagicApiMock.getTopicsByProjectId).toHaveBeenCalledTimes(1)
	})

	it("creates and resolves a topic when the recording project has no topics", async () => {
		const createdTopic = {
			...createMockTopic("topic-created", "Created topic"),
			chat_topic_id: "",
			chat_conversation_id: "",
		}
		const resolvedTopic = createMockTopic("topic-created", "Created topic")
		superMagicApiMock.createTopic.mockResolvedValue(createdTopic)
		superMagicApiMock.getTopicDetail.mockResolvedValue(resolvedTopic)

		render(<AudioRecordingDetailPage />)

		expect(await screen.findByTestId("recording-detail-selected-topic")).toHaveTextContent(
			resolvedTopic.id,
		)
		expect(superMagicApiMock.createTopic).toHaveBeenCalledWith({
			project_id: "project-alpha",
			project_mode: undefined,
			topic_name: "",
		})
		expect(superMagicApiMock.getTopicDetail).toHaveBeenCalledWith({ id: createdTopic.id })
	})

	it("updates the scoped topic name without repeating the smart-rename API write", async () => {
		const topic = createMockTopic("topic-current", "Current topic")
		superMagicApiMock.getProjectDetail.mockResolvedValue({
			id: "project-alpha",
			workspace_id: "workspace-alpha",
			current_topic_id: topic.id,
		})
		superMagicApiMock.getTopicsByProjectId.mockResolvedValue({ list: [topic], total: 1 })

		render(<AudioRecordingDetailPage />)

		expect(await screen.findByTestId("recording-detail-selected-topic-name")).toHaveTextContent(
			"Current topic",
		)
		fireEvent.click(screen.getByTestId("recording-detail-update-topic-name"))

		expect(screen.getByTestId("recording-detail-selected-topic-name")).toHaveTextContent(
			"Local rename",
		)
		expect(superMagicApiMock.editTopic).not.toHaveBeenCalled()
	})

	it("navigates to the project route from the detail menu", () => {
		render(<AudioRecordingDetailPage />)
		fireEvent.click(screen.getByTestId("recording-detail-open-project"))

		expect(navigateMock).toHaveBeenCalledWith({
			name: RouteName.SuperWorkspaceProjectState,
			params: { projectId: "project-alpha" },
		})
	})

	it("keeps the detail card and conversation rail as sibling panels", () => {
		render(<AudioRecordingDetailPage />)

		const page = screen.getByTestId("audio-recording-detail-page")
		const detailCard = screen.getByTestId("audio-recording-detail-card")
		const chatRail = screen.getByTestId("recording-detail-chat-rail")

		expect(detailCard).toHaveClass(...AUDIO_RECORDINGS_PAGE_SHELL_CLASS.split(" "))
		expect(detailCard.parentElement).toBe(page)
		expect(chatRail.parentElement).toBe(page)
		expect(detailCard).not.toContainElement(chatRail)
		expect(chatRail).toHaveClass("h-full", "shrink-0", "bg-sidebar")
		expect(chatRail).not.toHaveClass("fixed", "shadow-2xl", "xl:static")
	})

	it("uses a persisted conversation width and keeps history at its fixed width", () => {
		storageMock.getItem.mockImplementation((key: string) =>
			key === RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY
				? JSON.stringify({ collapsed: false, width: 420 })
				: null,
		)

		render(<AudioRecordingDetailPage />)

		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveStyle({
			width: "420px",
			minWidth: "420px",
		})
		fireEvent.click(screen.getByTestId("recording-detail-toggle-history"))
		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveStyle({
			width: `${420 + RECORDING_CHAT_HISTORY_WIDTH}px`,
			minWidth: `${420 + RECORDING_CHAT_HISTORY_WIDTH}px`,
		})
	})

	it("closes topic history before collapsing to the project-detail narrow rail", () => {
		render(<AudioRecordingDetailPage />)

		// Expand the persisted default-collapsed rail before exercising history behavior.
		fireEvent.click(screen.getByTestId("recording-detail-toggle-chat"))
		fireEvent.click(screen.getByTestId("recording-detail-toggle-history"))
		expect(screen.getByTestId("recording-detail-chat-panel")).toHaveAttribute(
			"data-history-open",
			"true",
		)
		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveStyle({
			width: `${RECORDING_CHAT_EXPANDED_WIDTH + RECORDING_CHAT_HISTORY_WIDTH}px`,
		})
		fireEvent.click(screen.getByTestId("recording-detail-toggle-chat"))

		expect(screen.getByTestId("recording-detail-chat-panel")).toHaveAttribute(
			"data-history-open",
			"false",
		)
		expect(screen.getByTestId("recording-detail-chat-rail")).toHaveStyle({
			width: "24px",
			minWidth: "24px",
		})
	})

	it("shows page error state with back action", () => {
		mockDetailData.error = true

		render(<AudioRecordingDetailPage />)

		expect(screen.getByTestId("recording-detail-empty-pageError")).toBeInTheDocument()
		fireEvent.click(screen.getByText("Back"))
		expect(navigateMock).toHaveBeenCalledWith({ name: RouteName.AudioRecordings })
	})

	it("shows empty transcript state while keeping workbench layout", () => {
		render(<AudioRecordingDetailPage />)

		const transcriptEmpty = screen.getByTestId("recording-detail-empty-noTranscript")
		expect(transcriptEmpty).toBeInTheDocument()
		expect(
			transcriptEmpty.closest('[data-testid="recording-detail-region-empty-slot"]'),
		).toHaveClass("min-h-full", "items-center", "justify-center")
		expect(screen.getByTestId("recording-detail-audio-player")).toBeInTheDocument()
	})

	it("centers empty notes state inside the right panel scroll region", () => {
		render(<AudioRecordingDetailPage />)

		const notesEmpty = screen.getByTestId("recording-detail-empty-noNotes")
		expect(notesEmpty).toBeInTheDocument()
		expect(
			notesEmpty.closest('[data-testid="recording-detail-region-empty-slot"]'),
		).toHaveClass("min-h-full", "items-center", "justify-center")
	})

	it("renders the shared created-at fallback title instead of the untitled label", () => {
		mockDetailData.title = "2024/03/09 16:00 的录音"

		render(<AudioRecordingDetailPage />)

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"2024/03/09 16:00 的录音",
		)
		expect(screen.queryByText("Untitled")).toBeNull()
	})

	it("seeks with autoplay instead of previewing a single transcript segment", () => {
		render(<AudioRecordingDetailPage />)

		fireEvent.click(screen.getByTestId("recording-detail-trigger-transcript-play"))

		expect(audioPlayerMock.seekTo).toHaveBeenCalledWith(55, { autoplay: true })
		expect(audioPlayerMock.playSegment).not.toHaveBeenCalled()
	})

	it("mounts local recording share management dialog for the current project", () => {
		shareControlsMock.shareManagementOpen = true

		render(<AudioRecordingDetailPage />)

		expect(screen.getByTestId("recording-share-management-dialog")).toHaveAttribute(
			"data-project-id",
			"project-alpha",
		)

		fireEvent.click(screen.getByTestId("recording-share-management-dialog"))
		expect(shareControlsMock.closeManageShare).toHaveBeenCalled()
	})
})
