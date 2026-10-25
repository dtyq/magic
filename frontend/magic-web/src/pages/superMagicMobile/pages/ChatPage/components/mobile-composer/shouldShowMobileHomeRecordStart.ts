import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

interface ShouldShowMobileHomeRecordStartParams {
	deferProjectCreationUntilSend?: boolean
	showModeToggle?: boolean
	isRecordSummaryEditor: boolean
}

/**
 * Task homepage can switch employees and has no project yet. That is the only surface
 * that should start a new recording project in the selected workspace.
 */
export function shouldShowMobileHomeRecordStart({
	deferProjectCreationUntilSend,
	showModeToggle,
	isRecordSummaryEditor,
}: ShouldShowMobileHomeRecordStartParams): boolean {
	return (
		deferProjectCreationUntilSend === true && showModeToggle === true && isRecordSummaryEditor
	)
}

/**
 * Lets the task homepage use the shared recording panel, while forcing a new
 * record-summary project in the already selected workspace.
 */
export function applyTaskHomeRecordingEditorContext(
	editorContext: SceneEditorContext,
	isRecordSummaryEditor: boolean,
): SceneEditorContext {
	if (
		!shouldShowMobileHomeRecordStart({
			deferProjectCreationUntilSend: editorContext.deferProjectCreationUntilSend,
			showModeToggle: editorContext.showModeToggle,
			isRecordSummaryEditor,
		})
	) {
		return editorContext
	}

	return {
		...editorContext,
		// The homepage context disables recording mode for other employees.
		allowRecordingMode: true,
		allowSelectRecordingProject: false,
		recordingNewProjectTopicMode: TopicMode.RecordSummary,
	}
}
