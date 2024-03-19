import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import recordSummaryStore from "@/opensource/stores/recordingSummary"
import RealtimeWaveform from "@/opensource/components/business/RecordingSummary/components/RealtimeWaveform"
import { initializeService as initializeRecordSummaryService } from "@/opensource/services/recordSummary/serviceInstance"
import type {
	RecordingEditorFinishOptions,
	RecordingEditorStartParams,
	RecordingEditorRuntime,
	RecordingEditorRuntimeState,
	RecordingSessionIdentity,
} from "./editorPanel/types"

export function preloadWebRecordSummaryFloatPanel() {
	import("@/opensource/services/recordSummary/utils/preloadService").then(
		({ preloadRecordSummaryFloatPanel }) => {
			preloadRecordSummaryFloatPanel()
		},
	)
}

export function useWebRecordingSessionIdentity(): RecordingSessionIdentity {
	const {
		businessData: { workspace, project, topic },
	} = recordSummaryStore

	return useMemo(
		() => ({
			workspaceId: workspace?.id,
			projectId: project?.id,
			topicId: topic?.id,
		}),
		[project?.id, topic?.id, workspace?.id],
	)
}

export function useWebRecordingEditorRuntimeState(): RecordingEditorRuntimeState {
	const currentSession = useWebRecordingSessionIdentity()
	const { isRecording, isPaused, duration, isStartingRecord } = recordSummaryStore

	return useMemo(
		() => ({
			isRecording,
			isPaused,
			duration,
			isStartingRecord,
			currentSession,
		}),
		[currentSession, duration, isPaused, isRecording, isStartingRecord],
	)
}

export function useWebRecordingEditorRuntime(): RecordingEditorRuntime {
	const recordSummaryService = initializeRecordSummaryService()
	const state = useWebRecordingEditorRuntimeState()

	const startRecording = useMemoizedFn(
		async ({ workspace, project, topic, model, audioSource }: RecordingEditorStartParams) => {
			await recordSummaryService.startRecording({
				workspace,
				model,
				topic,
				project,
				audioSource: {
					source: audioSource,
				},
			})
		},
	)

	const finishRecording = useMemoizedFn(async (options?: RecordingEditorFinishOptions) => {
		await new Promise<void>((resolve, reject) => {
			recordSummaryService.completeRecordingWithSummary({
				onSuccess: (result) => {
					options?.onSuccess?.(result)
					resolve()
				},
				onError: (error) => {
					options?.onError?.(error)
					reject(error)
				},
			})
		})
	})

	const openCurrentRecording = useMemoizedFn(() => {
		recordSummaryStore.floatPanel.toggleExpanded()
	})

	const cancelRecording = useMemoizedFn(() => {
		return recordSummaryService.cancelRecording()
	})

	return useMemo(
		() => ({
			state,
			actions: {
				startRecording,
				finishRecording,
				openCurrentRecording,
				cancelRecording,
			},
			WaveformComponent: RealtimeWaveform,
		}),
		[cancelRecording, finishRecording, openCurrentRecording, startRecording, state],
	)
}
