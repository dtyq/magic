import { useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn, useDebounceFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import ModelSwitchContainer from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/ModelSwitchContainer"
import { useMessageEditorStore } from "@/pages/superMagic/components/MessageEditor/stores"
import superMagicTopicModelService from "@/services/superMagic/topicModel/SuperMagicTopicModelService"
import { initializeService as initializeRecordSummaryService } from "@/services/recordSummary/serviceInstance"
import recordSummaryStore from "@/stores/recordingSummary"
import { useIsMobile } from "@/hooks/useIsMobile"
import useCancelRecord from "@/components/business/RecordingSummary/hooks/useCancelRecord"
import { useIsCurrentRecording } from "@/components/business/RecordingSummary/hooks/useisCurrentRecording"
import useProjectSelector from "@/components/business/RecordingSummary/components/ProjectSelector/hooks/useProjectSelector"
import { useProjectWorkspaceSelector } from "@/components/business/RecordingSummary/hooks/useProjectWorkspaceSelector"
import AudioSourceSelector from "@/components/business/RecordingSummary/components/AudioSourceSelector"
import { RECORD_SUMMARY_EVENTS } from "@/services/recordSummary/const/events"
import { onSummarizeSuccessDefaultCallback } from "@/components/business/RecordingSummary/utils/callback"
import useChooseUploadDirModal from "@/pages/superMagic/components/MessageEditor/hooks/useChooseUploadDirModal"
import { useFileUpload } from "@/pages/superMagic/components/MessageEditor/hooks/useFileUpload"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { transformUploadFileToProjectFile } from "@/pages/superMagic/components/MessageEditor/utils/mention"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import SuperMagicService from "@/pages/superMagic/services"
import type { AudioSourceType } from "@/services/recordSummary/MediaRecorderService/types/RecorderTypes"
import { type Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { getFallbackTopicModeIdentifier } from "@/services/superMagic/DefaultAgentSelectionService"
import { getEditorPanelMode } from "./getEditorPanelMode"
import { useRecordingEditorRuntime } from "../editorRuntime"
import type { RecordSummaryEditorPanelProps, RecordSummaryEditorPanelRef } from "./types"
import {
	sendSuperMagicInterruptMessage,
	SUPER_MAGIC_INTERRUPT_DEBOUNCE_MS,
} from "@/pages/superMagic/services/sendSuperMagicInterruptMessage"
import { userStore } from "@/models/user"
import { runForceRecordingOverride } from "@/components/business/RecordingSummary/utils/force-recording-override"
import {
	getHomepageRecordingStartBlocker,
	resolveEnsuredRecordingTopicMode,
	resolveRecordingStartContext,
	resolveSelectedProjectStartContext,
	type HomepageRecordingStartBlocker,
	type RecordingStartContext,
} from "./recordingStartContext"

type SaveSuperMagicTopicModel = RecordSummaryEditorPanelRef["saveSuperMagicTopicModel"]

export function useRecordSummaryEditorPanelController({
	selectedTopic,
	selectedProject,
	selectedWorkspace,
	size,
	topicMode,
	isTaskRunning = false,
	editorModeSwitch,
	modelSwitch,
	attachments,
	beforeRecordingStart,
	recordingNewProjectTopicMode,
	allowSelectRecordingProject,
}: RecordSummaryEditorPanelProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const recordSummaryService = initializeRecordSummaryService()
	const runtime = useRecordingEditorRuntime()
	const store = useMessageEditorStore()

	const isCurrentRecording = useIsCurrentRecording(
		selectedTopic,
		selectedProject,
		selectedWorkspace,
	)

	const saveSuperMagicTopicModel = useMemoizedFn<SaveSuperMagicTopicModel>(
		({ selectedTopic: topic, model, imageModel, videoModel }) => {
			if (!selectedProject?.id) {
				console.error("selectedProject is null")
				return
			}

			superMagicTopicModelService.saveModel(
				topic.id,
				selectedProject.id,
				model,
				imageModel,
				videoModel,
				store.topicModelStore,
			)
		},
	)

	const sendBuiltinInterrupt = useMemoizedFn(() => {
		void sendSuperMagicInterruptMessage({
			selectedTopic,
			userId: userStore.user.userInfo?.user_id,
		})
	})

	const { run: debouncedInterrupt } = useDebounceFn(sendBuiltinInterrupt, {
		wait: SUPER_MAGIC_INTERRUPT_DEBOUNCE_MS,
		leading: true,
		trailing: false,
	})

	const selectedModel = store.topicModelStore.selectedLanguageModel
	const isModelReady = store.topicModelStore.isLanguageModelReady
	const [uploadFileId, setUploadFileId] = useState<string | null>(null)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [selectedAudioSource, setSelectedAudioSource] = useState<AudioSourceType>("microphone")
	const [isPreparingRecordingStart, setIsPreparingRecordingStart] = useState(false)
	const startRecordingInFlightRef = useRef(false)

	const {
		uploading,
		addFiles: addUploadedFiles,
		validateFileSize,
		validateFileCount,
		removeFile,
	} = useFileUpload({
		maxUploadCount: 1,
		maxUploadSize: 1024 * 1024 * 500,
		projectId: selectedProject?.id ?? "",
		topicId: selectedTopic?.id ?? "",
		onFileAdded(fileId) {
			setUploadFileId(fileId[0].id)
			setUploadProgress(0)
		},
		onFileProgressUpdate(_, progress) {
			setUploadProgress(progress)
		},
		onFileCompleted(fileId, reportResult, saveResult) {
			console.log(fileId, reportResult, saveResult)

			if (saveResult) {
				const projectFileMentionData = transformUploadFileToProjectFile(
					{
						file_id: reportResult?.file_id || "",
						file_name: reportResult?.file_name || "",
						file_path: reportResult?.file_key || "",
						file_extension: reportResult?.file_extension || "",
						file_size: reportResult?.file_size || 0,
					},
					saveResult,
				)

				pubsub.publish(PubSubEvents.Receive_RecordSummary_Audio_File, {
					type: MentionItemType.PROJECT_FILE,
					data: projectFileMentionData,
				})
				return
			}

			pubsub.publish(PubSubEvents.Receive_RecordSummary_Audio_File, {
				type: MentionItemType.UPLOAD_FILE,
				data: {
					file_id: reportResult?.file_id || "",
					file_name: reportResult?.file_name || "",
					file_path: reportResult?.file_key || "",
					file_extension: reportResult?.file_extension || "",
					file_size: reportResult?.file_size || 0,
				},
			})
		},
	})

	const { addFilesWithDir: addFiles, UploadModal } = useChooseUploadDirModal({
		addFiles: addUploadedFiles,
		selectedProject,
		attachments,
		validateFileSize,
		validateFileCount,
	})

	const { cancelRecordFromUI: cancelRecord } = useCancelRecord({
		onSummarizeSuccess: (result) => {
			onSummarizeSuccessDefaultCallback(result)
		},
	})

	const { selection, updateSelection, clearSelection } = useProjectWorkspaceSelector()
	const selectedProjectFromSelector = selection.project
	const selectedWorkspaceFromSelector = selection.workspace

	const { ProjectSelectorComponent, openSelectorWithResult } = useProjectSelector({
		initialProject: selectedProjectFromSelector || null,
		initialWorkspace: selectedWorkspaceFromSelector || null,
		onProjectSelectConfirm: (data) => {
			updateSelection({
				project: data.project,
				workspace: data.workspace,
			})
		},
	})

	const notifyHomepageRecordingStartBlocked = useMemoizedFn(
		(blocker: HomepageRecordingStartBlocker) => {
			if (blocker === "missingWorkspace") {
				toast.error(t("recordingSummary.superEditorPanel.warning.missingWorkspace"))
				return
			}

			toast.error(t("recordingSummary.superEditorPanel.warning.missingModel"))
		},
	)

	const startNewRecording = useMemoizedFn(
		async (mode: "new" | "current" = "new", startContext?: RecordingStartContext) => {
			const resolvedContext =
				startContext ??
				resolveRecordingStartContext({
					selectedWorkspace,
					selectedProject,
					selectedTopic,
					selectedModel,
				})
			const nextWorkspace = resolvedContext.workspace
			const nextProject = resolvedContext.project
			const nextTopic = resolvedContext.topic
			const nextModel = resolvedContext.model
			const startBlocker = getHomepageRecordingStartBlocker(resolvedContext)

			if ((!startContext && !isModelReady) || startBlocker) {
				console.error("workspace, topic, project, model not selected")
				if (startBlocker) notifyHomepageRecordingStartBlocked(startBlocker)
				return
			}

			let workspace: Workspace | null = nextWorkspace
			let project = nextProject
			let topic = nextTopic

			if (mode === "current") {
				const { project: nextProject, workspace: nextWorkspace } =
					await openSelectorWithResult()
				project = nextProject
				workspace = nextWorkspace
			}

			if (!topic || !project) {
				const { project: ensuredProject, topic: ensuredTopic } =
					await recordSummaryService.ensureProjectAndTopic(
						{
							workspace,
							project,
						},
						{
							topicMode: resolveEnsuredRecordingTopicMode({
								hasProject: Boolean(nextProject),
								recordingNewProjectTopicMode,
								fallbackTopicMode: getFallbackTopicModeIdentifier(),
							}),
						},
					)

				if (!project) {
					recordSummaryService.emit(
						RECORD_SUMMARY_EVENTS.UPDATE_EMPTY_WORKSPACE_PANEL_PROJECTS,
						{
							topicId: ensuredTopic?.id,
							projectId: ensuredProject?.id,
							workspaceId: workspace?.id || "",
						},
					)
				}

				project = ensuredProject
				topic = ensuredTopic
			}

			if (!nextModel || !project) {
				console.error("project or model not selected")
				return
			}

			await runtime.actions.startRecording({
				workspace,
				project,
				topic,
				selectedTopic,
				model: nextModel,
				audioSource: selectedAudioSource,
			})

			if (selectedProjectFromSelector && selectedWorkspaceFromSelector) {
				clearSelection()
			}
		},
	)

	const handleCompleteRecordingWithSummary = useMemoizedFn(() => {
		runtime.actions.finishRecording({
			onSuccess: (result) => {
				console.log(result)
				onSummarizeSuccessDefaultCallback(result)
			},
			onError: (error) => {
				console.log(error)
			},
		})
	})

	const handleStartRecording = useMemoizedFn(async (mode: "new" | "current" = "new") => {
		if (startRecordingInFlightRef.current) return
		startRecordingInFlightRef.current = true
		// Show the preparing state before the async gate so a repeated tap reads as
		// ignored instead of being silently dropped by the in-flight ref.
		setIsPreparingRecordingStart(true)
		try {
			// Homepage send validates the workspace before creating anything. Do the same
			// before replacing an in-progress recording or creating a project.
			if (beforeRecordingStart && !(await beforeRecordingStart())) return

			// Resolve the destination before override so a missing workspace or
			// model cannot finish the current recording and then fail to start.
			let selectedStartContext: RecordingStartContext | undefined
			if (mode === "current") {
				const pickedContext = await resolveSelectedProjectStartContext({
					openSelector: openSelectorWithResult,
					selectedModel,
				})
				if (!pickedContext) return
				selectedStartContext = pickedContext
			} else {
				const homepageStartContext = resolveRecordingStartContext({
					selectedWorkspace,
					selectedProject,
					selectedTopic,
					selectedModel,
				})
				const startBlocker = getHomepageRecordingStartBlocker(homepageStartContext)
				if (startBlocker) {
					notifyHomepageRecordingStartBlocked(startBlocker)
					return
				}
				selectedStartContext = homepageStartContext
			}

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
			}

			await startNewRecording("new", selectedStartContext)
		} finally {
			startRecordingInFlightRef.current = false
			setIsPreparingRecordingStart(false)
		}
	})

	const handleCancelUpload = useMemoizedFn(() => {
		if (uploadFileId) {
			removeFile(uploadFileId)
		}
	})

	const handleUploadFile = useMemoizedFn(async (fileList: FileList) => {
		try {
			const files = Array.from(fileList)

			if (files.length === 0) {
				console.error("fileList is empty")
				return
			}

			if (!selectedWorkspace?.id) {
				console.error("workspace not selected")
				return
			}

			addFiles(files)
		} catch (error) {
			console.error(error)
		} finally {
			setUploadProgress(0)
		}
	})

	const handleAudioSourceChange = useMemoizedFn((audioSource: AudioSourceType) => {
		setSelectedAudioSource(audioSource)
	})

	useEffect(() => {
		return recordSummaryService.on(
			RECORD_SUMMARY_EVENTS.UPDATE_EMPTY_WORKSPACE_PANEL_PROJECTS,
			() => {
				if (!selectedWorkspace?.id) return

				SuperMagicService.project.fetchProjects({
					workspaceId: selectedWorkspace.id,
					clearWhenNoProjects: false,
				})
			},
		)
	}, [recordSummaryService, selectedWorkspace?.id])

	const leftToolbar = useMemo(
		() => (
			<>
				{modelSwitch ?? (
					<ModelSwitchContainer
						size={size}
						selectedTopic={selectedTopic}
						selectedProject={selectedProject}
						topicMode={topicMode}
					/>
				)}
			</>
		),
		[modelSwitch, selectedProject, selectedTopic, size, topicMode],
	)

	const audioSourceSelector = !isMobile ? (
		<AudioSourceSelector
			value={selectedAudioSource}
			onChange={handleAudioSourceChange}
			size={size}
			disabled={runtime.state.isStartingRecord || isPreparingRecordingStart || uploading}
		/>
	) : null

	const isSmall = size === "small"
	const panelMode = getEditorPanelMode({
		isRecording: runtime.state.isRecording,
		isPaused: runtime.state.isPaused,
		isCurrentRecording,
		isOtherTabRecording: recordSummaryStore.isOtherTabRecording,
		isMediaRecorderNotSupported: recordSummaryStore.isMediaRecorderNotSupported,
	})

	return {
		WaveformComponent: runtime.WaveformComponent,
		ProjectSelectorComponent,
		UploadModal,
		audioSourceSelector,
		cancelRecord,
		duration: runtime.state.duration,
		editorModeSwitch,
		handleCancelUpload,
		handleCompleteRecordingWithSummary,
		handleStartRecording,
		handleUploadFile,
		isMediaRecorderNotSupported: recordSummaryStore.isMediaRecorderNotSupported,
		isModelReady,
		isOtherTabRecording: recordSummaryStore.isOtherTabRecording,
		isPaused: runtime.state.isPaused,
		isRecording: runtime.state.isRecording,
		isSmall,
		isMobile,
		isStartingRecord: runtime.state.isStartingRecord || isPreparingRecordingStart,
		isTaskRunning,
		isWaitingSummarize: recordSummaryStore.isWaitingSummarize,
		leftToolbar,
		onInterrupt: debouncedInterrupt,
		panelMode,
		saveSuperMagicTopicModel,
		selectedProjectId: selectedProject?.id,
		allowSelectRecordingProject,
		size,
		uploading,
		uploadProgress,
	}
}
