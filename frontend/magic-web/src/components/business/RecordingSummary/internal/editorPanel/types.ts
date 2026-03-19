import type { ComponentType, ReactNode } from "react"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import type { MessageEditorSize } from "@/pages/superMagic/components/MessageEditor/types"
import type {
	ProjectListItem,
	Topic,
	TopicMode,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
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
	onInterrupt?: () => void
	editorModeSwitch?: ({ disabled }: { disabled: boolean }) => ReactNode
	selectedModel?: ModelItem | null
	selectedImageModel?: ModelItem | null
	modelSwitch?: ReactNode
	attachments?: AttachmentItem[]
	taskDataNode?: ReactNode
	messageQueueNode?: ReactNode
	className?: string
	containerClassName?: string
}

export interface RecordSummaryEditorPanelRef {
	saveSuperMagicTopicModel: (params: {
		selectedTopic: Topic
		model: ModelItem
		imageModel: ModelItem | null
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
	workspace: Workspace
	project: ProjectListItem
	topic: Topic | null
	selectedTopic: Topic | null
	model: ModelItem
	audioSource: AudioSourceType
}

export interface RecordingEditorFinishOptions {
	onSuccess?: (
		res: GetRecordingSummaryResultResponse & {
			model_id: string
			workspace_id: string
			project_name: string
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
