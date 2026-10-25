import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import MobileAudioRecordingDetailPage from "../index"
import type { AudioProjectListItem } from "@/types/audioProject"
import { RouteName } from "@/routes/constants"
import { toast } from "sonner"
import { SuperMagicApi } from "@/apis"

const navigateMock = vi.fn()
const saveMediaSpeakersAndMagicProjectJsMock = vi.fn()
const downloadRecordingAudioFileMock = vi.fn()
const deleteAudioRecordingProjectsMock = vi.fn()
// Mirrors the router query so tab switches can be observed the way the real page sees
// them: writing `tab=ai` and clearing it must both be visible on the next render.
const searchParamsStateRef = { current: new URLSearchParams() }
const setSearchParamsMock = vi.fn((next: URLSearchParams) => {
	searchParamsStateRef.current = new URLSearchParams(next)
})

const {
	detailDataMock,
	sourcePanelPropsMock,
	summaryPanelPropsMock,
	collectSpeakerIdsFromTextMock,
	magicPopupScrollLockCountRef,
} = vi.hoisted(() => ({
	detailDataMock: vi.fn(),
	sourcePanelPropsMock: vi.fn(),
	summaryPanelPropsMock: vi.fn(),
	collectSpeakerIdsFromTextMock: vi.fn<(text: string) => string[]>(() => []),
	magicPopupScrollLockCountRef: { current: 0 },
}))

/** Builds a fictional detail item so tests avoid any real recording identifiers. */
function createItem(overrides: Partial<AudioProjectListItem> = {}): AudioProjectListItem {
	return {
		id: "project-mobile-001",
		project_name: "Mock mobile recording",
		created_at: 1710000000,
		duration: 90,
		tags: [],
		device_id: "",
		audio_source: "recorded",
		current_phase: "merging",
		phase_status: "completed",
		card_status: "not_summarized",
		is_summarized: false,
		task_key: "task-mobile-001",
		topic_id: "topic-mobile-001",
		audio_file_id: "audio-mobile-001",
		model_id: "model-mobile-001",
		workspace_id: "workspace-mobile-001",
		...overrides,
	}
}

/** Builds a topics response the test resolves on demand so pending states stay observable. */
function createDeferredTopicsResponse() {
	let resolve!: (value: { list: unknown[] }) => void
	const promise = new Promise<{ list: unknown[] }>((innerResolve) => {
		resolve = innerResolve
	})
	return { promise, resolve }
}

vi.mock("react-router", async () => {
	const actual = await vi.importActual<typeof import("react-router")>("react-router")
	return {
		...actual,
		useParams: () => ({ projectId: "project-mobile-001" }),
		useLocation: () => ({
			state: {
				projectName: "Mock mobile recording",
				cardStatus: "not_summarized",
				audioFileId: "audio-mobile-001",
			},
		}),
	}
})

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
	return {
		...actual,
		// Keep query-state behavior isolated from a real Router while exercising the page handlers.
		useSearchParams: () => [searchParamsStateRef.current, setSearchParamsMock],
	}
})

vi.mock("@/pages/superMagic/components/ProjectPageInputContainer", () => ({
	default: (props: {
		createTopic?: () => Promise<unknown>
		onSendSuccess?: (params: { currentTopic: unknown }) => void
		allowRecordingMode?: boolean
	}) => (
		<div
			data-testid="mock-recording-ai-composer"
			data-allow-recording-mode={String(props.allowRecordingMode)}
		>
			<button
				type="button"
				onClick={async () => {
					const currentTopic = await props.createTopic?.()
					props.onSendSuccess?.({ currentTopic })
				}}
			>
				send mock question
			</button>
		</div>
	),
}))

vi.mock("@/pages/superMagicMobile/pages/ProjectPage/ProjectPageMain/ProjectTopicListView", () => ({
	// Expose the loading flag and refresh hook so tests can tell the first-load skeleton
	// apart from a pull-to-refresh that must keep the already rendered rows.
	default: (props: { loading: boolean; onRefresh: () => Promise<void> }) => (
		<div data-testid="mock-recording-topic-list" data-loading={String(props.loading)}>
			<button type="button" onClick={() => void props.onRefresh()}>
				refresh mock topics
			</button>
		</div>
	),
}))

vi.mock("@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime", () => ({
	useProjectAttachmentsChangeRealtime: vi.fn(),
}))

vi.mock("@/pages/superMagic/services/projectAttachmentsLoader", () => ({
	loadProjectAttachments: vi.fn(async () => ({ tree: [], list: [] })),
}))

vi.mock("@/stores/projectFiles", () => ({
	ProjectFilesStore: class ProjectFilesStore {
		workspaceFileTree: unknown[] = []
		workspaceFilesList: unknown[] = []
		setSelectedProject = vi.fn()
		setWorkspaceFileTree = vi.fn((tree: unknown[]) => {
			this.workspaceFileTree = tree
		})
	},
}))

vi.mock("@/stores/recordingSummary", () => ({
	default: {
		isRecordingTopic: vi.fn(() => false),
	},
}))

