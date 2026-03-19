import { useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
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
import { TopicMode, type Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { getEditorPanelMode } from "./getEditorPanelMode"
import { useRecordingEditorRuntime } from "../editorRuntime"
import type { RecordSummaryEditorPanelProps, RecordSummaryEditorPanelRef } from "./types"

type SaveSuperMagicTopicModel = RecordSummaryEditorPanelRef["saveSuperMagicTopicModel"]

export function useRecordSummaryEditorPanelController({
	selectedTopic,
	selectedProject,
	selectedWorkspace,
	size,
	topicMode,
	isTaskRunning = false,
	onInterrupt,
	editorModeSwitch,
	attachments,
}: RecordSummaryEditorPanelProps) {
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
		({ selectedTopic: topic, model, imageModel }) => {
			if (!selectedProject?.id) {
				console.error("selectedProject is null")
				return
			}

			superMagicTopicModelService.saveModel(
				topic.id,
				selectedProject.id,
				model,
				imageModel,
				store.topicModelStore,
			)
		},
	)

	const selectedModel = store.topicModelStore.selectedLanguageModel
	const [uploadFileId, setUploadFileId] = useState<string | null>(null)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [selectedAudioSource, setSelectedAudioSource] = useState<AudioSourceType>("microphone")

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

	const { cancelRecord } = useCancelRecord({
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

	const handleStartRecording = useMemoizedFn(async (mode: "new" | "current" = "new") => {
		if (!selectedWorkspace?.id || !selectedModel?.model_id) {
			console.error("workspace, topic, project, model not selected")
			return
		}

		let workspace: Workspace | null = selectedWorkspace
		let project = selectedProject
		let topic = selectedTopic

		if (mode === "current") {
			const { project: nextProject, workspace: nextWorkspace } =
				await openSelectorWithResult()
			project = nextProject
			workspace = nextWorkspace
		}

		if (!workspace) {
			console.error("workspace not selected")
			return
		}

		if (!topic || !project) {
			const { project: ensuredProject, topic: ensuredTopic } =
				await recordSummaryService.ensureProjectAndTopic(
					{
						workspace,
						project,
					},
					{
						topicMode: selectedProject ? TopicMode.RecordSummary : TopicMode.General,
					},
				)

			if (!project) {
				recordSummaryService.emit(
					RECORD_SUMMARY_EVENTS.UPDATE_EMPTY_WORKSPACE_PANEL_PROJECTS,
					{
						topicId: ensuredTopic?.id,
						projectId: ensuredProject?.id,
						workspaceId: workspace.id || "",
					},
				)
			}

			project = ensuredProject
			topic = ensuredTopic
		}

		if (!selectedModel || !project) {
			console.error("project or model not selected")
			return
		}

		await runtime.actions.startRecording({
			workspace,
			project,
			topic,
			selectedTopic,
			model: selectedModel,
			audioSource: selectedAudioSource,
		})

		if (selectedProjectFromSelector && selectedWorkspaceFromSelector) {
			clearSelection()
		}
	})

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

	const handleOpenCurrentRecording = useMemoizedFn(() => {
		runtime.actions.openCurrentRecording()
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
				<ModelSwitchContainer
					size={size}
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					topicMode={topicMode}
				/>
			</>
		),
		[selectedProject, selectedTopic, size, topicMode],
	)

	const audioSourceSelector = !isMobile ? (
		<AudioSourceSelector
			value={selectedAudioSource}
			onChange={handleAudioSourceChange}
			size={size}
			disabled={runtime.state.isStartingRecord || uploading}
		/>
	) : null

	const isSmall = size === "small" || size === "mobile"
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
		handleOpenCurrentRecording,
		handleStartRecording,
		handleUploadFile,
		isCurrentRecording,
		isMediaRecorderNotSupported: recordSummaryStore.isMediaRecorderNotSupported,
		isOtherTabRecording: recordSummaryStore.isOtherTabRecording,
		isPaused: runtime.state.isPaused,
		isRecording: runtime.state.isRecording,
		isSmall,
		isStartingRecord: runtime.state.isStartingRecord,
		isTaskRunning,
		isWaitingSummarize: recordSummaryStore.isWaitingSummarize,
		leftToolbar,
		onInterrupt,
		panelMode,
		saveSuperMagicTopicModel,
		selectedProjectId: selectedProject?.id,
		size,
		uploading,
		uploadProgress,
	}
}
