import { forwardRef, useImperativeHandle } from "react"
import { observer } from "mobx-react-lite"
import { cn } from "@/opensource/lib/utils"
import "./EditorPanelAnimations.css"
import { BlockedStateView } from "@/opensource/components/business/RecordingSummary/internal/editorPanel/BlockedStateView"
import { IdleStateView } from "@/opensource/components/business/RecordingSummary/internal/editorPanel/IdleStateView"
import { RecordingStateView } from "@/opensource/components/business/RecordingSummary/internal/editorPanel/RecordingStateView"
import { useRecordSummaryEditorPanelController } from "@/opensource/components/business/RecordingSummary/internal/editorPanel/useRecordSummaryEditorPanelController"
import type {
	RecordSummaryEditorPanelProps,
	RecordSummaryEditorPanelRef,
} from "@/opensource/components/business/RecordingSummary/internal/editorPanel/types"
import { preloadRecordSummaryFloatPanelIfNeeded } from "@/opensource/components/business/RecordingSummary/internal/editorRuntime"

preloadRecordSummaryFloatPanelIfNeeded()

export type {
	RecordSummaryEditorPanelProps,
	RecordSummaryEditorPanelRef,
} from "@/opensource/components/business/RecordingSummary/internal/editorPanel/types"

export const RecordSummaryEditorPanel = forwardRef<
	RecordSummaryEditorPanelRef,
	RecordSummaryEditorPanelProps
>(({ containerClassName, taskDataNode, messageQueueNode, iconSize = 20, ...props }, ref) => {
	const {
		WaveformComponent,
		ProjectSelectorComponent,
		UploadModal,
		audioSourceSelector,
		cancelRecord,
		duration,
		editorModeSwitch,
		handleCancelUpload,
		handleCompleteRecordingWithSummary,
		handleOpenCurrentRecording,
		handleStartRecording,
		handleUploadFile,
		isCurrentRecording,
		isMediaRecorderNotSupported,
		isOtherTabRecording,
		isPaused,
		isRecording,
		isSmall,
		isStartingRecord,
		isTaskRunning,
		isWaitingSummarize,
		leftToolbar,
		onInterrupt,
		panelMode,
		saveSuperMagicTopicModel,
		selectedProjectId,
		size,
		uploading,
		uploadProgress,
	} = useRecordSummaryEditorPanelController({
		...props,
		iconSize,
	})

	useImperativeHandle(
		ref,
		() => ({
			saveSuperMagicTopicModel,
		}),
		[saveSuperMagicTopicModel],
	)

	const mainContent =
		panelMode === "recording" ? (
			<RecordingStateView
				WaveformComponent={WaveformComponent}
				isRecording={isRecording}
				isPaused={isPaused}
				duration={duration}
				isWaitingSummarize={isWaitingSummarize}
				isTaskRunning={isTaskRunning}
				iconSize={iconSize}
				isSmall={isSmall}
				onInterrupt={onInterrupt}
				onCancel={cancelRecord}
				onSummarize={handleCompleteRecordingWithSummary}
			/>
		) : panelMode === "blocked" ? (
			<BlockedStateView
				size={size}
				isSmall={isSmall}
				uploading={uploading}
				uploadProgress={uploadProgress}
				isMediaRecorderNotSupported={isMediaRecorderNotSupported}
				isOtherTabRecording={isOtherTabRecording}
				isRecording={isRecording}
				isPaused={isPaused}
				isCurrentRecording={isCurrentRecording}
				leftToolbar={leftToolbar}
				editorModeSwitch={editorModeSwitch}
				isTaskRunning={isTaskRunning}
				iconSize={iconSize}
				onInterrupt={onInterrupt}
				onCancelUpload={handleCancelUpload}
				onUploadFile={handleUploadFile}
				onOpenCurrentRecording={handleOpenCurrentRecording}
			/>
		) : (
			<IdleStateView
				size={size}
				isSmall={isSmall}
				iconSize={iconSize}
				selectedProjectId={selectedProjectId}
				isStartingRecord={isStartingRecord}
				uploading={uploading}
				uploadProgress={uploadProgress}
				leftToolbar={leftToolbar}
				audioSourceSelector={audioSourceSelector}
				editorModeSwitch={editorModeSwitch}
				isTaskRunning={isTaskRunning}
				onInterrupt={onInterrupt}
				onStartRecording={handleStartRecording}
				onCancelUpload={handleCancelUpload}
				onUploadFile={handleUploadFile}
			/>
		)

	return (
		<>
			<div
				className={cn(
					"flex flex-col rounded-lg border border-border bg-white p-2.5",
					containerClassName,
				)}
			>
				{taskDataNode}
				{messageQueueNode}
				{mainContent}
				{UploadModal}
			</div>
			{panelMode !== "recording" && isSmall ? (
				<div className="flex items-center gap-1">{leftToolbar}</div>
			) : null}
			{ProjectSelectorComponent}
		</>
	)
})

export default observer(RecordSummaryEditorPanel)
