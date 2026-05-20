import { useWebRecordingEditorRuntime, useWebRecordingSessionIdentity } from "./editorRuntimeBase"
import { preloadRecordSummaryFloatPanel } from "@/services/recordSummary/utils/preloadService"

export function preloadRecordSummaryFloatPanelIfNeeded() {
	preloadRecordSummaryFloatPanel()
}

export function useRecordingEditorRuntime() {
	return useWebRecordingEditorRuntime()
}

export function useCurrentRecordingSessionIdentity() {
	return useWebRecordingSessionIdentity()
}
