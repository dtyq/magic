import { initializeService, getServiceInstance } from "@/services/recordSummary/serviceInstance"
import { useMemoizedFn } from "ahooks"
import recordingSummaryStore from "@/stores/recordingSummary"
import { GetRecordingSummaryResultResponse } from "@/apis/modules/superMagic/recordSummary"
import { useCancelRecordDialogs } from "./internal/useCancelRecordDialogs"

function useCancelRecord({
	onSummarizeSuccess,
	onSummarizeError,
	noNeedButtonText,
	summarizeButtonText,
	modalContent,
}: {
	onSummarizeSuccess?: (
		res: GetRecordingSummaryResultResponse & {
			model_id: string
			workspace_id: string
			project_name: string
		},
	) => void
	onSummarizeError?: (error: Error) => void
	noNeedButtonText?: string
	summarizeButtonText?: string
	modalContent?: string
} = {}) {
	const recordSummaryService = initializeService()
	const { showOtherTabRecordingDialog, showStopRecordingDialog } = useCancelRecordDialogs({
		noNeedButtonText,
		summarizeButtonText,
		modalContent,
	})

	const cancel = useMemoizedFn(() => {
		return recordSummaryService.cancelRecording()
	})

	const summarize = useMemoizedFn(() => {
		return new Promise((resolve, reject) => {
			recordSummaryService.completeRecordingWithSummary({
				onSuccess: (result) => {
					onSummarizeSuccess?.(result)
					resolve(result)
				},
				onError: (error) => {
					onSummarizeError?.(error)
					reject(error)
				},
			})
		})
	})

	const cancelRecord = useMemoizedFn(async () => {
		const isInstanceExist = getServiceInstance()

		if (!isInstanceExist) {
			return Promise.resolve()
		}

		const isInitialStatus = recordingSummaryStore.status === "init"
		const isActiveTabRecording = recordingSummaryStore.multiTabState.activeTabData.isRecording

		if (isInitialStatus && !isActiveTabRecording) {
			return Promise.resolve()
		}

		if (isInitialStatus && isActiveTabRecording) {
			return showOtherTabRecordingDialog()
		}

		return showStopRecordingDialog({
			onCancel: cancel,
			onSummarize: summarize,
		})
	})

	return { cancelRecord }
}

export default useCancelRecord
