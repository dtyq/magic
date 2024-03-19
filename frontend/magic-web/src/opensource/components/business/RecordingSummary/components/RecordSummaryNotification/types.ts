// Type definitions for RecordSummaryNotification component

export interface RecordSummaryNotificationContentProps {
	title?: string
	description?: string
	onViewClick: () => void
	onDismiss?: () => void
	viewText?: string
	ignoreText?: string
	success?: boolean
	workspaceId?: string | null
	projectId?: string | null
	topicId?: string | null
}

export interface RecordSummaryNotificationOptions {
	title?: string
	description?: string
	onViewClick?: () => void
	duration?: number | null
	key?: string
	workspaceId?: string | null
	projectId?: string | null
	topicId?: string | null
	viewText?: string
	ignoreText?: string
	success?: boolean
	workspaceName?: string | null
	projectName?: string | null
}

export interface RecordSummaryNotificationContextType {
	showRecordSummaryNotification: (options: RecordSummaryNotificationOptions) => void
}

export interface RecordSummaryNotificationProviderProps {
	children: React.ReactNode
}
