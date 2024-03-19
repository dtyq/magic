import recordingSummaryStore from "@/opensource/stores/recordingSummary"

/**
 * Preload RecordSummaryService
 * @returns Promise<typeof import("../serviceInstance")>
 */
export function preloadRecordSummaryService() {
	return import("../serviceInstance")
}

/**
 * Preload RecordSummaryFloatPanel
 * @returns Promise<typeof import("@/opensource/components/business/RecordingSummary/FloatPanel")>
 */
export function preloadRecordSummaryFloatPanel() {
	return import("@/opensource/components/business/RecordingSummary/FloatPanel").then(() => {
		recordingSummaryStore.setIsFloatPanelLoaded(true)
	})
}
