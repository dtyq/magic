import type { RecordingEditorPanelMode } from "./types"

interface GetEditorPanelModeParams {
	isRecording: boolean
	isPaused: boolean
	isCurrentRecording: boolean
	isOtherTabRecording: boolean
	isMediaRecorderNotSupported: boolean
}

export function getEditorPanelMode({
	isRecording,
	isPaused,
	isCurrentRecording,
	isOtherTabRecording,
	isMediaRecorderNotSupported,
}: GetEditorPanelModeParams): RecordingEditorPanelMode {
	if ((isRecording || isPaused) && isCurrentRecording) {
		return "recording"
	}

	if (
		((isRecording || isPaused) && !isCurrentRecording) ||
		isOtherTabRecording ||
		isMediaRecorderNotSupported
	) {
		return "blocked"
	}

	return "idle"
}
