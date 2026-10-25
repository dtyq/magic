import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { VoiceResultUtterance } from "@/components/business/VoiceInput/services/VoiceClient/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import {
	ALL_RECORDING_GROUP_ID,
	UNGROUPED_RECORDING_GROUP_ID,
} from "@/services/audioRecordings/RecordingGroupsConstants"
import { audioRecordingsStore } from "../../stores/audio-recordings-store"
import { buildOptimisticRecordingItem } from "../../utils/build-optimistic-recording-item"
import { writeAudioRecordingsFilterSession } from "../../utils/audio-recordings-filter-session"
import { useRecordingEntryFacade } from "../useRecordingEntryFacade"
import {
	resetRecordingSettingsCacheForTests,
	seedRecordingSettingsCacheForTests,
} from "../useRecordingSettings"

const {
	runtimeMock,
	recordSummaryServiceMock,
	recordSummaryStoreMock,
	workspaceStoreMock,
	topicModelStoreMock,
	recordingTopicModelApiMock,
	summaryModelListMock,
	superMagicApiMock,
	audioRecordingsServiceMock,
	forceOverrideMock,
	importTestState,
	analyticsTrackMock,
	isMobileMock,
} = vi.hoisted(() => {
	const importTestState = {
		queuedFiles: [] as File[],
		pendingImportContext: null as {
			projectId: string
			projectName: string
			topicId: string
			workspaceId: string
			modelId: string
			taskKey: string
			autoSummaryEnabled: boolean
			onUploadStarted?: () => void
		} | null,
	}
	return {
		runtimeMock: {
			state: {
				isRecording: false,
				isPaused: false,
				duration: "00:00:00",
				isStartingRecord: false,
				currentSession: {},
			},
			actions: {
				startRecording: vi.fn(),
				finishRecording: vi.fn(),
				openCurrentRecording: vi.fn(),
				cancelRecording: vi.fn(),
			},
			WaveformComponent: () => null,
		},
		recordSummaryServiceMock: {
			ensureProjectAndTopic: vi.fn(),
			getRecordingOverrideContext: vi.fn(),
			prepareRecordingOverride: vi.fn(),
			releaseOverrideSessionForForceStart: vi.fn(),
			pauseRecording: vi.fn(),
			continueRecording: vi.fn(),
			updateNote: vi.fn(),
			enableTranscriptionForCurrentSession: vi.fn(),
			on: vi.fn(() => () => undefined),
		},
		recordSummaryStoreMock: {
			status: "init",
			isRecording: false,
			isVisible: false,
			isOtherTabRecording: false,
			floatPanel: {
				setExpanded: vi.fn(),
				setExpandedAiChat: vi.fn(),
			},
			message: [] as Array<VoiceResultUtterance & { add_time: number; id: string }>,
			note: { content: "", file_extension: "md" },
			errorState: {
				recordingError: undefined as Error | undefined,
			},
			businessData: {
				workspace: null,
				project: null,
				topic: null,
				model: null,
				audioSource: undefined,
				transcriptionEnabled: true,
			},
		},
		workspaceStoreMock: {
			selectedWorkspace: { id: "workspace-1", name: "Workspace One" },
			firstWorkspace: { id: "workspace-1", name: "Workspace One" },
		},
		topicModelStoreMock: {
			selectedLanguageModel: {
				id: "model-local-1",
				group_id: "group-1",
				model_id: "model-alpha",
				model_name: "Model Alpha",
				provider_model_id: "model-alpha",
				model_description: "Model Alpha",
				model_icon: "",
				model_status: "normal",
				sort: 1,
			},
		},
		recordingTopicModelApiMock: {
			getRecordingTopicModel: vi.fn(),
			saveRecordingTopicModel: vi.fn(),
		},
		summaryModelListMock: {
			fetchSummaryModelGroups: vi.fn(),
			resolveDefaultSummaryModelId: vi.fn(),
		},
		superMagicApiMock: {
			getWorkspaces: vi.fn(),
			getWorkspaceDetail: vi.fn(),
			createProject: vi.fn(),
			createAudioProject: vi.fn(),
			deleteProject: vi.fn(),
		},
		audioRecordingsServiceMock: {
			submitSummary: vi.fn(),
		},
		forceOverrideMock: {
			run: vi.fn(),
		},
		importTestState,
		analyticsTrackMock: vi.fn(),
		isMobileMock: vi.fn(() => false),
	}
})

const audioImportStoreMock = vi.hoisted(() => ({
	hasUploadingTasks: false,
	startAudioImport: vi.fn(
		async (
			files: File[],
			context: {
				projectId: string
				projectName: string
				topicId: string
				workspaceId: string
				modelId: string
				taskKey: string
				autoSummaryEnabled: boolean
				onUploadStarted?: () => void
			},
		) => {
			importTestState.queuedFiles = files
			importTestState.pendingImportContext = context
			context.onUploadStarted?.()
		},
	),
	cancelImport: vi.fn(),
	retryImport: vi.fn(),
}))

interface MockSaveUploadFileToProjectResponse {
	file_id: string
	file_key: string
	file_name: string
	file_size: number
	file_type: "user_upload" | "directory"
	project_id: string
	topic_id: string
	task_id: string
	created_at: string
	relative_file_path: string
}

/** Simulates audio-import-store upload completion for facade import tests */
async function completeImportUpload(saveResult: MockSaveUploadFileToProjectResponse) {
	const context = importTestState.pendingImportContext
	if (!context) return

	const completedProject = buildOptimisticRecordingItem({
		projectId: context.projectId,
		projectName: context.projectName,
		workspaceId: context.workspaceId,
		modelId: context.modelId,
		audioFileId: saveResult.file_id,
		taskKey: context.taskKey,
		audioSource: "imported",
		topicId: context.topicId,
	})
	completedProject.transferStatus = "done"
	audioRecordingsStore.addOptimisticItem(completedProject)
	await audioRecordingsServiceMock.submitSummary(completedProject, context.modelId)
}

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}))

