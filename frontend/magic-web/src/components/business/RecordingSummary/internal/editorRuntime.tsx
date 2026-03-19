import {
	preloadWebRecordSummaryFloatPanel,
	useWebRecordingEditorRuntime,
	useWebRecordingSessionIdentity,
} from "./editorRuntimeBase"

export function preloadRecordSummaryFloatPanelIfNeeded() {
	preloadWebRecordSummaryFloatPanel()
}

export function useRecordingEditorRuntime() {
	return useWebRecordingEditorRuntime()
}

export function useCurrentRecordingSessionIdentity() {
	return useWebRecordingSessionIdentity()
}
