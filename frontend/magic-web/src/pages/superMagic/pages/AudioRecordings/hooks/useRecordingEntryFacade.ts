import type { ComponentType } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import i18next from "i18next"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { useRecordingEditorRuntime } from "@/components/business/RecordingSummary/internal/editorRuntime"
import { audioImportStore } from "../stores/audio-import-store"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import type { AudioProjectListItem } from "@/types/audioProject"
import { initializeService } from "@/services/recordSummary/serviceInstance"
import { RECORD_SUMMARY_EVENTS } from "@/services/recordSummary/const/events"
import recordSummaryStore from "@/stores/recordingSummary"
import topicModelStore from "@/stores/superMagic/topicModelStore"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { useIsMobile } from "@/hooks/useIsMobile"
import { getRecordingTopicModel, saveRecordingTopicModel } from "../apis/recording-settings-api"
import {
	resolveAutoSummaryEnabled,
	resolveTranscriptionEnabled,
	settingsToApiPayload,
} from "../utils/recording-settings-mapper"
import { fetchSummaryModelGroups, resolveDefaultSummaryModelId } from "../utils/summary-model-list"
import { getCachedRecordingSettings, patchCachedRecordingSettings } from "./useRecordingSettings"
import { audioRecordingsService } from "@/services/audioRecordings/AudioRecordingsService"
import { audioRecordingsStore } from "../stores/audio-recordings-store"
import { SuperMagicApi } from "@/apis"
import {
	ALL_RECORDING_GROUP_ID,
	UNGROUPED_RECORDING_GROUP_ID,
} from "@/services/audioRecordings/RecordingGroupsConstants"
import { createRandomUuidV4 } from "@/utils/create-random-uuid-v4"
import type { VoiceResultUtterance } from "@/components/business/VoiceInput/services/VoiceClient/types"
import { buildOptimisticRecordingItem } from "../utils/build-optimistic-recording-item"
import { resolveCardStatusFromListItem } from "../utils/normalize-audio-project-item"
import { readAudioRecordingsFilterSession } from "../utils/audio-recordings-filter-session"
import { runForceRecordingOverride } from "@/components/business/RecordingSummary/utils/force-recording-override"
import { analyticsService } from "@/services/analytics"

export type EntryPresentation = "list" | "recording"
export type RecordingStartupState = "idle" | "starting" | "error"

const RECORDING_START_TIMEOUT_MS = 15000

/**
 * Expands the legacy global FloatPanel on desktop without switching the H5
 * full-screen recording presentation used by the mobile recordings entry.
 */
function expandDesktopRecordingFloatPanel(): void {
	recordSummaryStore.isVisible = true
	recordSummaryStore.floatPanel.setExpanded(true)
	// Audio recordings open with the conversation visible so the new entry is discoverable.
	recordSummaryStore.floatPanel.setExpandedAiChat?.(true)
}

/**
 * Collapses the desktop FloatPanel after a bootstrap failure so the list page
 * does not keep showing an empty shell when recording never actually started.
 */
function collapseDesktopRecordingFloatPanel(): void {
	recordSummaryStore.isVisible = false
	recordSummaryStore.floatPanel.setExpanded(false)
}

function parseHmsDurationToSeconds(duration: string): number {
	const segments = duration.split(":")
	if (segments.length !== 3) return 0

	const [hoursPart, minutesPart, secondsPart] = segments
	const hours = Number(hoursPart)
	const minutes = Number(minutesPart)
	const seconds = Number(secondsPart)

	if (
		!Number.isFinite(hours) ||
		!Number.isFinite(minutes) ||
		!Number.isFinite(seconds) ||
		hours < 0 ||
		minutes < 0 ||
		seconds < 0
	) {
		return 0
	}

	return hours * 3600 + minutes * 60 + seconds
}

/**
 * Performs a lightweight microphone preflight before we create backend audio
 * resources, so permission/device failures do not leave empty projects behind.
 */