// resolveRecordingStartupErrorContent uses i18next.t directly (not useTranslation).
vi.mock("i18next", () => {
	const chainable = {
		use: vi.fn(() => chainable),
		init: vi.fn(() => Promise.resolve()),
		changeLanguage: vi.fn(() => Promise.resolve()),
		t: (key: string) => key,
	}
	return { default: chainable }
})

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}))

vi.mock("@/components/business/RecordingSummary/internal/editorRuntime", () => ({
	useRecordingEditorRuntime: () => runtimeMock,
}))

vi.mock("@/services/recordSummary/serviceInstance", () => ({
	initializeService: () => recordSummaryServiceMock,
}))

vi.mock("@/components/business/RecordingSummary/utils/force-recording-override", () => ({
	runForceRecordingOverride: forceOverrideMock.run,
}))

vi.mock("@/stores/recordingSummary", () => ({
	default: recordSummaryStoreMock,
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	workspaceStore: workspaceStoreMock,
	projectStore: {},
	topicStore: {},
}))

vi.mock("@/stores/superMagic/topicModelStore", () => ({
	default: topicModelStoreMock,
}))

vi.mock(
	"@/pages/superMagic/pages/AudioRecordings/apis/recording-settings-api",
	() => recordingTopicModelApiMock,
)

vi.mock(
	"@/pages/superMagic/pages/AudioRecordings/utils/summary-model-list",
	() => summaryModelListMock,
)

vi.mock("@/services/audioRecordings/AudioRecordingsService", () => ({
	audioRecordingsService: audioRecordingsServiceMock,
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: superMagicApiMock,
}))

vi.mock("@/services/analytics", () => ({
	analyticsService: { report: analyticsTrackMock },
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => isMobileMock(),
}))

vi.mock("../../stores/audio-import-store", () => ({
	audioImportStore: audioImportStoreMock,
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		getModelGroupsByMode: vi.fn(() => []),
	},
}))

vi.mock("@/components/business/RecordingSummary/components/MessageList", () => ({
	default: () => null,
}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({}),
	getAdminLocaleModules: () => ({}),
	loadFallbackLocale: vi.fn(),
	loadMagicFlowLocale: vi.fn(),
}))

function createFileList(files: File[]): FileList {
	return {
		length: files.length,
		item: (index: number) => files[index] ?? null,
		...files,
	} as FileList
}

