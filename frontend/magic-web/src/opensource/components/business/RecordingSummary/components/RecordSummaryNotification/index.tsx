// Main entry point for RecordSummaryNotification component
// Re-exports all necessary APIs from modularized files

// Modern React Context-based API (recommended)
export {
	RecordSummaryNotificationProvider,
	useRecordSummaryNotification,
} from "./RecordSummaryNotificationProvider"

// Individual components (for advanced usage)
export { default as RecordSummaryNotificationContent } from "./RecordSummaryNotificationContent"

// Types
export type {
	RecordSummaryNotificationOptions,
	RecordSummaryNotificationContentProps,
	RecordSummaryNotificationContextType,
	RecordSummaryNotificationProviderProps,
} from "./types"