async function ensureMicrophoneReady(): Promise<void> {
	if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
		throw new Error("getUserMedia is not supported")
	}

	const stream = await navigator.mediaDevices.getUserMedia({
		audio: {
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: true,
		},
	})

	const hasLiveAudioTrack = stream.getAudioTracks().some((track) => track.readyState === "live")
	stream.getTracks().forEach((track) => track.stop())

	if (!hasLiveAudioTrack) {
		throw new Error("no audio tracks available")
	}
}

/**
 * Maps recorder startup errors to stable UI copy while keeping the raw detail
 * visible for debugging and support during the ongoing mobile rollout.
 */
function resolveRecordingStartupErrorContent(error: Error | undefined): {
	message: string
	detail: string
} {
	if (!error) {
		return {
			message: i18next.t("mobile.recordingEntry.active.startFailed", { ns: "super" }),
			detail: "",
		}
	}

	const rawDetail = error.message || error.name || ""
	const normalizedDetail = rawDetail.toLowerCase()

	if (
		normalizedDetail.includes("permission denied") ||
		normalizedDetail.includes("notallowederror") ||
		normalizedDetail.includes("user denied") ||
		normalizedDetail.includes("microphone permission denied")
	) {
		return {
			message: i18next.t("mobile.recordingEntry.active.permissionDenied", { ns: "super" }),
			detail: rawDetail,
		}
	}

	if (
		normalizedDetail.includes("getusermedia is not supported") ||
		normalizedDetail.includes("not supported in this browser") ||
		normalizedDetail.includes("neither mixed audio nor microphone")
	) {
		return {
			message: i18next.t("mobile.recordingEntry.active.browserNotSupported", { ns: "super" }),
			detail: rawDetail,
		}
	}

	if (
		normalizedDetail.includes("no audio tracks available") ||
		normalizedDetail.includes("audio track is not in 'live' state") ||
		normalizedDetail.includes("failed to obtain media stream") ||
		normalizedDetail.includes("failed to initialize microphone audio source")
	) {
		return {
			message: i18next.t("mobile.recordingEntry.active.audioSourceUnavailable", {
				ns: "super",
			}),
			detail: rawDetail,
		}
	}

	if (
		normalizedDetail.includes("recording-start-timeout") ||
		normalizedDetail.includes("failed to start recording")
	) {
		return {
			message: i18next.t("mobile.recordingEntry.active.startTimedOut", { ns: "super" }),
			detail: rawDetail,
		}
	}

	return {
		message: i18next.t("mobile.recordingEntry.active.startFailed", { ns: "super" }),
		detail: rawDetail,
	}
}

interface AudioProjectContext {
	/** Null when the shared filter is All / Ungrouped so the new project stays ungrouped */
	workspace: Workspace | null
	project: ProjectListItem
	topic: Topic
	/** The exact setting persisted when this audio project was created. */
	transcriptionEnabled: boolean
}

export type TranscriptMessage = VoiceResultUtterance & { add_time: number; id: string }

export interface UseRecordingEntryFacadeResult {
	presentation: EntryPresentation
	isSessionActive: boolean
	isRecording: boolean
	isPaused: boolean
	isBusy: boolean
	isImporting: boolean
	startupState: RecordingStartupState
	startupErrorMessage: string
	startupErrorDetail: string
	isPreparingRecordingStart: boolean
	duration: string
	recordingTitle: string
	transcriptMessages: TranscriptMessage[]
	noteContent: string
	transcriptionEnabled: boolean
	isEnablingTranscription: boolean
	optimisticItems: AudioProjectListItem[]
	refreshToken: number
	startRecording: () => Promise<void>
	showRecording: () => void
	showList: () => void
	pauseRecording: () => Promise<void>
	resumeRecording: () => Promise<void>
	cancelRecording: () => Promise<void>
	finishRecording: () => Promise<void>
	updateNote: (nextContent: string) => void
	enableTranscription: () => Promise<void>
	renameRecordingTitle: (nextTitle: string) => Promise<boolean>
	importAudioFiles: (files: FileList) => Promise<void>
	retryImport: (projectId: string) => Promise<void>
	clearOptimisticItem: (projectId: string) => void
	WaveformComponent: ComponentType<{ isRecording: boolean; isPaused: boolean }>
	isOtherTabRecording: boolean
}

