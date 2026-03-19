import recordSummaryStore from "@/stores/recordingSummary"
import { userStore } from "@/models/user"
import { tryRestorePreviousRecordSummarySession } from "../initRecordSummaryService"
import {
	TabCoordinator,
	type RecordingDataSyncData,
	type TabLockReleaseData,
	type TabStatus,
} from "./TabCoordinator"

let tabCoordinatorInstance: TabCoordinator | null = null

function getTabCoordinator(): TabCoordinator {
	if (!tabCoordinatorInstance) {
		tabCoordinatorInstance = new TabCoordinator({
			onStatusChange: (status: TabStatus) => {
				recordSummaryStore.updateTabStatus(status)
			},
			onLockReleased: (data?: TabLockReleaseData) => {
				if (data?.data) {
					recordSummaryStore.syncActiveTabData(data.data)
				}
			},
			onRecordingDataSync: (data: RecordingDataSyncData) => {
				recordSummaryStore.syncActiveTabData(data)
			},
			onActiveTabRequest: () => {
				if (tabCoordinatorInstance?.hasRecordingPermission()) {
					window.focus()
				}
			},
			onLockAcquired: () => {
				tryRestorePreviousRecordSummarySession({
					userId: userStore.user.userInfo?.user_id,
					organizationCode: userStore.user.organizationCode,
				})
			},
		})
	}
	return tabCoordinatorInstance
}

function registerTabCoordinatorCallbacks(callbacks: {
	onRecordingDataSync?: (data: RecordingDataSyncData, isCurrentTab: boolean) => void
	onActiveTabRequest?: () => void
	onLockAcquired?: () => void
	onLockReleased?: (data?: TabLockReleaseData) => void
	onStatusChange?: (status: TabStatus) => void
}) {
	const coordinator = getTabCoordinator()
	coordinator.updateCallbacks(callbacks)
}

export { getTabCoordinator, registerTabCoordinatorCallbacks }
