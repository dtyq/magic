import { forwardRef, useImperativeHandle } from "react"
import { observer } from "mobx-react-lite"
import { cn } from "@/utils/cn"
import "./EditorPanelAnimations.css"
import { IdleStateView } from "@/components/business/RecordingSummary/internal/editorPanel/IdleStateView"
import { RecordingStateView } from "@/components/business/RecordingSummary/internal/editorPanel/RecordingStateView"
import { useRecordSummaryEditorPanelController } from "@/components/business/RecordingSummary/internal/editorPanel/useRecordSummaryEditorPanelController"
import type {
	RecordSummaryEditorPanelProps,
	RecordSummaryEditorPanelRef,
} from "@/components/business/RecordingSummary/internal/editorPanel/types"

import("@/components/business/RecordingSummary/internal/editorRuntime").then(
	({ preloadRecordSummaryFloatPanelIfNeeded }) => {
		preloadRecordSummaryFloatPanelIfNeeded?.()
	},
)

export type {
	RecordSummaryEditorPanelProps,
	RecordSummaryEditorPanelRef,
} from "@/components/business/RecordingSummary/internal/editorPanel/types"

/** Render the recording editor state while preserving the parent conversation height contract. */
export const RecordSummaryEditorPanel = forwardRef<
	RecordSummaryEditorPanelRef,
	RecordSummaryEditorPanelProps
>(function RecordSummaryEditorPanel(
	{
		containerClassName,
		taskDataNode,
		messageQueueNode,
		iconSize = 20,
		fillHeight = false,
		...props
	},
	ref,
) {
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
		handleStartRecording,
		handleUploadFile,
		isMediaRecorderNotSupported,
		isModelReady,
		isOtherTabRecording,
		isPaused,
		isRecording,
		isSmall,
		isMobile,
		isStartingRecord,
		isTaskRunning,
		isWaitingSummarize,
		leftToolbar,
		onInterrupt,
		panelMode,
		saveSuperMagicTopicModel,
		selectedProjectId,
		allowSelectRecordingProject,
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
		) : (
			<IdleStateView
				size={size}
				isSmall={isSmall}
				iconSize={iconSize}
				selectedProjectId={selectedProjectId}
				allowSelectRecordingProject={allowSelectRecordingProject}
				isStartingRecord={isStartingRecord}
				isModelReady={isModelReady}
				isRecordingBlocked={panelMode === "blocked"}
				isMediaRecorderNotSupported={isMediaRecorderNotSupported}
				isOtherTabRecording={isOtherTabRecording}
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
				fillHeight={fillHeight}
			/>
		)

	return (
		<>
			<div
				className={cn(
					"flex flex-col rounded-2xl border border-border bg-white p-2.5",
					isMobile && "rounded-none border-none",
					fillHeight && panelMode !== "recording" && "min-h-0 flex-1",
					containerClassName,
				)}
			>
				{taskDataNode}
				{messageQueueNode}
				{mainContent}
				{UploadModal}
			</div>
			{panelMode !== "recording" && isSmall ? (
				<div className="mt-1 flex items-center gap-1">{leftToolbar}</div>
			) : null}
			{ProjectSelectorComponent}
		</>
	)
})

export default observer(RecordSummaryEditorPanel)