vi.mock("@/components/business/MentionPanel/builtin-store", () => ({
	createMentionPanelStore: () => ({
		initLoadAttachments: vi.fn(),
		finishLoadAttachmentsPromise: vi.fn(),
	}),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getTopicsByProjectId: vi.fn(async () => ({ list: [] })),
		getProjectDetail: vi.fn(async () => ({
			id: "project-mobile-001",
			workspace_id: "workspace-mobile-001",
		})),
		getWorkspaceDetail: vi.fn(async () => ({ id: "workspace-mobile-001" })),
		createTopic: vi.fn(),
		getTopicDetail: vi.fn(),
		pinTopic: vi.fn(),
		unpinTopic: vi.fn(),
		deleteTopic: vi.fn(),
		editTopic: vi.fn(),
		archiveTopic: vi.fn(),
		unarchiveTopic: vi.fn(),
	},
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => navigateMock,
}))

vi.mock("@/models/config/stores/theme.store", () => ({
	themeStore: {
		theme: "light",
		setTheme: vi.fn(),
		syncDocumentDarkClass: vi.fn(),
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"detail.back": "Back",
				"detail.tabs.source": "Source",
				"detail.tabs.summaryRoot": "Summary",
				"detail.tabs.ai": "Ask AI",
				"detail.topicListTitle": "Topics",
				"detail.newTopic": "New topic",
				"detail.share": "Share",
				"detail.shareAndExport": "Share & Export",
				"detail.shareSection": "Share",
				"detail.shareLink": "Share link",
				"detail.exportSection": "Export files",
				"detail.exportRecording": "Recording",
				"detail.exportTranscript": "Transcript",
				"detail.exportNotes": "Notes",
				"detail.exportSummary": "Summary",
				"detail.exportUnavailable": "Only original recording export is available right now",
				"card.moreActions": "More actions",
				"card.rename": "Rename",
				"detail.loading": "Loading",
				"detail.loadFailed": "Load failed",
				"detail.untitled": "Untitled",
				"detail.summarizing": "Generating summary...",
				"detail.summarizingHint":
					"Summarizing now. It will appear automatically when ready.",
				"detail.notSummarized": "No summary yet",
				"detail.notSummarizedHint": "Generate a summary to preview it here",
				"actions.renameTitle": "Rename title",
				"actions.renameLabel": "Rename label",
				"actions.renamePlaceholder": "Rename placeholder",
				"actions.cancel": "Cancel",
				"actions.confirm": "Confirm",
				"detail.speakerSettingsTitle": "Speaker settings",
				"detail.speakerSettingsHint": "Speaker settings hint",
				"detail.speakerSettingsCancel": "Close speaker settings",
				"detail.speakerSettingsSave": "Save speaker settings",
				"detail.speakerLabel": `Speaker {{label}}`,
			}
			return labels[key] ?? key
		},
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({}),
	getAdminLocaleModules: () => ({}),
	loadFallbackLocale: vi.fn(),
	loadMagicFlowLocale: vi.fn(),
}))

vi.mock("@/services/audioRecordings", () => ({
	recordingGroupsService: {
		listGroups: vi.fn().mockResolvedValue({
			groups: [],
			ungroupedCount: 0,
			totalCount: 0,
		}),
	},
	UNGROUPED_RECORDING_GROUP_ID: "ungrouped-group",
}))

vi.mock("../hooks/useMobileRecordingDetailData", () => ({
	useMobileRecordingDetailData: (...args: unknown[]) => detailDataMock(...args),
}))

vi.mock("../hooks/useMobileRecordingAudioPlayer", () => ({
	useMobileRecordingAudioPlayer: () => ({
		audioRef: { current: null },
		currentTime: 0,
		duration: 90,
		progress: 0,
		playing: false,
		playbackRate: 1,
		setPlaybackRate: vi.fn(),
		toggle: vi.fn(),
		seekTo: vi.fn(),
		playSegment: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingPlayerCurrentSec", () => ({
	useRecordingPlayerCurrentSec: () => 0,
}))

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		info: vi.fn(),
		success: vi.fn(),
	},
}))