/**
 * Resolves the record-summary model by reusing the same mode model registry that
 * powers the legacy expert flow, so the new mobile/PC page does not fork model lookup.
 */
function resolveRecordSummaryModelSync(): ModelItem | null {
	if (recordSummaryStore.businessData.model) return recordSummaryStore.businessData.model
	if (topicModelStore.selectedLanguageModel) return topicModelStore.selectedLanguageModel

	const cachedSettings = getCachedRecordingSettings()
	const preferredModelId = cachedSettings?.model_id
	if (!preferredModelId) return null

	const modelGroups = superMagicModeService.getModelGroupsByMode(TopicMode.RecordSummary) ?? []
	for (const group of modelGroups) {
		const matchedModel = group.models?.find((model) => model.model_id === preferredModelId)
		if (matchedModel) return matchedModel
	}

	return null
}

/**
 * Centralizes the recordings session orchestration while still delegating the
 * actual recording pipeline to the shared record-summary runtime.
 */
export function useRecordingEntryFacade(): UseRecordingEntryFacadeResult {
	const { t } = useTranslation("super")
	const runtime = useRecordingEditorRuntime()
	const recordSummaryService = initializeService()
	// Resolve the web recording source so backend can distinguish H5 vs PC origins;
	// consumed by createAudioProject and seeded onto optimistic cards for immediate icon/label.
	const isMobile = useIsMobile()
	const recordingSource = isMobile ? "h5" : "pc"
	const [presentation, setPresentation] = useState<EntryPresentation>(() => {
		if (recordSummaryStore.status === "init") return "list"
		// Desktop reuses the global FloatPanel; only mobile takes over with full-screen UI.
		return isMobile ? "recording" : "list"
	})
	const [startupState, setStartupState] = useState<RecordingStartupState>("idle")
	const [startupErrorMessage, setStartupErrorMessage] = useState("")
	const [startupErrorDetail, setStartupErrorDetail] = useState("")
	const [isPreparingRecordingStart, setIsPreparingRecordingStart] = useState(false)
	const startRecordingInFlightRef = useRef(false)
	const [transcriptionEnabled, setTranscriptionEnabled] = useState(
		recordSummaryStore.businessData.transcriptionEnabled,
	)
	const [isEnablingTranscription, setIsEnablingTranscription] = useState(false)
	const optimisticItems = audioRecordingsStore.optimisticItems
	const [refreshToken, setRefreshToken] = useState(0)

	const isSessionActive = recordSummaryStore.status !== "init"
	const isBusy =
		recordSummaryStore.isWaitingSummarize ||
		recordSummaryStore.isPausing ||
		recordSummaryStore.isContinuing ||
		runtime.state.isStartingRecord
	const isImporting = audioImportStore.hasUploadingTasks

	/**
	 * Resolves the summary model lazily for deep links into recordings, where
	 * neither topicModelStore nor settings sheet data may have been initialized.
	 */
	const resolveRecordingModel = useCallback(async () => {
		const existingModel = resolveRecordSummaryModelSync()
		if (existingModel) return existingModel

		const groups = await fetchSummaryModelGroups()
		const models = groups.flatMap((group) => group.models ?? [])
		if (!models.length) return null

		const settingsResponse = await getRecordingTopicModel().catch(() => null)
		const preferredModelId =
			getCachedRecordingSettings()?.model_id ??
			settingsResponse?.extra?.model?.model_id ??
			settingsResponse?.model?.model_id ??
			resolveDefaultSummaryModelId(models)

		const matchedModel = models.find((model) => model.model_id === preferredModelId)
		return matchedModel ?? models[0] ?? null
	}, [])

	/**
	 * Creates a new audio project under the group selected at click-time.
	 * Real groups resolve their workspace detail; All / Ungrouped stay ungrouped.
	 */
	const createAudioProjectContext = useCallback(
		async (options: {
			projectName?: string
			taskKey: string
			audioSource: "recorded" | "imported"
			modelId?: string
			autoSummaryEnabled?: boolean
			transcriptionEnabled?: boolean
		}): Promise<AudioProjectContext | null> => {
			// Snapshot the shared PC/H5 list filter at the moment of the action.
			const { groupId } = readAudioRecordingsFilterSession()
			const isVirtualGroup =
				groupId === ALL_RECORDING_GROUP_ID || groupId === UNGROUPED_RECORDING_GROUP_ID

			let workspace: Workspace | null = null
			if (!isVirtualGroup) {
				// Abort creation when the real group cannot be resolved so we never
				// silently fall back into the ungrouped bucket.
				try {
					workspace = await SuperMagicApi.getWorkspaceDetail({ id: groupId })
				} catch {
					return null
				}
				if (!workspace?.id) return null
			}

			const autoSummary =
				options.autoSummaryEnabled ??
				resolveAutoSummaryEnabled(
					getCachedRecordingSettings(),
					await getRecordingTopicModel().catch(() => null),
				)
			const nextTranscriptionEnabled =
				options.transcriptionEnabled ??
				resolveTranscriptionEnabled(
					getCachedRecordingSettings(),
					await getRecordingTopicModel().catch(() => null),
				)

			analyticsService.report("project_create_attempted", {
				workspaceId: workspace?.id,
				sceneOverride: "ai_recording",
				mode: TopicMode.RecordSummary,
			})
			const createdProject = await SuperMagicApi.createAudioProject({
				...(workspace?.id ? { workspace_id: workspace.id } : {}),
				project_name: options.projectName ?? "",
				task_key: options.taskKey,
				auto_summary: autoSummary,
				transcription_enabled: nextTranscriptionEnabled,
				model_id: options.modelId,
				// Distinguish H5 vs PC web origin so list cards can render the right source icon/label
				source: recordingSource,
				device_id: "Web",
				audio_source: options.audioSource,
				// Keep incomplete recordings and imports out of authoritative lists.
				// Existing finish/import endpoints publish the project after usable audio is available.
				is_hidden: true,
			})

			if (!createdProject?.project || !createdProject?.topic) return null
			return {
				workspace,
				project: createdProject.project,
				topic: createdProject.topic,
				transcriptionEnabled: nextTranscriptionEnabled,
			}
		},
		[recordingSource],
	)

	/**
	 * Keeps the entry page in list mode after a recording ends, while still
	 * allowing the first mount during an active shared session to take over.
	 */
	useEffect(() => {
		if (!isSessionActive && startupState === "idle") {
			setPresentation("list")
		}
		if (isSessionActive) {
			setStartupState("idle")
			setStartupErrorMessage("")
			setStartupErrorDetail("")
		}
	}, [isSessionActive, startupState])

	/**
	 * Converts low-level recording startup failures into the inline error state.
	 */
	useEffect(() => {
		return recordSummaryService.on(RECORD_SUMMARY_EVENTS.RECORDING_ERROR, () => {
			const nextContent = resolveRecordingStartupErrorContent(
				recordSummaryStore.errorState.recordingError,
			)
			setStartupState("error")
			setStartupErrorMessage(nextContent.message)
			setStartupErrorDetail(nextContent.detail)
		})
	}, [recordSummaryService])

	/**
	 * Opens the dedicated recording screen without mutating the underlying
	 * recording session, so the list can later resume the same session.
	 */
	const showRecording = useCallback(() => {
		if (!isMobile) {
			expandDesktopRecordingFloatPanel()
			return
		}
		setPresentation("recording")
	}, [isMobile])

	/**
	 * Returns from the full-screen recording page back to the list while keeping
	 * the shared recording session alive.
	 */
	const showList = useCallback(() => {
		setPresentation("list")
		setStartupState("idle")
		setStartupErrorMessage("")
		setStartupErrorDetail("")
	}, [])

	/**
	 * Starts a recording with ensured workspace/project/topic context so the
	 * entry reuses the same backend contract as the legacy expert flow.
	 */
	const startNewRecording = useCallback(async () => {
		if (isMobile) {
			setPresentation("recording")
		}
		setStartupState("starting")
		setStartupErrorMessage("")
		setStartupErrorDetail("")

		let createdProjectId: string | undefined

		try {
			const model = await resolveRecordingModel()
			if (!model) {
				const nextMessage = t("audioRecordings:summary.missingModel", {
					ns: "audioRecordings",
				})
				setStartupState("error")
				setStartupErrorMessage(nextMessage)
				setStartupErrorDetail("")
				toast.error(nextMessage)
				return
			}

			await ensureMicrophoneReady()

			const taskKey = "session-web-" + createRandomUuidV4()
			const settingsResponse = await getRecordingTopicModel().catch(() => null)
			const nextTranscriptionEnabled = resolveTranscriptionEnabled(
				getCachedRecordingSettings(),
				settingsResponse,
			)
			analyticsService.report("ai_recording_start_attempted", {
				isMobile,
				audioSource: "recorded",
				transcriptionEnabled: nextTranscriptionEnabled,
			})

			const audioProjectContext = await createAudioProjectContext({
				projectName: "",
				taskKey,
				audioSource: "recorded",
				modelId: model.model_id,
				transcriptionEnabled: nextTranscriptionEnabled,
			})
			if (!audioProjectContext) {
				const nextMessage = t("mobile.recordingEntry.startMissingWorkspace")
				setStartupState("error")
				setStartupErrorMessage(nextMessage)
				setStartupErrorDetail("")
				toast.error(nextMessage)
				return
			}
			createdProjectId = audioProjectContext.project.id

			if (!isMobile) {
				// Desktop should surface the FloatPanel before runtime startup finishes,
				// otherwise browser mic capture can already be active while the UI still
				// looks idle on the recordings list page.
				expandDesktopRecordingFloatPanel()
			}

			await Promise.race([
				Promise.resolve(
					runtime.actions.startRecording({
						workspace: audioProjectContext.workspace,
						project: audioProjectContext.project,
						topic: audioProjectContext.topic,
						selectedTopic: audioProjectContext.topic,
						model,
						audioSource: "microphone",
						sessionId: taskKey,
						transcriptionEnabled: nextTranscriptionEnabled,
					}),
				),
				new Promise((_, reject) => {
					window.setTimeout(() => {
						reject(new Error("recording-start-timeout"))
					}, RECORDING_START_TIMEOUT_MS)
				}),
			])

			if (!recordSummaryStore.isRecording && !runtime.state.isRecording) {
				throw new Error("recording-start-failed")
			}

			setStartupState("idle")
			setStartupErrorMessage("")
			setStartupErrorDetail("")
			setTranscriptionEnabled(nextTranscriptionEnabled)
		} catch (error) {
			const hasActiveRecording = recordSummaryStore.isRecording || runtime.state.isRecording
			if (createdProjectId && !hasActiveRecording) {
				// Startup failed after creating a placeholder project; clean it up to avoid empty cards.
				void SuperMagicApi.deleteProject({ id: createdProjectId }).catch(() => undefined)
			}

			const nextContent = resolveRecordingStartupErrorContent(
				error instanceof Error ? error : undefined,
			)
			setStartupState("error")
			setStartupErrorMessage(nextContent.message)
			setStartupErrorDetail(nextContent.detail)
			if (!isMobile && !hasActiveRecording) {
				collapseDesktopRecordingFloatPanel()
			}
			toast.error(nextContent.message)
		}
	}, [
		isMobile,
		createAudioProjectContext,
		recordingSource,
		resolveRecordingModel,
		runtime.actions,
		runtime.state.isRecording,
		t,
	])

	const startRecording = useCallback(async () => {
		if (startRecordingInFlightRef.current) return
		startRecordingInFlightRef.current = true
		setIsPreparingRecordingStart(true)
		try {
			const overrideContext = await recordSummaryService.getRecordingOverrideContext()
			if (overrideContext) {
				const prepared = await runForceRecordingOverride(
					overrideContext,
					() => recordSummaryService.prepareRecordingOverride(overrideContext.sessionId),
					() =>
						recordSummaryService.releaseOverrideSessionForForceStart(
							overrideContext.sessionId,
						),
				)
				if (!prepared) return

				await startNewRecording()
				return
			}

			// Preserve the previous fallback when the shared store changes between
			// conflict detection and startup, instead of creating a second session.
			if (recordSummaryStore.isOtherTabRecording) {
				toast.error(
					t("recordingSummary.superEditorPanel.warning.recordingInProgressOtherTab"),
				)
				return
			}

			if (recordSummaryStore.status !== "init") {
				if (!isMobile) {
					expandDesktopRecordingFloatPanel()
					return
				}
				setPresentation("recording")
				return
			}

			await startNewRecording()
		} catch {
			toast.error(t("recordingSummary.recordErrorModal.title"))
		} finally {
			startRecordingInFlightRef.current = false
			setIsPreparingRecordingStart(false)
		}
	}, [isMobile, recordSummaryService, startNewRecording, t])

	/**
	 * Pauses the shared recording session.
	 */
	const pauseRecording = useCallback(async () => {
		try {
			await recordSummaryService.pauseRecording()
		} catch {
			toast.error(t("recordingSummary.recordErrorModal.title"))
		}
	}, [recordSummaryService, t])

	/**
	 * Resumes the shared recording session.
	 */
	const resumeRecording = useCallback(async () => {
		try {
			await recordSummaryService.continueRecording()
		} catch {
			toast.error(t("recordingSummary.recordErrorModal.title"))
		}
	}, [recordSummaryService, t])

	/**
	 * Cancels the current recording entirely and returns the page to the list view.
	 */
	const cancelRecording = useCallback(async () => {
		try {
			await runtime.actions.cancelRecording()
			setPresentation("list")
			setStartupState("idle")
			setStartupErrorMessage("")
			setStartupErrorDetail("")
		} catch {
			toast.error(t("recordingSummary.recordErrorModal.title"))
		}
	}, [runtime.actions, t])

	/**
	 * Resolves auto-summary preference from cache first, then persisted default_audio settings.
	 */
	const resolveAutoSummaryForSession = useCallback(async () => {
		const cachedSettings = getCachedRecordingSettings()
		if (cachedSettings) return cachedSettings.auto_summary_enabled

		const settingsResponse = await getRecordingTopicModel().catch(() => null)
		return resolveAutoSummaryEnabled(null, settingsResponse)
	}, [])

	/**
	 * Completes the recording and seeds an optimistic list card matching summary intent.
	 */
	const finishRecording = useCallback(async () => {
		try {
			const autoSummaryEnabled = await resolveAutoSummaryForSession()

			await runtime.actions.finishRecording({
				skipSummary: !autoSummaryEnabled,
				onSuccess: (result) => {
					const localDurationSeconds = parseHmsDurationToSeconds(runtime.state.duration)

					audioRecordingsStore.addOptimisticItem(
						(() => {
							const optimisticItem = buildOptimisticRecordingItem({
								projectId: result.project_id,
								projectName: result.project_name,
								workspaceId: result.workspace_id,
								modelId: result.model_id,
								duration: localDurationSeconds,
								// task_key is required for manual "Generate Summary" after skipSummary finish.
								taskKey: result.task_key,
								topicId: result.topic_id,
								source: recordingSource,
								autoSummaryEnabled,
							})

							// Manual-summary recorded sessions must first complete the backend
							// merge stage before the list exposes the Generate Summary action.
							if (!autoSummaryEnabled) {
								optimisticItem.current_phase = "merging"
								optimisticItem.phase_status = "in_progress"
								optimisticItem.card_status =
									resolveCardStatusFromListItem(optimisticItem)
							}

							return optimisticItem
						})(),
					)
					setRefreshToken((currentToken) => currentToken + 1)
					setPresentation("list")
					setStartupState("idle")
					setStartupErrorMessage("")
					setStartupErrorDetail("")
				},
			})
		} catch {
			toast.error(t("recordingSummary.message.summaryGenerationFailed"))
		}
	}, [resolveAutoSummaryForSession, runtime.actions, runtime.state.duration, recordingSource, t])

	/**
	 * Updates the lightweight recording note content in-place.
	 */
	const updateNote = useCallback(
		(nextContent: string) => {
			recordSummaryService.updateNote(nextContent)
		},
		[recordSummaryService],
	)

	/**
	 * Enables realtime transcription for the current session and persists the preference for future recordings.
	 */
	const enableTranscription = useCallback(async () => {
		if (transcriptionEnabled || isEnablingTranscription) return

		setIsEnablingTranscription(true)
		try {
			const apiResponse = await getRecordingTopicModel()
			const cachedSettings = getCachedRecordingSettings()
			const nextSettings = {
				transcription_enabled: true,
				auto_summary_enabled: resolveAutoSummaryEnabled(cachedSettings, apiResponse),
				model_id:
					cachedSettings?.model_id ||
					apiResponse.extra?.model?.model_id ||
					apiResponse.model?.model_id ||
					recordSummaryStore.businessData.model?.model_id ||
					"",
			}

			await saveRecordingTopicModel(settingsToApiPayload(nextSettings, apiResponse))
			patchCachedRecordingSettings({ transcription_enabled: true })
			await recordSummaryService.enableTranscriptionForCurrentSession()
			setTranscriptionEnabled(true)
		} catch {
			toast.error(t("mobile.recordingEntry.active.enableTranscriptionFailed"))
		} finally {
			setIsEnablingTranscription(false)
		}
	}, [isEnablingTranscription, recordSummaryService, t, transcriptionEnabled])

	/**
	 * Persists title edits to the shared audio-recordings backend.
	 */
	const renameRecordingTitle = useCallback(
		async (nextTitle: string): Promise<boolean> => {
			const trimmedTitle = nextTitle.trim()
			if (!trimmedTitle) return false

			const currentProject = recordSummaryStore.businessData.project
			if (!currentProject?.id) {
				toast.error(t("audioRecordings:actions.renameFailed", { ns: "audioRecordings" }))
				return false
			}

			try {
				await audioRecordingsService.renameProject(currentProject.id, trimmedTitle)
				await recordSummaryService.updateProject({
					...currentProject,
					project_name: trimmedTitle,
				})
				toast.success(t("audioRecordings:actions.renameSuccess", { ns: "audioRecordings" }))
				return true
			} catch {
				toast.error(t("audioRecordings:actions.renameFailed", { ns: "audioRecordings" }))
				return false
			}
		},
		[recordSummaryService, t],
	)

	const clearOptimisticItem = useCallback((projectId: string) => {
		// Cancel any active upload task first (no-op when no task exists, e.g. after
		// upload completed or for recorded items that never create an import task).
		audioImportStore.cancelImport(projectId)
		// Unconditionally remove the optimistic placeholder from the store. The
		// cancelImport call above early-returns when importingTasks has no entry
		// for this project, which would otherwise skip the clear and leave stale
		// optimistic items in the list forever.
		audioRecordingsStore.clearOptimisticItem(projectId)
	}, [])

	const retryImport = useCallback(async (projectId: string) => {
		await audioImportStore.retryImport(projectId)
	}, [])

	const importAudioFiles = useCallback(
		async (files: FileList) => {
			const normalizedFiles = Array.from(files)
			if (!normalizedFiles.length) return

			const model = await resolveRecordingModel()
			if (!model) {
				toast.error(t("audioRecordings:summary.missingModel", { ns: "audioRecordings" }))
				return
			}

			const taskKey = "session-web-" + createRandomUuidV4()
			const autoSummaryEnabled = resolveAutoSummaryEnabled(
				getCachedRecordingSettings(),
				await getRecordingTopicModel().catch(() => null),
			)
			const nextTranscriptionEnabled = resolveTranscriptionEnabled(
				getCachedRecordingSettings(),
				await getRecordingTopicModel().catch(() => null),
			)
			analyticsService.report("ai_recording_start_attempted", {
				isMobile,
				audioSource: "imported",
				transcriptionEnabled: nextTranscriptionEnabled,
			})

			const audioProjectContext = await createAudioProjectContext({
				projectName: normalizedFiles[0]?.name,
				taskKey,
				audioSource: "imported",
				modelId: model.model_id,
				autoSummaryEnabled,
				transcriptionEnabled: nextTranscriptionEnabled,
			})
			if (!audioProjectContext) {
				toast.error(t("mobile.recordingEntry.startMissingWorkspace"))
				return
			}

			// Immediately seed a transferring card.
			const initialOptimisticItem = buildOptimisticRecordingItem({
				projectId: audioProjectContext.project.id,
				projectName: normalizedFiles[0]?.name || audioProjectContext.project.project_name,
				workspaceId: audioProjectContext.workspace?.id ?? UNGROUPED_RECORDING_GROUP_ID,
				modelId: model.model_id,
				taskKey,
				audioSource: "imported",
				topicId: audioProjectContext.topic.id,
				source: recordingSource,
			})
			initialOptimisticItem.transferStatus = "transferring"
			initialOptimisticItem.transferProgress = 0
			initialOptimisticItem.card_status = resolveCardStatusFromListItem(initialOptimisticItem)

			audioRecordingsStore.addOptimisticItem(initialOptimisticItem)

			await audioImportStore.startAudioImport(normalizedFiles, {
				projectId: audioProjectContext.project.id,
				projectName: normalizedFiles[0]?.name || audioProjectContext.project.project_name,
				topicId: audioProjectContext.topic.id,
				workspaceId: audioProjectContext.workspace?.id ?? UNGROUPED_RECORDING_GROUP_ID,
				modelId: model.model_id,
				taskKey,
				autoSummaryEnabled,
			})
		},
		[createAudioProjectContext, isMobile, resolveRecordingModel, recordingSource, t],
	)

	return {
		presentation,
		isSessionActive,
		isRecording: runtime.state.isRecording,
		isPaused: runtime.state.isPaused,
		isBusy,
		isImporting,
		startupState,
		startupErrorMessage,
		startupErrorDetail,
		isPreparingRecordingStart,
		duration: runtime.state.duration,
		recordingTitle:
			recordSummaryStore.businessData.project?.project_name ||
			recordSummaryStore.businessData.topic?.topic_name ||
			t("mobile.recordingEntry.active.defaultTitle"),
		transcriptMessages: recordSummaryStore.message,
		noteContent: recordSummaryStore.note.content,
		transcriptionEnabled,
		isEnablingTranscription,
		optimisticItems,
		refreshToken,
		startRecording,
		showRecording,
		showList,
		pauseRecording,
		resumeRecording,
		cancelRecording,
		finishRecording,
		updateNote,
		enableTranscription,
		renameRecordingTitle,
		importAudioFiles,
		retryImport,
		clearOptimisticItem,
		WaveformComponent: runtime.WaveformComponent,
		isOtherTabRecording: recordSummaryStore.isOtherTabRecording,
	}
}
