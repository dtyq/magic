import { createContext, useContext, useEffect, useMemo } from "react"
import { notification } from "antd"
import { useTranslation } from "react-i18next"
import RecordSummaryNotificationContent from "./RecordSummaryNotificationContent"
import type {
	RecordSummaryNotificationContextType,
	RecordSummaryNotificationProviderProps,
	RecordSummaryNotificationOptions,
} from "./types"
import { useMemoizedFn, useMount } from "ahooks"
import { TAB_COORDINATOR_EVENTS } from "@/services/recordSummary/TabCoordinator"
import { getTabCoordinator } from "@/services/recordSummary/tabCoordinatorInstance"

// Context for notification API
const RecordSummaryNotificationContext = createContext<RecordSummaryNotificationContextType | null>(
	null,
)

const getRecordSummaryNotificationKey = (
	workspaceId?: string | null,
	projectId?: string | null,
	topicId?: string | null,
) => {
	return `record-summary-notification-${workspaceId}-${projectId}-${topicId}`
}

// Provider component
export function RecordSummaryNotificationProvider({
	children,
}: RecordSummaryNotificationProviderProps) {
	const { t } = useTranslation("super")
	const tabCoordinator = useMemo(() => getTabCoordinator(), [])

	const [api, contextHolder] = notification.useNotification({
		placement: "topRight",
		stack: { threshold: 3 }, // Enable stacking with threshold
	})

	const showRecordSummaryNotification = useMemoizedFn(
		({
			title,
			description,
			workspaceId,
			projectId,
			topicId,
			duration = 0, // Don't auto-close by default
			success,
			projectName,
		}: RecordSummaryNotificationOptions) => {
			const key = getRecordSummaryNotificationKey(workspaceId, projectId, topicId)
			const handleDismiss = () => {
				api.destroy(key)
				tabCoordinator.sendRecordSummaryNotificationClose(workspaceId, projectId, topicId)
			}

			const handleViewClick = () => {
				// if (!workspaceId || !projectId || !topicId) {
				// 	console.error("workspaceId, projectId, topicId is required")
				// 	return
				// }
				// const url = genProjectTopicUrl(workspaceId, projectId, topicId)
				// openInNewTab(url)
				api.destroy(key)
				tabCoordinator.sendRecordSummaryNotificationClose(workspaceId, projectId, topicId)
			}

			api.open({
				key,
				message: null, // We'll handle the entire content ourselves
				description: (
					<RecordSummaryNotificationContent
						onViewClick={handleViewClick}
						onDismiss={handleDismiss}
						success={success}
						title={
							title ||
							(success
								? t("recordingSummary.notification.successTitle")
								: t("recordingSummary.notification.failureTitle"))
						}
						description={
							description ||
							(success
								? t("recordingSummary.notification.successDescription", {
									projectName: projectName || t("project.unnamedProject"),
								})
								: t("recordingSummary.notification.failureDescription", {
									projectName: projectName || t("project.unnamedProject"),
								}))
						}
						viewText={
							success
								? t("recordingSummary.notification.viewSummaryText")
								: t("recordingSummary.notification.openTopicText")
						}
						ignoreText={t("recordingSummary.notification.ignoreText")}
						workspaceId={workspaceId}
						projectId={projectId}
						topicId={topicId}
					/>
				),
				duration,
				placement: "topRight",
				closeIcon: null, // Hide default close button
				style: {
					padding: 0,
					borderRadius: "14px",
					border: "none",
					background: "transparent",
					boxShadow: "none",
					width: "384px",
				},
				className: "[&_.magic-notification-notice-description]:!mt-0",
			})
		},
	)

	const closeRecordSummaryNotification = useMemoizedFn((key: string) => {
		api.destroy(key)
	})

	useEffect(() => {
		return tabCoordinator.on(
			TAB_COORDINATOR_EVENTS.RECORD_SUMMARY_NOTIFICATION_CLOSE,
			({
				workspaceId,
				projectId,
				topicId,
			}: {
				workspaceId: string
				projectId: string
				topicId: string
			}) => {
				const key = getRecordSummaryNotificationKey(workspaceId, projectId, topicId)
				closeRecordSummaryNotification(key)
			},
		)
	}, [closeRecordSummaryNotification, tabCoordinator])

	const contextValue = useMemo(
		() => ({ showRecordSummaryNotification }),
		[showRecordSummaryNotification],
	)

	return (
		<RecordSummaryNotificationContext.Provider value={contextValue}>
			{contextHolder}
			{children}
		</RecordSummaryNotificationContext.Provider>
	)
}

// Custom hook to use notification
export function useRecordSummaryNotification() {
	const context = useContext(RecordSummaryNotificationContext)
	return context
}