vi.mock("@/components/base-mobile/MagicPopup", async () => {
	const React = await import("react")

	/** Lightweight MagicPopup stand-in that avoids Vaul drawer side effects in jsdom. */
	function MockMagicPopup({
		children,
		visible,
		headerTitle,
		headerLeadingAction,
		headerTrailingAction,
		"data-testid": dataTestId,
	}: {
		children?: React.ReactNode
		visible?: boolean
		headerTitle?: React.ReactNode
		headerLeadingAction?: {
			ariaLabel: string
			onClick: () => void
			disabled?: boolean
			testId?: string
		}
		headerTrailingAction?: {
			ariaLabel: string
			onClick: () => void
			disabled?: boolean
			testId?: string
		}
		"data-testid"?: string
	}) {
		React.useEffect(() => {
			if (!visible) return undefined

			magicPopupScrollLockCountRef.current += 1
			document.body.setAttribute("data-scroll-locked", "1")

			return () => {
				magicPopupScrollLockCountRef.current = Math.max(
					0,
					magicPopupScrollLockCountRef.current - 1,
				)
				if (magicPopupScrollLockCountRef.current === 0) {
					document.body.removeAttribute("data-scroll-locked")
				}
			}
		}, [visible])

		if (!visible) return null

		return (
			<div data-testid={dataTestId ?? "mock-magic-popup"}>
				{headerTitle ? <div>{headerTitle}</div> : null}
				{headerLeadingAction ? (
					<button
						type="button"
						data-testid={headerLeadingAction.testId}
						aria-label={headerLeadingAction.ariaLabel}
						disabled={headerLeadingAction.disabled}
						onClick={headerLeadingAction.onClick}
					>
						{headerLeadingAction.ariaLabel}
					</button>
				) : null}
				{headerTrailingAction ? (
					<button
						type="button"
						data-testid={headerTrailingAction.testId}
						aria-label={headerTrailingAction.ariaLabel}
						disabled={headerTrailingAction.disabled}
						onClick={headerTrailingAction.onClick}
					>
						{headerTrailingAction.ariaLabel}
					</button>
				) : null}
				{children}
			</div>
		)
	}

	return { default: MockMagicPopup }
})

vi.mock(
	"@/pages/superMagicMobile/pages/AudioRecordingEntry/components/MobileRecordingMoreSheet",
	async () => {
		const React = await import("react")

		/** Stubs the shared more-actions sheet so the page test never mounts real Vaul drawers. */
		function MockMobileRecordingMoreSheet({
			isOpen,
			onOpenProject,
			onShare,
			onDelete,
			item,
		}: {
			isOpen: boolean
			onOpenProject?: (item: AudioProjectListItem) => void
			onShare?: () => void
			onDelete?: (projectId: string) => Promise<boolean>
			item?: AudioProjectListItem | null
		}) {
			const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)

			React.useEffect(() => {
				if (!isOpen) {
					setShowDeleteConfirm(false)
					return undefined
				}

				magicPopupScrollLockCountRef.current += 1
				document.body.setAttribute("data-scroll-locked", "1")

				return () => {
					magicPopupScrollLockCountRef.current = Math.max(
						0,
						magicPopupScrollLockCountRef.current - 1,
					)
					if (magicPopupScrollLockCountRef.current === 0) {
						document.body.removeAttribute("data-scroll-locked")
					}
				}
			}, [isOpen])

			if (!isOpen) return null

			return (
				<div data-testid="mobile-recording-more-sheet">
					<button
						type="button"
						data-testid="mobile-recording-more-open-project"
						onClick={() => item && onOpenProject?.(item)}
					>
						Open project
					</button>
					<button
						type="button"
						data-testid="mobile-recording-more-share"
						onClick={onShare}
					>
						Share
					</button>
					{showDeleteConfirm ? (
						<button
							type="button"
							data-testid="mobile-recording-delete-confirm"
							onClick={() => {
								void onDelete?.(item?.id ?? "")
							}}
						>
							Confirm delete
						</button>
					) : (
						<button
							type="button"
							data-testid="mobile-recording-more-delete"
							onClick={() => setShowDeleteConfirm(true)}
						>
							Delete
						</button>
					)}
				</div>
			)
		}

		return { MobileRecordingMoreSheet: MockMobileRecordingMoreSheet }
	},
)

vi.mock(
	"@/pages/superMagicMobile/pages/AudioRecordingEntry/components/MobileRecordingMoveGroupSheet",
	() => ({
		MobileRecordingMoveGroupSheet: () => null,
	}),
)

