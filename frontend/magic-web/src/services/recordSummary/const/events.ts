import { RecordingSession } from "@/types/recordSummary"
import { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"

export const enum RECORD_SUMMARY_EVENTS {
	/**
	 * 录音时长超出限制
	 */
	RECORDING_DURATION_EXCEEDED = "recordingDurationExceeded",
	/**
	 * 录音异常
	 */
	RECORDING_ERROR = "recordingError",
	/**
	 * 录音完成
	 */
	RECORDING_COMPLETE = "recordingComplete",
	/**
	 * 更新空工作空间面板项目
	 */
	UPDATE_EMPTY_WORKSPACE_PANEL_PROJECTS = "updateEmptyWorkspacePanelProjects",
	/**
	 * 确认覆盖会话
	 */
	CONFIRM_OVERWRITE_SESSION = "confirmOverwriteSession",
	/**
	 * 文件内容变更冲突
	 */
	FILE_CONTENT_CHANGE_CONFLICT = "fileContentChangeConflict",
}

export interface RECORD_SUMMARY_EVENT_CALLBACK {
	/**
	 * 录音完成
	 */
	[RECORD_SUMMARY_EVENTS.RECORDING_COMPLETE]: ({ session }: { session: RecordingSession }) => void
	/**
	 * 录音异常
	 */
	[RECORD_SUMMARY_EVENTS.RECORDING_ERROR]: ({ session }: { session: RecordingSession }) => void
	/**
	 * 录音时长超出限制
	 */
	[RECORD_SUMMARY_EVENTS.RECORDING_DURATION_EXCEEDED]: ({
		session,
	}: {
		session: RecordingSession
	}) => void
	/**
	 * 更新空工作空间面板项目
	 */
	[RECORD_SUMMARY_EVENTS.UPDATE_EMPTY_WORKSPACE_PANEL_PROJECTS]: ({
		workspaceId,
		projectId,
		topicId,
	}: {
		workspaceId: string
		projectId: string
		topicId: string
	}) => void
	/**
	 * 确认覆盖会话
	 */
	[RECORD_SUMMARY_EVENTS.CONFIRM_OVERWRITE_SESSION]: (data: {
		session: RecordingSession
		onConfirm: () => void
		onCancel: () => void
	}) => void
	/**
	 * 文件内容变更冲突
	 */
	[RECORD_SUMMARY_EVENTS.FILE_CONTENT_CHANGE_CONFLICT]: (data: {
		targetFile: AttachmentItem
		currentContent: string
		serverContent: string
		onIgnore: () => void
		onOverride: () => void
		onUseMerge: (mergedContent: string) => void
		onCancel: () => void
	}) => void
}
