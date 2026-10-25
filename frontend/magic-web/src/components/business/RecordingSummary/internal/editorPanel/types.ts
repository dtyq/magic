import type { ComponentType, ReactNode } from "react"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import type { MessageEditorSize } from "@/pages/superMagic/components/MessageEditor/types"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { AudioSourceType } from "@/services/recordSummary/MediaRecorderService/types/RecorderTypes"
import type { GetRecordingSummaryResultResponse } from "@/apis/modules/superMagic/recordSummary"

export interface RecordSummaryEditorPanelProps {
	selectedTopic: Topic | null
	selectedProject: ProjectListItem | null
	selectedWorkspace: Workspace | null | undefined
	size: MessageEditorSize
	iconSize: number
	topicMode?: TopicMode
	isTaskRunning?: boolean
	editorModeSwitch?: ({ disabled }: { disabled: boolean }) => ReactNode
	selectedModel?: ModelItem | null
	selectedImageModel?: ModelItem | null
	selectedVideoModel?: ModelItem | null
	modelSwitch?: ReactNode
	attachments?: AttachmentItem[]
	taskDataNode?: ReactNode
	messageQueueNode?: ReactNode
	className?: string
	containerClassName?: string
	/** Fill the negotiated conversation height while the editor is in the idle state. */
	fillHeight?: boolean
	/** Returning false stops a homepage start before a project is created. */
	beforeRecordingStart?: () => Promise<boolean>
	/** Topic mode used when recording must create the project first. */
	recordingNewProjectTopicMode?: TopicMode
	/** When false, hide the control that records into an existing project. */
	allowSelectRecordingProject?: boolean
}

export interface RecordSummaryEditorPanelRef {
	saveSuperMagicTopicModel: (params: {
		selectedTopic: Topic
		model: ModelItem
		imageModel: ModelItem | null
		videoModel?: ModelItem | null
	}) => void
}

export interface RecordingSessionIdentity {
	workspaceId?: string
	projectId?: string
	topicId?: string
}

export interface RecordingEditorRuntimeState {
	isRecording: boolean
	isPaused: boolean
	duration: string
	isStartingRecord: boolean
	currentSession: RecordingSessionIdentity
}

export interface RecordingEditorStartParams {
	/** Nullable so audio recordings can start from All / Ungrouped without a workspace shell */
	workspace: Workspace | null
	project: ProjectListItem
	topic: Topic | null
	selectedTopic: Topic | null
	model: ModelItem
	audioSource: AudioSourceType
	sessionId?: string
	/** Whether realtime transcription should start with this recording session */
	transcriptionEnabled?: boolean
}

export interface RecordingEditorFinishOptions {
	/** When true, upload chunks but do not call the summarize API (manual summary later) */
	skipSummary?: boolean
	onSuccess?: (
		res: GetRecordingSummaryResultResponse & {
			model_id: string
			workspace_id: string
			project_name: string
			current_phase?: string
			phase_status?: string
		},
	) => void
	onError?: (error: Error) => void
}

export interface RecordingEditorRuntimeActions {
	startRecording: (params: RecordingEditorStartParams) => Promise<void> | void
	finishRecording: (options?: RecordingEditorFinishOptions) => Promise<void> | void
	openCurrentRecording: () => void
	cancelRecording: () => Promise<unknown> | void
}

export interface RecordingEditorWaveformProps {
	isRecording: boolean
	isPaused: boolean
}

export interface RecordingEditorRuntime {
	state: RecordingEditorRuntimeState
	actions: RecordingEditorRuntimeActions
	WaveformComponent: ComponentType<RecordingEditorWaveformProps>
}

export type RecordingEditorPanelMode = "recording" | "blocked" | "idle"