vi.mock("@/pages/superMagic/pages/AudioRecordings/hooks/useAudioRecordingCopyToProject", () => ({
	useAudioRecordingCopyToProject: () => ({
		openCopyToProject: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/components/AudioRecordingCopyDialog", () => ({
	AudioRecordingCopyDialog: () => null,
}))

vi.mock("../components/MobileRecordingAudioPlayer", () => ({
	MobileRecordingAudioPlayer: () => <div data-testid="mobile-recording-audio-player" />,
}))

vi.mock("@/pages/superMagicMobile/components/ProjectShareSheet", () => ({
	__esModule: true,
	default: ({ open }: { open: boolean }) =>
		open ? <div data-testid="mobile-recording-project-share-sheet" /> : null,
}))

vi.mock("../components/MobileRecordingShareExportSheet", () => ({
	MobileRecordingShareExportSheet: ({
		open,
		fileMap,
		onShareLink,
		onDownloadRecording,
	}: {
		open: boolean
		fileMap: unknown
		onShareLink: () => void
		onDownloadRecording: () => void
	}) =>
		open ? (
			<div data-testid="mobile-recording-share-export-sheet">
				<span data-testid="file-map">{JSON.stringify(fileMap)}</span>
				<button
					type="button"
					data-testid="mobile-recording-share-link"
					onClick={onShareLink}
				>
					Share link
				</button>
				<button
					type="button"
					data-testid="mobile-recording-export-recording"
					onClick={onDownloadRecording}
				>
					Recording
				</button>
			</div>
		) : null,
}))

vi.mock("../components/MobileRecordingSourcePanel", () => ({
	MobileRecordingSourcePanel: (props: Record<string, unknown>) => {
		sourcePanelPropsMock(props)
		return (
			<div data-testid="mobile-recording-source-panel">
				<button
					type="button"
					data-testid="open-speaker-settings"
					onClick={() => (props.onOpenSpeakerSettings as () => void)?.()}
				>
					Open speaker settings
				</button>
			</div>
		)
	},
}))

vi.mock("../components/MobileRecordingSummaryPanel", () => ({
	MobileRecordingSummaryPanel: (props: Record<string, unknown>) => {
		summaryPanelPropsMock(props)
		return <div data-testid="mobile-recording-summary-panel" />
	},
}))

vi.mock("../utils/markdown-time-links", () => ({
	collectSpeakerIdsFromText: (text: string) => collectSpeakerIdsFromTextMock(text),
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/media/utils", () => ({
	saveMediaSpeakersAndMagicProjectJs: (...args: unknown[]) =>
		saveMediaSpeakersAndMagicProjectJsMock(...args),
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/utils/download-recording-audio", () => ({
	downloadRecordingAudioFile: (...args: unknown[]) => downloadRecordingAudioFileMock(...args),
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/utils/audio-recording-actions", () => ({
	buildOptimisticSummarizingProject: (item: AudioProjectListItem) => ({
		...item,
		card_status: "summarizing",
		current_phase: "summarizing",
		phase_status: "in_progress",
	}),
	deleteAudioRecordingProjects: (...args: unknown[]) => deleteAudioRecordingProjectsMock(...args),
	moveAudioRecordingProjects: vi.fn().mockResolvedValue(undefined),
	renameAudioRecordingProject: vi.fn().mockResolvedValue(undefined),
	submitAudioRecordingSummary: vi.fn().mockResolvedValue({ ok: true }),
}))

describe("MobileAudioRecordingDetailPage", () => {
	beforeEach(() => {
		magicPopupScrollLockCountRef.current = 0
		document.body.removeAttribute("data-scroll-locked")
		navigateMock.mockReset()
		searchParamsStateRef.current = new URLSearchParams()
		setSearchParamsMock.mockClear()
		deleteAudioRecordingProjectsMock.mockReset()
		deleteAudioRecordingProjectsMock.mockResolvedValue(undefined)
		saveMediaSpeakersAndMagicProjectJsMock.mockReset()
		saveMediaSpeakersAndMagicProjectJsMock.mockResolvedValue(undefined)
		sourcePanelPropsMock.mockReset()
		summaryPanelPropsMock.mockReset()
		collectSpeakerIdsFromTextMock.mockReset()
		collectSpeakerIdsFromTextMock.mockReturnValue([])
		downloadRecordingAudioFileMock.mockReset()
		downloadRecordingAudioFileMock.mockResolvedValue(true)
		vi.mocked(SuperMagicApi.createTopic).mockReset()
		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue({
			id: "topic-mobile-created",
			project_id: "project-mobile-001",
			workspace_id: "workspace-mobile-001",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockReset()
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)
		vi.mocked(SuperMagicApi.getTopicDetail).mockReset()
		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue({
			id: "topic-mobile-created",
			project_id: "project-mobile-001",
			workspace_id: "workspace-mobile-001",
			chat_topic_id: "chat-topic-mobile-created",
			chat_conversation_id: "chat-conversation-mobile-created",
		} as never)
		vi.mocked(toast.info).mockReset()
		detailDataMock.mockReturnValue({
			loading: false,
			error: false,
			projectItem: createItem(),
			mutateAudioProjectItem: vi.fn(),
			fileMap: {
				audio: { file_id: "audio-mobile-001", file_name: "recording-mock.mp3" },
				summaryFiles: [{ type: "summary", fileId: "summary-file", fileName: "summary.md" }],
				magicProject: { file_id: "magic-project-file-001" },
				magicProjectConfig: {
					files: { notes: "notes/mock-notes.md" },
					metadata: { speakers: { "Speaker-1": "Saved Host" } },
				},
			},
			texts: {
				transcript: { fileId: "transcript-file", content: "Transcript mock" },
				notes: { fileId: "notes-file", content: "Notes mock" },
				magicProject: {
					fileId: "magic-project-file-001",
					content: "window.magicProjectConfig = { metadata: { speakers: {} } }",
				},
				summary: {
					summary: { fileId: "summary-file", content: "Summary mock" },
				},
			},
			audioUrl: "https://example.invalid/audio-mock.mp3",
			title: "Mock mobile recording",
			attachmentTree: [],
			attachmentList: [],
		})
	})

	it("renders the source panel by default for unsummarized recordings", () => {
		collectSpeakerIdsFromTextMock.mockReturnValue(["Speaker-1"])

		render(<MobileAudioRecordingDetailPage />)

		expect(screen.getByTestId("mobile-recording-source-panel")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-recording-summary-panel")).toBeNull()
		expect(sourcePanelPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				availableSpeakerIds: ["Speaker-1"],
				scrollPaddingBottom: expect.any(String),
				selectedSpeakerIds: ["Speaker-1"],
				transcriptContent: "Transcript mock",
				notesContent: "Notes mock",
				showNotesTab: true,
			}),
		)
	})

	it("hides notes when the bundle config does not declare them", () => {
		const detailData = detailDataMock()
		detailDataMock.mockReturnValue({
			...detailData,
			fileMap: {
				...detailData.fileMap,
				magicProjectConfig: { metadata: { speakers: {} } },
			},
		})

		render(<MobileAudioRecordingDetailPage />)

		expect(sourcePanelPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({ showNotesTab: false }),
		)
	})

	it("switches to the summary panel and passes the loaded summary files", () => {
		detailDataMock.mockReturnValue({
			loading: false,
			error: false,
			mutateAudioProjectItem: vi.fn(),
			projectItem: createItem({
				card_status: "summarized",
				current_phase: "summarizing",
				phase_status: "completed",
			}),
			fileMap: {
				summaryFiles: [{ type: "summary", fileId: "summary-file", fileName: "summary.md" }],
			},
			texts: {
				transcript: { fileId: "transcript-file", content: "Transcript mock" },
				notes: { fileId: "notes-file", content: "Notes mock" },
				summary: {
					summary: { fileId: "summary-file", content: "Summary mock" },
				},
			},
			audioUrl: "https://example.invalid/audio-mock.mp3",
			title: "Mock mobile recording",
			attachmentList: [],
		})

		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByText("Summary"))

		expect(screen.getByTestId("mobile-recording-summary-panel")).toBeInTheDocument()
		expect(summaryPanelPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				attachmentList: expect.any(Array),
				scrollPaddingBottom: expect.any(String),
				summaryFiles: [
					expect.objectContaining({
						type: "summary",
					}),
				],
			}),
		)
	})

	it("opens the Ask AI tab, preserves it in the query, and hides the player", async () => {
		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByText("Ask AI"))

		expect(setSearchParamsMock).toHaveBeenCalledWith(expect.any(URLSearchParams), {
			replace: true,
		})
		const nextParams = setSearchParamsMock.mock.calls.at(-1)?.[0] as URLSearchParams
		expect(nextParams.get("tab")).toBe("ai")
		expect(screen.getByTestId("mobile-recording-detail-ai")).toBeInTheDocument()
		expect(screen.getByTestId("mock-recording-topic-list")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-recording-audio-player")).toBeNull()
		expect(screen.queryByText("Topics")).toBeNull()
		expect(screen.queryByText("New topic")).toBeNull()
		expect(screen.queryByRole("button", { name: "topicTypeFilter.label" })).toBeNull()

		const topicsContainer = screen.getByTestId("mobile-recording-detail-ai-topics")
		expect(topicsContainer.className).toContain("px-3")
		expect(topicsContainer.className).toContain("pt-2")
		expect(screen.getByTestId("mobile-recording-detail-ai").className).toContain(
			"bg-mobile-background",
		)

		await waitFor(() => {
			expect(screen.getByTestId("mock-recording-ai-composer")).toBeInTheDocument()
		})
		// Detail Ask AI must stay in text-editing mode even for the recording-summary agent.
		expect(screen.getByTestId("mock-recording-ai-composer")).toHaveAttribute(
			"data-allow-recording-mode",
			"false",
		)
		const composerContainer = screen.getByTestId("mobile-recording-detail-ai-composer")
		expect(composerContainer.className).not.toContain("mt-4")
		expect(composerContainer.className).not.toContain("pt-2")
		expect(composerContainer.className).toContain("bg-mobile-background")
		expect(composerContainer.className).not.toContain("data-testid=mobile-composer")
	})

	it("shows the topic skeleton only while the first Ask AI load has no topics yet", async () => {
		// Hold the first request open so the pending first load can be observed.
		const firstLoad = createDeferredTopicsResponse()
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockReturnValueOnce(
			firstLoad.promise as never,
		)

		render(<MobileAudioRecordingDetailPage />)
		fireEvent.click(screen.getByText("Ask AI"))

		expect(screen.getByTestId("mock-recording-topic-list").dataset.loading).toBe("true")

		await act(async () => {
			firstLoad.resolve({ list: [{ id: "topic-mobile-001", topic_name: "Mock topic" }] })
		})

		expect(screen.getByTestId("mock-recording-topic-list").dataset.loading).toBe("false")
	})

	it("keeps the topic list rendered while pull-to-refresh reloads the Ask AI topics", async () => {
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [{ id: "topic-mobile-001", topic_name: "Mock topic" }],
		} as never)

		render(<MobileAudioRecordingDetailPage />)
		fireEvent.click(screen.getByText("Ask AI"))

		await waitFor(() => {
			expect(screen.getByTestId("mock-recording-topic-list").dataset.loading).toBe("false")
		})

		// Keep the refresh request pending so the skeleton would be visible if the refresh
		// path still reused the first-load flag.
		const refreshLoad = createDeferredTopicsResponse()
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockReturnValueOnce(
			refreshLoad.promise as never,
		)

		fireEvent.click(screen.getByText("refresh mock topics"))

		expect(screen.getByTestId("mock-recording-topic-list").dataset.loading).toBe("false")

		await act(async () => {
			refreshLoad.resolve({
				list: [{ id: "topic-mobile-002", topic_name: "Refreshed topic" }],
			})
		})

		expect(screen.getByTestId("mock-recording-topic-list").dataset.loading).toBe("false")
		expect(vi.mocked(SuperMagicApi.getTopicsByProjectId)).toHaveBeenCalledTimes(2)
	})

	it("keeps the summary tab active when leaving Ask AI on an unsummarized recording", () => {
		// The default tab of an unsummarized recording is Source, so clearing `tab=ai`
		// must not silently restore that default over the user's Summary choice.
		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByText("Ask AI"))
		expect(screen.getByTestId("mobile-recording-detail-ai")).toBeInTheDocument()

		fireEvent.click(screen.getByText("Summary"))

		expect(searchParamsStateRef.current.get("tab")).toBeNull()
		// An unsummarized recording renders the summary placeholder, which still proves
		// the Summary tab stayed active instead of falling back to Source.
		expect(screen.getByTestId("mobile-recording-summary-placeholder")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-recording-source-panel")).toBeNull()
		expect(screen.queryByTestId("mobile-recording-detail-ai")).toBeNull()
	})

	it("creates a topic for a direct AI question and navigates into that topic", async () => {
		render(<MobileAudioRecordingDetailPage />)
		fireEvent.click(screen.getByText("Ask AI"))

		await waitFor(() => {
			expect(screen.getByTestId("mock-recording-ai-composer")).toBeInTheDocument()
		})
		fireEvent.click(screen.getByText("send mock question"))

		await waitFor(() => {
			expect(navigateMock).toHaveBeenCalledWith({
				name: RouteName.SuperWorkspaceProjectTopicState,
				params: { projectId: "project-mobile-001", topicId: "topic-mobile-created" },
			})
		})
		expect(SuperMagicApi.createTopic).toHaveBeenCalled()
	})

	it("keeps the summary tab active when a summary time chip starts playback", () => {
		detailDataMock.mockReturnValue({
			loading: false,
			error: false,
			mutateAudioProjectItem: vi.fn(),
			projectItem: createItem({
				card_status: "summarized",
				current_phase: "summarizing",
				phase_status: "completed",
			}),
			fileMap: {
				summaryFiles: [{ type: "summary", fileId: "summary-file", fileName: "summary.md" }],
			},
			texts: {
				transcript: { fileId: "transcript-file", content: "Transcript mock" },
				notes: { fileId: "notes-file", content: "Notes mock" },
				summary: {
					summary: { fileId: "summary-file", content: "Summary mock" },
				},
			},
			audioUrl: "https://example.invalid/audio-mock.mp3",
			title: "Mock mobile recording",
		})

		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByText("Summary"))
		const latestSummaryPanelProps = summaryPanelPropsMock.mock.calls.at(-1)?.[0] as
			| {
					onTimeClick?: (start: number, end?: number) => void
			  }
			| undefined

		act(() => {
			latestSummaryPanelProps?.onTimeClick?.(12, 24)
		})

		expect(screen.getByTestId("mobile-recording-summary-panel")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-recording-source-panel")).toBeNull()
	})

	it("shows the summarizing placeholder when summary is not ready yet", () => {
		detailDataMock.mockReturnValue({
			loading: false,
			error: false,
			mutateAudioProjectItem: vi.fn(),
			projectItem: createItem({
				card_status: "summarizing",
				current_phase: "summarizing",
				phase_status: "in_progress",
			}),
			fileMap: { summaryFiles: [] },
			texts: { transcript: undefined, notes: undefined, summary: {} },
			audioUrl: "",
			title: "Mock mobile recording",
		})

		render(<MobileAudioRecordingDetailPage />)
		fireEvent.click(screen.getByText("Summary"))

		expect(screen.getByTestId("mobile-recording-summary-placeholder")).toBeInTheDocument()
		expect(
			screen.getByText("Summarizing now. It will appear automatically when ready."),
		).toBeInTheDocument()
		expect(screen.queryByText("Generating summary...")).toBeNull()
	})

	it("navigates back to the recordings list", () => {
		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByLabelText("Back"))

		expect(navigateMock).toHaveBeenCalledWith({ name: RouteName.AudioRecordings })
	})

	it("uses the shared mobile header button and keeps only the more action", () => {
		render(<MobileAudioRecordingDetailPage />)

		const backButton = screen.getByLabelText("Back")
		const moreButton = screen.getByLabelText("More actions")

		// Lock the header geometry to one 48px action target and keep share inside the menu.
		expect(backButton.className).toContain("mobile-page-header-btn")
		expect(moreButton.className).toContain("h-12 w-12")
		expect(screen.queryByLabelText("Share")).toBeNull()

		expect(backButton.querySelector("svg")?.getAttribute("class")).toContain("size-[22px]")
		expect(moreButton.querySelector("svg")?.getAttribute("class")).toContain("size-[22px]")
	})

	it("keeps all recording detail tabs on one line inside the mobile header", () => {
		render(<MobileAudioRecordingDetailPage />)

		const sourceTab = screen.getByRole("button", { name: "Source" })
		const summaryTab = screen.getByRole("button", { name: "Summary" })
		const askAiTab = screen.getByRole("button", { name: "Ask AI" })

		// Verify compact content-sized tabs keep localized labels on one line without forcing equal widths.
		expect(sourceTab.className).toContain("whitespace-nowrap")
		expect(summaryTab.className).toContain("whitespace-nowrap")
		expect(askAiTab.className).toContain("whitespace-nowrap")
		expect(sourceTab.parentElement?.className).toContain("w-max")
		expect(sourceTab.parentElement?.className).toContain("max-w-full")
		expect(sourceTab.parentElement?.parentElement?.className).toContain("left-[66px]")
		expect(sourceTab.parentElement?.parentElement?.className).toContain("right-[66px]")
	})

	it("opens the share & export sheet from the more-actions share entry", async () => {
		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByLabelText("More actions"))
		fireEvent.click(await screen.findByTestId("mobile-recording-more-share"))

		expect(await screen.findByTestId("mobile-recording-share-export-sheet")).toBeInTheDocument()
	})

	it("opens the existing project-share sheet from the share & export launcher", async () => {
		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByLabelText("More actions"))
		fireEvent.click(await screen.findByTestId("mobile-recording-more-share"))
		fireEvent.click(await screen.findByTestId("mobile-recording-share-link"))

		expect(
			await screen.findByTestId("mobile-recording-project-share-sheet"),
		).toBeInTheDocument()
	})

	it("downloads the original recording from the share & export launcher", async () => {
		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByLabelText("More actions"))
		fireEvent.click(await screen.findByTestId("mobile-recording-more-share"))
		fireEvent.click(await screen.findByTestId("mobile-recording-export-recording"))

		await waitFor(() => {
			expect(downloadRecordingAudioFileMock).toHaveBeenCalledWith({
				fileId: "audio-mobile-001",
				audioFile: { file_id: "audio-mobile-001", file_name: "recording-mock.mp3" },
				fallbackName: "Mock mobile recording",
			})
		})
	})

	it("passes fileMap to the share-export sheet", async () => {
		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByLabelText("More actions"))
		fireEvent.click(await screen.findByTestId("mobile-recording-more-share"))
		expect(await screen.findByTestId("mobile-recording-share-export-sheet")).toBeInTheDocument()
		expect(screen.getByTestId("file-map")).not.toBeEmptyDOMElement()
	})

	it("opens the more-actions sheet even when the project query has not recovered the detail item yet", async () => {
		detailDataMock.mockReturnValue({
			loading: false,
			error: false,
			mutateAudioProjectItem: vi.fn(),
			projectItem: null,
			fileMap: {
				summaryFiles: [],
				magicProject: { file_id: "magic-project-file-001" },
				magicProjectConfig: { metadata: { speakers: {} } },
			},
			texts: { transcript: undefined, notes: undefined, summary: {} },
			audioUrl: "",
			title: "Recovered title",
		})

		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByLabelText("More actions"))

		await waitFor(() => {
			expect(document.body).toHaveAttribute("data-scroll-locked", "1")
		})
	})

	it("navigates to the recording project from mobile more actions", async () => {
		render(<MobileAudioRecordingDetailPage />)
		fireEvent.click(screen.getByLabelText("More actions"))
		fireEvent.click(await screen.findByTestId("mobile-recording-more-open-project"))

		expect(navigateMock).toHaveBeenCalledWith({
			name: RouteName.SuperWorkspaceProjectState,
			params: { projectId: "project-mobile-001" },
		})
	})

	it("prefers the recovered project name in the header over bundle metadata titles", () => {
		detailDataMock.mockReturnValue({
			loading: false,
			error: false,
			mutateAudioProjectItem: vi.fn(),
			projectItem: createItem({ project_name: "Correct project title" }),
			fileMap: {
				summaryFiles: [],
				magicProject: { file_id: "magic-project-file-001" },
				magicProjectConfig: {
					name: "Stale bundle title",
					metadata: { title: "Older html title", speakers: {} },
				},
			},
			texts: { transcript: undefined, notes: undefined, summary: {} },
			audioUrl: "",
			title: "Correct project title",
		})

		render(<MobileAudioRecordingDetailPage />)

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Correct project title")
		expect(screen.queryByText("Older html title")).toBeNull()
	})

	it("renders the shared created-at fallback title instead of the untitled label", () => {
		detailDataMock.mockReturnValue({
			loading: false,
			error: false,
			mutateAudioProjectItem: vi.fn(),
			projectItem: createItem({ project_name: "" }),
			fileMap: {
				summaryFiles: [],
				magicProject: { file_id: "magic-project-file-001" },
				magicProjectConfig: { metadata: { title: "Stale bundle title", speakers: {} } },
			},
			texts: { transcript: undefined, notes: undefined, summary: {} },
			audioUrl: "",
			title: "2024/03/09 16:00 的录音",
			attachmentTree: [],
			attachmentList: [],
		})

		render(<MobileAudioRecordingDetailPage />)

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"2024/03/09 16:00 的录音",
		)
		expect(screen.queryByText("Untitled")).toBeNull()
		expect(screen.queryByText("Stale bundle title")).toBeNull()
	})

	it("opens the speaker settings sheet with the shared action header controls", async () => {
		collectSpeakerIdsFromTextMock.mockReturnValue(["Speaker-1"])

		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByTestId("open-speaker-settings"))

		expect((await screen.findAllByText("Speaker settings")).length).toBeGreaterThan(0)
		expect(await screen.findByLabelText("Close speaker settings")).toBeInTheDocument()
		expect(await screen.findByLabelText("Save speaker settings")).toBeInTheDocument()
	})

	it("hydrates saved speaker names and persists edits when users save the sheet", async () => {
		collectSpeakerIdsFromTextMock.mockReturnValue(["Speaker-1"])

		render(<MobileAudioRecordingDetailPage />)

		await waitFor(() => {
			expect(sourcePanelPropsMock).toHaveBeenLastCalledWith(
				expect.objectContaining({
					speakerNameMap: { "Speaker-1": "Saved Host" },
				}),
			)
		})

		fireEvent.click(screen.getByTestId("open-speaker-settings"))

		const input = await screen.findByDisplayValue("Saved Host")
		fireEvent.change(input, { target: { value: "Renamed Host" } })
		fireEvent.click(await screen.findByLabelText("Save speaker settings"))

		expect(saveMediaSpeakersAndMagicProjectJsMock).toHaveBeenCalledWith({
			mediaSpeakers: { "Speaker-1": "Renamed Host" },
			magicProjectJsFileInfo: {
				fileId: "magic-project-file-001",
				content: "window.magicProjectConfig = { metadata: { speakers: {} } }",
			},
		})
		await waitFor(() => {
			expect(sourcePanelPropsMock).toHaveBeenLastCalledWith(
				expect.objectContaining({
					speakerNameMap: { "Speaker-1": "Renamed Host" },
				}),
			)
		})
	})

	it("renders the loading state without mounting the detail panels", () => {
		detailDataMock.mockReturnValue({
			loading: true,
			error: false,
			mutateAudioProjectItem: vi.fn(),
			projectItem: null,
			fileMap: null,
			texts: { summary: {} },
			audioUrl: "",
			title: "",
		})
		render(<MobileAudioRecordingDetailPage />)

		expect(screen.getByText("Loading", { exact: false })).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-recording-source-panel")).toBeNull()
		expect(screen.queryByTestId("mobile-recording-summary-panel")).toBeNull()
	})

	it("renders the error state without mounting the detail panels", () => {
		detailDataMock.mockReturnValue({
			loading: false,
			error: true,
			mutateAudioProjectItem: vi.fn(),
			projectItem: null,
			fileMap: null,
			texts: { summary: {} },
			audioUrl: "",
			title: "",
		})

		render(<MobileAudioRecordingDetailPage />)

		expect(screen.getByText("Load failed")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-recording-source-panel")).toBeNull()
		expect(screen.queryByTestId("mobile-recording-summary-panel")).toBeNull()
	})

	it("opens the share & export sheet from the more-actions sheet share button", async () => {
		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByLabelText("More actions"))
		fireEvent.click(await screen.findByTestId("mobile-recording-more-share"))

		expect(await screen.findByTestId("mobile-recording-share-export-sheet")).toBeInTheDocument()
	})

	it("passes deleted project id when navigating back to the list after delete", async () => {
		render(<MobileAudioRecordingDetailPage />)

		fireEvent.click(screen.getByLabelText("More actions"))
		fireEvent.click(await screen.findByTestId("mobile-recording-more-delete"))
		fireEvent.click(await screen.findByTestId("mobile-recording-delete-confirm"))

		await waitFor(() => {
			expect(deleteAudioRecordingProjectsMock).toHaveBeenCalledWith(["project-mobile-001"])
		})
		expect(navigateMock).toHaveBeenCalledWith({
			name: RouteName.AudioRecordings,
			state: { deletedProjectId: "project-mobile-001" },
		})
	})
})

vi.mock("@/pages/superMagic/hooks/usePaginatedTopics", () => ({
	default: () => ({
		displayTopics: [],
		total: 0,
		isLoading: false,
		error: null,
		hasMore: false,
		reload: vi.fn(),
	}),
}))
