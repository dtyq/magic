import recordSummaryStore from "@/stores/recordingSummary"
import { userStore } from "@/models/user"
import { tryRestorePreviousRecordSummarySession } from "../initRecordSummaryService"
import {
	TabCoordinator,
	type TabCoordinatorCallbacks,
	type RecordingDataSyncData,
	type TabLockReleaseData,
	type TabStatus,
} from "./TabCoordinator"

let tabCoordinatorInstance: TabCoordinator | null = null

function getTabCoordinator(): TabCoordinator {
	if (!tabCoordinatorInstance) {
		const callbacks: TabCoordinatorCallbacks = {
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
				const params = {
					userId: userStore.user.userInfo?.user_id,
					organizationCode: userStore.user.organizationCode,
				}
				// 仅剩"恢复录音"会走锁流程，"总结录音"已改为直接回调
				tryRestorePreviousRecordSummarySession(params)
			},
			onDiscardHistoricalRecording: () => {
				// 懒加载服务并执行放弃操作（不需要持有锁）
				import("./serviceInstance")
					.then(({ initializeService }) => {
						initializeService().discardHistoricalSession()
					})
					.catch(() => {
						// 如果服务未初始化，直接重置 store
						recordSummaryStore.reset()
					})
			},
			onSummarizeHistoricalRecording: () => {
				// 直接调用总结方法，无需获取锁
				import("./serviceInstance")
					.then(({ initializeService }) => {
						initializeService().finishHistoricalSession()
					})
					.catch(() => {
						recordSummaryStore.reset()
					})
			},
		}
		tabCoordinatorInstance = new TabCoordinator(callbacks)
	}
	return tabCoordinatorInstance
}

function registerTabCoordinatorCallbacks(callbacks: {
	onRecordingDataSync?: (data: RecordingDataSyncData, isCurrentTab: boolean) => void
	onActiveTabRequest?: () => void
	onLockReleased?: (data?: TabLockReleaseData) => void
	onStatusChange?: (status: TabStatus) => void
}) {
	const coordinator = getTabCoordinator()
	coordinator.updateCallbacks(callbacks)
}

export { getTabCoordinator, registerTabCoordinatorCallbacks }