describe("useRecordingEntryFacade", () => {
	beforeEach(() => {
		runtimeMock.state.isRecording = false
		runtimeMock.state.isPaused = false
		runtimeMock.state.duration = "00:00:00"
		runtimeMock.actions.startRecording.mockReset()
		runtimeMock.actions.startRecording.mockImplementation(() => {
			runtimeMock.state.isRecording = true
		})
		runtimeMock.actions.finishRecording.mockReset()
		recordSummaryStoreMock.isRecording = false
		analyticsTrackMock.mockReset()
		isMobileMock.mockReset()
		isMobileMock.mockReturnValue(false)
		recordSummaryServiceMock.ensureProjectAndTopic.mockReset()
		recordSummaryServiceMock.getRecordingOverrideContext.mockReset()
		recordSummaryServiceMock.getRecordingOverrideContext.mockResolvedValue(null)
		recordSummaryServiceMock.prepareRecordingOverride.mockReset()
		recordSummaryServiceMock.prepareRecordingOverride.mockResolvedValue(true)
		recordSummaryServiceMock.releaseOverrideSessionForForceStart.mockReset()
		recordSummaryServiceMock.pauseRecording.mockReset()
		recordSummaryServiceMock.continueRecording.mockReset()
		recordSummaryServiceMock.updateNote.mockReset()
		recordSummaryServiceMock.enableTranscriptionForCurrentSession.mockReset()
		recordSummaryServiceMock.on.mockReset()
		recordSummaryServiceMock.on.mockImplementation(() => () => undefined)
		recordSummaryStoreMock.status = "init"
		recordSummaryStoreMock.isVisible = false
		recordSummaryStoreMock.floatPanel.setExpanded.mockReset()
		recordSummaryStoreMock.floatPanel.setExpandedAiChat.mockReset()
		recordSummaryStoreMock.message = []
		recordSummaryStoreMock.note = { content: "", file_extension: "md" }
		recordSummaryStoreMock.errorState.recordingError = undefined
		recordSummaryStoreMock.businessData.workspace = null
		recordSummaryStoreMock.businessData.project = null
		recordSummaryStoreMock.businessData.topic = null
		recordSummaryStoreMock.businessData.model = null
		recordSummaryStoreMock.businessData.transcriptionEnabled = true
		workspaceStoreMock.selectedWorkspace = { id: "workspace-1", name: "Workspace One" }
		workspaceStoreMock.firstWorkspace = { id: "workspace-1", name: "Workspace One" }
		recordingTopicModelApiMock.getRecordingTopicModel.mockReset()
		recordingTopicModelApiMock.saveRecordingTopicModel.mockReset()
		summaryModelListMock.fetchSummaryModelGroups.mockReset()
		summaryModelListMock.resolveDefaultSummaryModelId.mockReset()
		audioRecordingsServiceMock.submitSummary.mockReset()
		forceOverrideMock.run.mockReset()
		forceOverrideMock.run.mockImplementation(
			async (_context: unknown, prepare: () => Promise<boolean>) => prepare(),
		)
		superMagicApiMock.getWorkspaces.mockReset()
		superMagicApiMock.getWorkspaceDetail.mockReset()
		superMagicApiMock.createProject.mockReset()
		superMagicApiMock.createAudioProject.mockReset()
		superMagicApiMock.deleteProject.mockReset()
		resetRecordingSettingsCacheForTests()
		importTestState.queuedFiles = []
		importTestState.pendingImportContext = null
		audioImportStoreMock.startAudioImport.mockClear()
		audioRecordingsStore.optimisticItems = []
		// Default list filter is All so recording/import stay ungrouped unless a test overrides it.
		writeAudioRecordingsFilterSession({
			summaryFilter: "all",
			datePreset: "all",
			sortBy: "updated_at",
			sortOrder: "desc",
			searchKeyword: "",
			groupId: ALL_RECORDING_GROUP_ID,
		})

		// Mock navigator.mediaDevices.getUserMedia for jsdom test environment compatibility
		if (typeof navigator !== "undefined") {
			Object.defineProperty(navigator, "mediaDevices", {
				writable: true,
				configurable: true,
				value: {
					getUserMedia: vi.fn().mockResolvedValue({
						getAudioTracks: () => [{ readyState: "live", stop: vi.fn() }],
						getTracks: () => [{ stop: vi.fn() }],
					}),
				},
			})
		}

		const workspace = {
			id: "workspace-audio-001",
			name: "Audio Workspace",
		} as Workspace
		const project = {
			id: "project-audio-001",
			project_name: "Audio Project",
			workspace_id: workspace.id,
			workspace_name: workspace.name,
			project_status: "waiting",
			project_mode: "audio",
			work_dir: "",
			current_topic_id: "topic-audio-001",
			current_topic_status: "waiting",
			created_at: "2026-06-15T00:00:00Z",
			updated_at: "2026-06-15T00:00:00Z",
			tag: "",
		} as unknown as ProjectListItem
		const topic = {
			id: "topic-audio-001",
			topic_name: "Audio Topic",
			project_id: project.id,
			workspace_id: workspace.id,
			topic_mode: "audio",
		} as unknown as Topic

		superMagicApiMock.getWorkspaces.mockResolvedValue({ list: [workspace] })
		superMagicApiMock.getWorkspaceDetail.mockResolvedValue(workspace)
		superMagicApiMock.createProject.mockResolvedValue({ project, topic })
		superMagicApiMock.createAudioProject.mockResolvedValue({ project, topic })
		superMagicApiMock.deleteProject.mockResolvedValue(undefined)
		recordingTopicModelApiMock.getRecordingTopicModel.mockResolvedValue({
			model: { model_id: "model-alpha" },
			extra: {
				model: { model_id: "model-alpha" },
				auto_summary_enabled: true,
				transcription_enabled: true,
			},
		})
		recordingTopicModelApiMock.saveRecordingTopicModel.mockResolvedValue(undefined)
	})

	it("keeps list presentation on desktop when a shared session is already active", async () => {
		recordSummaryStoreMock.status = "recording"

		const { result } = renderHook(() => useRecordingEntryFacade())

		expect(result.current.presentation).toBe("list")
		expect(result.current.isSessionActive).toBe(true)
	})

	it("starts recording with a new audio project context and keeps list presentation on desktop", async () => {
		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(superMagicApiMock.getWorkspaceDetail).not.toHaveBeenCalled()
		expect(superMagicApiMock.createAudioProject).toHaveBeenCalledWith(
			expect.objectContaining({
				audio_source: "recorded",
				source: "pc",
				is_hidden: true,
				transcription_enabled: true,
			}),
		)
		expect(superMagicApiMock.createAudioProject.mock.calls[0]?.[0]).not.toHaveProperty(
			"workspace_id",
		)
		expect(runtimeMock.actions.startRecording).toHaveBeenCalledWith(
			expect.objectContaining({
				workspace: null,
				project: expect.objectContaining({ id: "project-audio-001" }),
				topic: expect.objectContaining({ id: "topic-audio-001" }),
				model: expect.objectContaining({ model_id: "model-alpha" }),
				transcriptionEnabled: true,
			}),
		)
		expect(result.current.presentation).toBe("list")
		expect(analyticsTrackMock).toHaveBeenCalledWith("project_create_attempted", {
			workspaceId: undefined,
			sceneOverride: "ai_recording",
			mode: TopicMode.RecordSummary,
		})
		expect(analyticsTrackMock).toHaveBeenCalledWith("ai_recording_start_attempted", {
			isMobile: false,
			audioSource: "recorded",
			transcriptionEnabled: true,
		})
	})

	it("attaches the current real group workspace when starting a recording", async () => {
		writeAudioRecordingsFilterSession({
			summaryFilter: "all",
			datePreset: "all",
			sortBy: "updated_at",
			sortOrder: "desc",
			searchKeyword: "",
			groupId: "workspace-audio-001",
		})

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(superMagicApiMock.getWorkspaceDetail).toHaveBeenCalledWith({
			id: "workspace-audio-001",
		})
		expect(superMagicApiMock.createAudioProject).toHaveBeenCalledWith(
			expect.objectContaining({
				workspace_id: "workspace-audio-001",
				audio_source: "recorded",
			}),
		)
		expect(runtimeMock.actions.startRecording).toHaveBeenCalledWith(
			expect.objectContaining({
				workspace: expect.objectContaining({ id: "workspace-audio-001" }),
			}),
		)
	})

	it("keeps new recordings ungrouped when the shared filter is Ungrouped", async () => {
		writeAudioRecordingsFilterSession({
			summaryFilter: "all",
			datePreset: "all",
			sortBy: "updated_at",
			sortOrder: "desc",
			searchKeyword: "",
			groupId: UNGROUPED_RECORDING_GROUP_ID,
		})

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(superMagicApiMock.getWorkspaceDetail).not.toHaveBeenCalled()
		expect(superMagicApiMock.createAudioProject.mock.calls[0]?.[0]).not.toHaveProperty(
			"workspace_id",
		)
		expect(runtimeMock.actions.startRecording).toHaveBeenCalledWith(
			expect.objectContaining({
				workspace: null,
			}),
		)
	})

	it("aborts recording startup when the current group detail cannot be resolved", async () => {
		writeAudioRecordingsFilterSession({
			summaryFilter: "all",
			datePreset: "all",
			sortBy: "updated_at",
			sortOrder: "desc",
			searchKeyword: "",
			groupId: "workspace-missing-group",
		})
		superMagicApiMock.getWorkspaceDetail.mockRejectedValue(new Error("group missing"))

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(superMagicApiMock.createAudioProject).not.toHaveBeenCalled()
		expect(runtimeMock.actions.startRecording).not.toHaveBeenCalled()
		expect(result.current.startupState).toBe("error")
	})

	it("starts recording without realtime transcription when the recording setting is disabled", async () => {
		seedRecordingSettingsCacheForTests(
			{
				model: { model_id: "model-alpha" },
				extra: {
					model: { model_id: "model-alpha" },
					transcription_enabled: false,
					auto_summary_enabled: true,
				},
			},
			{
				transcription_enabled: false,
				auto_summary_enabled: true,
				model_id: "model-alpha",
			},
		)

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(superMagicApiMock.createAudioProject).toHaveBeenCalledWith(
			expect.objectContaining({
				transcription_enabled: false,
			}),
		)
		expect(runtimeMock.actions.startRecording).toHaveBeenCalledWith(
			expect.objectContaining({
				transcriptionEnabled: false,
			}),
		)
		expect(analyticsTrackMock).toHaveBeenCalledWith("ai_recording_start_attempted", {
			isMobile: false,
			audioSource: "recorded",
			transcriptionEnabled: false,
		})
	})

	it("reveals the desktop FloatPanel while recorder startup is still pending", async () => {
		runtimeMock.actions.startRecording.mockImplementation(() => new Promise(() => undefined))

		const { result } = renderHook(() => useRecordingEntryFacade())

		act(() => {
			void result.current.startRecording()
		})
		await act(async () => {
			await Promise.resolve()
		})

		expect(recordSummaryStoreMock.isVisible).toBe(true)
		expect(recordSummaryStoreMock.floatPanel.setExpanded).toHaveBeenCalledWith(true)
		expect(recordSummaryStoreMock.floatPanel.setExpandedAiChat).toHaveBeenCalledWith(true)
		expect(result.current.presentation).toBe("list")
	})

	it("uses the normal start path directly when no recording needs replacement", async () => {
		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(forceOverrideMock.run).not.toHaveBeenCalled()
		expect(recordSummaryServiceMock.prepareRecordingOverride).not.toHaveBeenCalled()
		expect(runtimeMock.actions.startRecording).toHaveBeenCalledTimes(1)
	})

	it("confirms and completes the current session before starting a new recording", async () => {
		recordSummaryStoreMock.status = "recording"
		const overrideContext = {
			sessionId: "current-session",
			duration: "00:12:34",
			source: "currentTab",
			status: "recording",
		} as const
		recordSummaryServiceMock.getRecordingOverrideContext.mockResolvedValue(overrideContext)

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(forceOverrideMock.run).toHaveBeenCalledWith(
			overrideContext,
			expect.any(Function),
			expect.any(Function),
		)
		expect(recordSummaryServiceMock.prepareRecordingOverride).toHaveBeenCalledWith(
			"current-session",
		)
		expect(runtimeMock.actions.startRecording).toHaveBeenCalledTimes(1)
	})

	it("uses the same override flow for a recoverable historical session", async () => {
		const overrideContext = {
			sessionId: "historical-session",
			duration: "01:02:03",
			source: "history",
			status: "paused",
		} as const
		recordSummaryServiceMock.getRecordingOverrideContext.mockResolvedValue(overrideContext)

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(forceOverrideMock.run).toHaveBeenCalledWith(
			overrideContext,
			expect.any(Function),
			expect.any(Function),
		)
		expect(recordSummaryServiceMock.prepareRecordingOverride).toHaveBeenCalledWith(
			"historical-session",
		)
		expect(runtimeMock.actions.startRecording).toHaveBeenCalledTimes(1)
	})

	it("uses the same override flow when another tab is recording", async () => {
		const overrideContext = {
			sessionId: "other-tab-session",
			duration: "00:08:15",
			source: "otherTab",
			status: "recording",
		} as const
		recordSummaryServiceMock.getRecordingOverrideContext.mockResolvedValue(overrideContext)

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(forceOverrideMock.run).toHaveBeenCalledWith(
			overrideContext,
			expect.any(Function),
			expect.any(Function),
		)
		expect(recordSummaryServiceMock.prepareRecordingOverride).toHaveBeenCalledWith(
			"other-tab-session",
		)
		expect(runtimeMock.actions.startRecording).toHaveBeenCalledTimes(1)
	})

	it("does not create a new recording when replacement is declined", async () => {
		recordSummaryServiceMock.getRecordingOverrideContext.mockResolvedValue({
			sessionId: "current-session",
			duration: "00:12:34",
			source: "currentTab",
			status: "recording",
		})
		forceOverrideMock.run.mockResolvedValue(false)

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(superMagicApiMock.createAudioProject).not.toHaveBeenCalled()
		expect(runtimeMock.actions.startRecording).not.toHaveBeenCalled()
	})

	it("passes the confirmed session id when force-releasing", async () => {
		recordSummaryServiceMock.getRecordingOverrideContext.mockResolvedValue({
			sessionId: "current-session",
			duration: "00:12:34",
			source: "currentTab",
			status: "recording",
		})
		recordSummaryServiceMock.prepareRecordingOverride.mockResolvedValue(false)
		forceOverrideMock.run.mockImplementation(
			async (
				_context: unknown,
				prepare: () => Promise<boolean>,
				forceRelease?: () => Promise<boolean> | boolean,
			) => {
				await prepare()
				await forceRelease?.()
				return true
			},
		)

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(recordSummaryServiceMock.releaseOverrideSessionForForceStart).toHaveBeenCalledWith(
			"current-session",
		)
	})

	it("does not create a new recording when replacement preparation fails", async () => {
		recordSummaryServiceMock.getRecordingOverrideContext.mockResolvedValue({
			sessionId: "current-session",
			duration: "00:12:34",
			source: "currentTab",
			status: "recording",
		})
		recordSummaryServiceMock.prepareRecordingOverride.mockResolvedValue(false)

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(recordSummaryServiceMock.prepareRecordingOverride).toHaveBeenCalledWith(
			"current-session",
		)
		expect(superMagicApiMock.createAudioProject).not.toHaveBeenCalled()
		expect(runtimeMock.actions.startRecording).not.toHaveBeenCalled()
	})

	it("ignores repeated start clicks while conflict detection is pending", async () => {
		let resolveContext: ((value: null) => void) | undefined
		recordSummaryServiceMock.getRecordingOverrideContext.mockImplementation(
			() =>
				new Promise<null>((resolve) => {
					resolveContext = resolve
				}),
		)

		const { result } = renderHook(() => useRecordingEntryFacade())

		let firstStart: Promise<void>
		await act(async () => {
			firstStart = result.current.startRecording()
			await result.current.startRecording()
		})

		expect(recordSummaryServiceMock.getRecordingOverrideContext).toHaveBeenCalledTimes(1)

		await act(async () => {
			resolveContext?.(null)
			if (!firstStart) throw new Error("first start promise was not created")
			await firstStart
		})

		expect(runtimeMock.actions.startRecording).toHaveBeenCalledTimes(1)
	})

	it("collapses back to list presentation without stopping the shared session", async () => {
		recordSummaryStoreMock.status = "recording"

		const { result } = renderHook(() => useRecordingEntryFacade())

		act(() => {
			result.current.showList()
		})

		expect(result.current.presentation).toBe("list")
		expect(result.current.isSessionActive).toBe(true)
	})

	it("creates an ungrouped audio project context before starting recording from All", async () => {
		superMagicApiMock.createAudioProject.mockResolvedValue({
			project: {
				id: "project-ensured",
				project_name: "Ensured Project",
				workspace_id: null,
			},
			topic: {
				id: "topic-ensured",
				topic_name: "Ensured Topic",
				workspace_id: null,
			},
		})

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(superMagicApiMock.getWorkspaceDetail).not.toHaveBeenCalled()
		expect(runtimeMock.actions.startRecording).toHaveBeenCalledWith(
			expect.objectContaining({
				workspace: null,
				project: expect.objectContaining({ id: "project-ensured" }),
			}),
		)
		expect(analyticsTrackMock).toHaveBeenCalledWith("project_create_attempted", {
			workspaceId: undefined,
			sceneOverride: "ai_recording",
			mode: TopicMode.RecordSummary,
		})
	})

	it("hydrates summary model context on demand before starting recording", async () => {
		topicModelStoreMock.selectedLanguageModel = null
		recordingTopicModelApiMock.getRecordingTopicModel.mockResolvedValue({
			model: { model_id: "model-fallback" },
			extra: { model: { model_id: "model-fallback" } },
		})
		summaryModelListMock.fetchSummaryModelGroups.mockResolvedValue([
			{
				group: {
					id: "group-1",
					mode_id: "summary",
					icon: "",
					color: "",
					name: "group",
					description: "",
					sort: 1,
					status: true,
					created_at: "",
				},
				models: [
					{
						id: "model-local-2",
						group_id: "group-1",
						model_id: "model-fallback",
						model_name: "Model Fallback",
						provider_model_id: "model-fallback",
						model_description: "",
						model_icon: "",
						model_status: "normal",
						sort: 1,
					},
				],
				model_ids: ["model-fallback"],
				image_model_ids: [],
				video_model_ids: [],
			},
		])
		summaryModelListMock.resolveDefaultSummaryModelId.mockReturnValue("model-fallback")

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.startRecording()
		})

		expect(recordingTopicModelApiMock.getRecordingTopicModel).toHaveBeenCalled()
		expect(summaryModelListMock.fetchSummaryModelGroups).toHaveBeenCalled()
		expect(runtimeMock.actions.startRecording).toHaveBeenCalledWith(
			expect.objectContaining({
				model: expect.objectContaining({ model_id: "model-fallback" }),
			}),
		)
	})

	it("exposes recording start timeout as an inline error state", async () => {
		topicModelStoreMock.selectedLanguageModel = {
			id: "model-local-timeout",
			group_id: "group-1",
			model_id: "model-alpha",
			model_name: "Model Alpha",
			provider_model_id: "model-alpha",
			model_description: "Model Alpha",
			model_icon: "",
			model_status: "normal",
			sort: 1,
		}
		recordingTopicModelApiMock.getRecordingTopicModel.mockResolvedValue({
			model: { model_id: "model-alpha" },
			extra: { model: { model_id: "model-alpha" } },
		})
		summaryModelListMock.fetchSummaryModelGroups.mockResolvedValue([
			{
				group: {
					id: "group-1",
					mode_id: "summary",
					icon: "",
					color: "",
					name: "group",
					description: "",
					sort: 1,
					status: true,
					created_at: "",
				},
				models: [topicModelStoreMock.selectedLanguageModel],
				model_ids: ["model-alpha"],
				image_model_ids: [],
				video_model_ids: [],
			},
		])
		summaryModelListMock.resolveDefaultSummaryModelId.mockReturnValue("model-alpha")
		runtimeMock.actions.startRecording.mockImplementation(() => new Promise(() => undefined))

		vi.useFakeTimers()

		const { result } = renderHook(() => useRecordingEntryFacade())

		const startPromise = act(async () => {
			const pendingStart = result.current.startRecording()
			await vi.advanceTimersByTimeAsync(15500)
			await pendingStart
		})

		await startPromise

		expect(result.current.presentation).toBe("list")
		expect(result.current.startupState).toBe("error")
		expect(result.current.startupErrorMessage).toBe(
			"mobile.recordingEntry.active.startTimedOut",
		)
		expect(result.current.startupErrorDetail).toContain("recording-start-timeout")
		expect(analyticsTrackMock).toHaveBeenCalledWith("ai_recording_start_attempted", {
			isMobile: false,
			audioSource: "recorded",
			transcriptionEnabled: true,
		})

		vi.useRealTimers()
	})

	it("maps recorder permission errors into a specific startup message", async () => {
		let recordingErrorListener: (() => void) | null = null
		recordSummaryServiceMock.on.mockImplementation((_event: string, handler: () => void) => {
			recordingErrorListener = handler
			return () => undefined
		})

		const { result } = renderHook(() => useRecordingEntryFacade())

		recordSummaryStoreMock.errorState.recordingError = new Error(
			"Failed to start recording: PermissionDeniedError: Microphone permission denied by user",
		)

		act(() => {
			recordingErrorListener?.()
		})

		expect(result.current.startupState).toBe("error")
		expect(result.current.startupErrorMessage).toBe(
			"mobile.recordingEntry.active.permissionDenied",
		)
		expect(result.current.startupErrorDetail).toContain("Microphone permission denied by user")
	})

	it("submits imported audio for summary after upload completes", async () => {
		superMagicApiMock.createAudioProject.mockResolvedValue({
			project: {
				id: "project-import",
				project_name: "Imported Project",
			},
			topic: {
				id: "topic-import",
				topic_name: "Imported Topic",
			},
		})

		const { result, rerender } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.importAudioFiles(
				createFileList([new File(["voice"], "hello.wav", { type: "audio/wav" })]),
			)
		})

		expect(superMagicApiMock.createAudioProject.mock.calls[0]?.[0]).not.toHaveProperty(
			"workspace_id",
		)
		expect(importTestState.queuedFiles).toHaveLength(1)
		expect(importTestState.pendingImportContext).toMatchObject({
			autoSummaryEnabled: true,
			workspaceId: UNGROUPED_RECORDING_GROUP_ID,
		})

		await act(async () => {
			await completeImportUpload({
				file_id: "saved-file-id",
				file_key: "recording/upload.wav",
				file_name: "hello.wav",
				file_size: 128,
				file_type: "user_upload",
				project_id: "project-import",
				topic_id: "topic-import",
				task_id: "task-import",
				created_at: "2026-06-15T00:00:00Z",
				relative_file_path: "upload/hello.wav",
			})
		})

		// Hook reads MobX store snapshot per render; without observer wrapper, rerender after store updates.
		rerender()

		expect(audioRecordingsServiceMock.submitSummary).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "project-import",
				audio_source: "imported",
				audio_file_id: "saved-file-id",
				// task_key must come from the session key generated in importAudioFiles,
				// NOT from saveResult.task_id (file-save response), which is often "0" or
				// an unrelated placeholder value.
				task_key: expect.stringContaining("session-web-"),
			}),
			"model-alpha",
		)
		expect(result.current.optimisticItems[0]).toMatchObject({
			id: "project-import",
			audio_source: "imported",
			audio_file_id: "saved-file-id",
			// The optimistic item must also carry the correct project-level task key.
			task_key: expect.stringContaining("session-web-"),
			card_status: "summarizing",
		})
	})

	it("imports audio into the currently selected real group", async () => {
		writeAudioRecordingsFilterSession({
			summaryFilter: "all",
			datePreset: "all",
			sortBy: "updated_at",
			sortOrder: "desc",
			searchKeyword: "",
			groupId: "workspace-audio-001",
		})
		superMagicApiMock.createAudioProject.mockResolvedValue({
			project: {
				id: "project-import-grouped",
				project_name: "Grouped Import",
			},
			topic: {
				id: "topic-import-grouped",
				topic_name: "Grouped Import Topic",
			},
		})

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.importAudioFiles(
				createFileList([new File(["voice"], "grouped.wav", { type: "audio/wav" })]),
			)
		})

		expect(superMagicApiMock.getWorkspaceDetail).toHaveBeenCalledWith({
			id: "workspace-audio-001",
		})
		expect(superMagicApiMock.createAudioProject).toHaveBeenCalledWith(
			expect.objectContaining({
				workspace_id: "workspace-audio-001",
				audio_source: "imported",
			}),
		)
		expect(audioImportStoreMock.startAudioImport).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({
				workspaceId: "workspace-audio-001",
			}),
		)
	})

	it("passes disabled auto summary into imported upload context", async () => {
		seedRecordingSettingsCacheForTests(
			{
				model: { model_id: "model-alpha" },
				extra: {
					model: { model_id: "model-alpha" },
					auto_summary_enabled: false,
				},
			},
			{
				transcription_enabled: true,
				auto_summary_enabled: false,
				model_id: "model-alpha",
			},
		)

		superMagicApiMock.createAudioProject.mockResolvedValue({
			project: {
				id: "project-import-manual",
				project_name: "Imported Project Manual",
			},
			topic: {
				id: "topic-import-manual",
				topic_name: "Imported Topic Manual",
			},
		})

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.importAudioFiles(
				createFileList([new File(["voice"], "manual.wav", { type: "audio/wav" })]),
			)
		})

		expect(superMagicApiMock.createAudioProject).toHaveBeenCalledWith(
			expect.objectContaining({
				audio_source: "imported",
				auto_summary: false,
				is_hidden: true,
			}),
		)
		expect(audioImportStoreMock.startAudioImport).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({
				projectId: "project-import-manual",
				topicId: "topic-import-manual",
				autoSummaryEnabled: false,
			}),
		)
	})

	it("enables realtime transcription for the active recording and persists the global setting", async () => {
		seedRecordingSettingsCacheForTests(
			{
				model: { model_id: "model-alpha" },
				extra: {
					model: { model_id: "model-alpha" },
					transcription_enabled: false,
					auto_summary_enabled: true,
				},
			},
			{
				transcription_enabled: false,
				auto_summary_enabled: true,
				model_id: "model-alpha",
			},
		)

		recordSummaryStoreMock.businessData.transcriptionEnabled = false

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.enableTranscription()
		})

		expect(recordingTopicModelApiMock.saveRecordingTopicModel).toHaveBeenCalledWith(
			expect.objectContaining({
				cache_id: "default_audio",
				extra: expect.objectContaining({
					transcription_enabled: true,
				}),
			}),
		)
		expect(recordSummaryServiceMock.enableTranscriptionForCurrentSession).toHaveBeenCalled()
		expect(result.current.transcriptionEnabled).toBe(true)
		expect(result.current.isEnablingTranscription).toBe(false)
	})

	it("seeds finished recordings with local session duration while backend duration is still pending", async () => {
		runtimeMock.state.duration = "00:12:34"
		runtimeMock.actions.finishRecording.mockImplementation(
			async ({ onSuccess }: { onSuccess?: (result: Record<string, string>) => void }) => {
				onSuccess?.({
					project_id: "project-recorded",
					project_name: "Recorded Project",
					workspace_id: "workspace-recorded",
					model_id: "model-alpha",
					topic_id: "topic-recorded",
					task_key: "session-web-mock-recorded-task",
				})
			},
		)

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.finishRecording()
		})

		expect(result.current.optimisticItems[0]).toMatchObject({
			id: "project-recorded",
			audio_source: "recorded",
			duration: 754,
			card_status: "summarizing",
			task_key: "session-web-mock-recorded-task",
		})
	})

	it("skips auto summary and seeds a generate-summary card when auto summary is disabled", async () => {
		seedRecordingSettingsCacheForTests(
			{
				model: { model_id: "model-alpha" },
				extra: {
					model: { model_id: "model-alpha" },
					auto_summary_enabled: false,
				},
			},
			{
				transcription_enabled: true,
				auto_summary_enabled: false,
				model_id: "model-alpha",
			},
		)

		runtimeMock.state.duration = "00:01:00"
		runtimeMock.actions.finishRecording.mockImplementation(
			async ({
				onSuccess,
				skipSummary,
			}: {
				onSuccess?: (result: Record<string, string>) => void
				skipSummary?: boolean
			}) => {
				expect(skipSummary).toBe(true)
				onSuccess?.({
					project_id: "project-manual-summary",
					project_name: "Manual Summary Project",
					workspace_id: "workspace-manual",
					model_id: "model-alpha",
					topic_id: "topic-manual",
					task_key: "session-web-mock-manual-summary-task",
				})
			},
		)

		const { result } = renderHook(() => useRecordingEntryFacade())

		await act(async () => {
			await result.current.finishRecording()
		})

		expect(result.current.optimisticItems[0]).toMatchObject({
			id: "project-manual-summary",
			card_status: "processing",
			current_phase: "merging",
			phase_status: "in_progress",
			task_key: "session-web-mock-manual-summary-task",
		})
	})

	describe("ai_recording_start_attempted", () => {
		it("does not track when the user only reopens an already active session", async () => {
			recordSummaryStoreMock.status = "recording"

			const { result } = renderHook(() => useRecordingEntryFacade())

			await act(async () => {
				await result.current.startRecording()
			})

			expect(superMagicApiMock.createAudioProject).not.toHaveBeenCalled()
			expect(runtimeMock.actions.startRecording).not.toHaveBeenCalled()
			expect(analyticsTrackMock).not.toHaveBeenCalled()
		})

		it("does not track when microphone permission fails before project creation", async () => {
			const getUserMedia = vi.fn().mockRejectedValue(new Error("PermissionDeniedError"))
			Object.defineProperty(navigator, "mediaDevices", {
				writable: true,
				configurable: true,
				value: { getUserMedia },
			})

			const { result } = renderHook(() => useRecordingEntryFacade())

			await act(async () => {
				await result.current.startRecording()
			})

			expect(superMagicApiMock.createAudioProject).not.toHaveBeenCalled()
			expect(analyticsTrackMock).not.toHaveBeenCalled()
		})

		it("still tracks the attempt when createAudioProject fails", async () => {
			superMagicApiMock.createAudioProject.mockResolvedValue(null)

			const { result } = renderHook(() => useRecordingEntryFacade())

			await act(async () => {
				await result.current.startRecording()
			})

			expect(runtimeMock.actions.startRecording).not.toHaveBeenCalled()
			expect(analyticsTrackMock).toHaveBeenCalledWith("ai_recording_start_attempted", {
				isMobile: false,
				audioSource: "recorded",
				transcriptionEnabled: true,
			})
		})

		it("still tracks the attempt when the recorder never actually starts", async () => {
			runtimeMock.actions.startRecording.mockImplementation(() => {
				runtimeMock.state.isRecording = false
			})

			const { result } = renderHook(() => useRecordingEntryFacade())

			await act(async () => {
				await result.current.startRecording()
			})

			expect(superMagicApiMock.createAudioProject).toHaveBeenCalled()
			expect(analyticsTrackMock).toHaveBeenCalledWith("ai_recording_start_attempted", {
				isMobile: false,
				audioSource: "recorded",
				transcriptionEnabled: true,
			})
			expect(superMagicApiMock.deleteProject).toHaveBeenCalledWith({
				id: "project-audio-001",
			})
		})

		it("reports a mobile web start with isMobile", async () => {
			isMobileMock.mockReturnValue(true)

			const { result } = renderHook(() => useRecordingEntryFacade())

			await act(async () => {
				await result.current.startRecording()
			})

			expect(analyticsTrackMock).toHaveBeenCalledWith("ai_recording_start_attempted", {
				isMobile: true,
				audioSource: "recorded",
				transcriptionEnabled: true,
			})
		})

		it("counts each accepted start attempt", async () => {
			const { result } = renderHook(() => useRecordingEntryFacade())

			await act(async () => {
				await result.current.startRecording()
				await result.current.startRecording()
			})

			expect(
				analyticsTrackMock.mock.calls.filter(
					([event]) => event === "ai_recording_start_attempted",
				),
			).toHaveLength(2)
		})

		it("tracks imported starts before the upload request", async () => {
			superMagicApiMock.createAudioProject.mockResolvedValue({
				project: {
					id: "project-import-started",
					project_name: "Imported Project Started",
				},
				topic: {
					id: "topic-import-started",
					topic_name: "Imported Topic Started",
				},
			})

			const { result } = renderHook(() => useRecordingEntryFacade())

			await act(async () => {
				await result.current.importAudioFiles(
					createFileList([new File(["voice"], "started.wav", { type: "audio/wav" })]),
				)
			})

			expect(analyticsTrackMock).toHaveBeenCalledTimes(2)
			expect(analyticsTrackMock).toHaveBeenCalledWith("project_create_attempted", {
				workspaceId: undefined,
				sceneOverride: "ai_recording",
				mode: TopicMode.RecordSummary,
			})
			expect(analyticsTrackMock).toHaveBeenCalledWith("ai_recording_start_attempted", {
				isMobile: false,
				audioSource: "imported",
				transcriptionEnabled: true,
			})
		})

		it("reports imported starts with h5 source on mobile web", async () => {
			isMobileMock.mockReturnValue(true)
			superMagicApiMock.createAudioProject.mockResolvedValue({
				project: {
					id: "project-import-h5",
					project_name: "Imported Project H5",
				},
				topic: {
					id: "topic-import-h5",
					topic_name: "Imported Topic H5",
				},
			})

			const { result } = renderHook(() => useRecordingEntryFacade())

			await act(async () => {
				await result.current.importAudioFiles(
					createFileList([new File(["voice"], "h5.wav", { type: "audio/wav" })]),
				)
			})

			expect(analyticsTrackMock).toHaveBeenCalledWith("ai_recording_start_attempted", {
				isMobile: true,
				audioSource: "imported",
				transcriptionEnabled: true,
			})
		})

		it("still tracks imported attempts when upload never begins", async () => {
			audioImportStoreMock.startAudioImport.mockImplementationOnce(async (files, context) => {
				importTestState.queuedFiles = files
				importTestState.pendingImportContext = context
			})
			superMagicApiMock.createAudioProject.mockResolvedValue({
				project: {
					id: "project-import-pending",
					project_name: "Imported Project Pending",
				},
				topic: {
					id: "topic-import-pending",
					topic_name: "Imported Topic Pending",
				},
			})

			const { result } = renderHook(() => useRecordingEntryFacade())

			await act(async () => {
				await result.current.importAudioFiles(
					createFileList([new File(["voice"], "pending.wav", { type: "audio/wav" })]),
				)
			})

			expect(superMagicApiMock.createAudioProject).toHaveBeenCalled()
			expect(audioImportStoreMock.startAudioImport).toHaveBeenCalled()
			expect(analyticsTrackMock).toHaveBeenCalledWith("ai_recording_start_attempted", {
				isMobile: false,
				audioSource: "imported",
				transcriptionEnabled: true,
			})
		})

		it("still tracks imported attempts when project creation fails", async () => {
			superMagicApiMock.createAudioProject.mockResolvedValue(null)

			const { result } = renderHook(() => useRecordingEntryFacade())

			await act(async () => {
				await result.current.importAudioFiles(
					createFileList([new File(["voice"], "missing.wav", { type: "audio/wav" })]),
				)
			})

			expect(audioImportStoreMock.startAudioImport).not.toHaveBeenCalled()
			expect(analyticsTrackMock).toHaveBeenCalledWith("ai_recording_start_attempted", {
				isMobile: false,
				audioSource: "imported",
				transcriptionEnabled: true,
			})
		})

		it("tracks imported transcription_enabled from the real recording setting", async () => {
			seedRecordingSettingsCacheForTests(
				{
					model: { model_id: "model-alpha" },
					extra: {
						model: { model_id: "model-alpha" },
						transcription_enabled: false,
						auto_summary_enabled: true,
					},
				},
				{
					transcription_enabled: false,
					auto_summary_enabled: true,
					model_id: "model-alpha",
				},
			)
			superMagicApiMock.createAudioProject.mockResolvedValue({
				project: {
					id: "project-import-no-transcript",
					project_name: "Imported Project No Transcript",
				},
				topic: {
					id: "topic-import-no-transcript",
					topic_name: "Imported Topic No Transcript",
				},
			})

			const { result } = renderHook(() => useRecordingEntryFacade())

			await act(async () => {
				await result.current.importAudioFiles(
					createFileList([
						new File(["voice"], "no-transcript.wav", { type: "audio/wav" }),
					]),
				)
			})

			expect(analyticsTrackMock).toHaveBeenCalledWith("ai_recording_start_attempted", {
				isMobile: false,
				audioSource: "imported",
				transcriptionEnabled: false,
			})
		})
	})
})
