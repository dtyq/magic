import MagicModal from "@/opensource/components/base/MagicModal"
import { userStore } from "@/opensource/models/user"
import { logger as Logger } from "@/opensource/utils/log"
import { t } from "i18next"

const logger = Logger.createLogger("TabCoordinator", {
	enableConfig: {
		console: true,
		warn: true,
		error: true,
		trace: true,
	},
})

interface PolyfillBroadcastChannel {
	name: string
	_listeners: Set<(event: MessageEvent) => void>
	postMessage(data: unknown): void
	addEventListener(type: string, listener: (event: MessageEvent) => void): void
	removeEventListener(type: string, listener: (event: MessageEvent) => void): void
	close(): void
}

// BroadcastChannel Polyfill for older browsers
function getBroadcastChannel(channelName: string): PolyfillBroadcastChannel {
	if (typeof BroadcastChannel !== "undefined") {
		return new BroadcastChannel(channelName) as unknown as PolyfillBroadcastChannel
	}

	// Polyfill using localStorage events
	const polyfillChannel: PolyfillBroadcastChannel = {
		name: channelName,
		_listeners: new Set<(event: MessageEvent) => void>(),

		postMessage(data: unknown) {
			const message = JSON.stringify({
				channel: channelName,
				data,
				timestamp: Date.now(),
			})
			localStorage.setItem(`broadcast_${channelName}`, message)
			localStorage.removeItem(`broadcast_${channelName}`)
		},

		addEventListener(type: string, listener: (event: MessageEvent) => void) {
			if (type === "message") {
				this._listeners.add(listener)

				const storageListener = (e: StorageEvent) => {
					if (e.key === `broadcast_${channelName}` && e.newValue) {
						try {
							const message = JSON.parse(e.newValue)
							if (message.channel === channelName) {
								listener({ data: message.data } as MessageEvent)
							}
						} catch (error) {
							// Ignore invalid messages
						}
					}
				}

				window.addEventListener("storage", storageListener)
			}
		},

		removeEventListener(type: string, listener: (event: MessageEvent) => void) {
			if (type === "message") {
				this._listeners.delete(listener)
			}
		},

		close() {
			this._listeners.clear()
		},
	}

	return polyfillChannel
}

export interface TabLockReleaseData {
	type: TabLockReleaseType
	data?: RecordingDataSyncData
	organizationCode?: string
}

// Tab message types
export interface TabMessage {
	type:
		| "RECORDING_LOCK_REQUEST"
		| "RECORDING_LOCK_ACQUIRED"
		| "RECORDING_LOCK_RELEASED"
		| "RECORDING_STATUS_UPDATE"
		| "TAB_HEARTBEAT"
		| "RECORDING_DATA_SYNC"
		| "REQUEST_ACTIVE_TAB_FOCUS"
		| "RECORD_SUMMARY_NOTIFICATION_CLOSE"
	tabId: string
	timestamp: number
	data?: unknown
}

export interface RecordingLockRequestData {
	sessionId?: string
	priority?: number // Higher number = higher priority
}

export interface RecordingStatusData {
	isRecording: boolean
	duration: string
	sessionId?: string
}

export interface RecordingDataSyncData {
	message: {
		text: string
		start_time?: number
		end_time?: number
		definite?: boolean // 是否确定
	}[]
	duration: string
	isRecording: boolean
	sessionId?: string
}

export type TabStatus = "active" | "inactive" | "pending" | "disconnected"
export type TabLockReleaseType = "finish" | "closeTab" | "reset"

export const enum TAB_COORDINATOR_EVENTS {
	/**
	 * 录音总结通知关闭(其他tab关闭通知)
	 */
	RECORD_SUMMARY_NOTIFICATION_CLOSE = "RECORD_SUMMARY_NOTIFICATION_CLOSE",
}

export interface TAB_COORDINATOR_EVENTS_CALLBACK {
	[TAB_COORDINATOR_EVENTS.RECORD_SUMMARY_NOTIFICATION_CLOSE]: ({
		workspaceId,
		projectId,
		topicId,
	}: {
		workspaceId: string
		projectId: string
		topicId: string
	}) => void
}

export interface TabCoordinatorCallbacks {
	onStatusChange?: (status: TabStatus) => void
	onRecordingDataSync?: (data: RecordingDataSyncData, isCurrentTab: boolean) => void
	onActiveTabRequest?: () => void // When user requests to focus active tab
	onLockAcquired?: () => void
	onLockReleased?: (data?: TabLockReleaseData) => void
	onSendReleased?: () => void
}

/**
 * TabCoordinator - Manages recording permissions across multiple tabs
 */
export class TabCoordinator {
	private channel: PolyfillBroadcastChannel
	private tabId: string
	private status: TabStatus = "inactive"
	private heartbeatTimer: NodeJS.Timeout | null = null
	private lockTimeoutTimer: NodeJS.Timeout | null = null
	private callbacks: TabCoordinatorCallbacks = {}

	// Lock management
	private currentLockHolder: string | null = null
	private lockRequestPending = false
	private lastUserActivity = Date.now()
	private lockRequestDelayTimer: NodeJS.Timeout | null = null
	private readonly HEARTBEAT_INTERVAL = 5000 // 5 seconds
	private readonly LOCK_TIMEOUT = 15000 // 15 seconds
	private readonly CHANNEL_NAME = "recording-summary-coordination"
	private readonly MAX_LOCK_REQUEST_DELAY = 1000 // 1 second max delay
	modal: any

	eventMap = new Map<
		TAB_COORDINATOR_EVENTS,
		TAB_COORDINATOR_EVENTS_CALLBACK[TAB_COORDINATOR_EVENTS]
	>()

	constructor(callbacks: TabCoordinatorCallbacks = {}) {
		this.tabId = this.generateTabId()
		this.callbacks = callbacks
		this.channel = getBroadcastChannel(this.CHANNEL_NAME)
		this.initialize()

		logger.log("TabCoordinator initialized", { tabId: this.tabId })
	}

	on<T extends keyof TAB_COORDINATOR_EVENTS_CALLBACK>(
		eventName: T,
		callback: TAB_COORDINATOR_EVENTS_CALLBACK[T],
	) {
		this.eventMap.set(eventName, callback)
		return () => {
			this.eventMap.delete(eventName)
		}
	}

	emit<T extends keyof TAB_COORDINATOR_EVENTS_CALLBACK>(
		eventName: T,
		...data: Parameters<TAB_COORDINATOR_EVENTS_CALLBACK[T] & ((...args: any[]) => any)>
	) {
		const callback = this.eventMap.get(eventName)
		if (!callback) return
		;(callback as (...args: any[]) => void)(...data)
	}

	private initialize() {
		// Listen to broadcast messages
		this.channel.addEventListener("message", this.handleMessage)

		// Start heartbeat
		this.startHeartbeat()

		// Handle tab visibility changes
		document.addEventListener("visibilitychange", this.handleVisibilityChange)

		// Handle tab close
		window.addEventListener("unload", this.handleTabClose)

		// Send initial heartbeat to announce this tab
		this.sendHeartbeat()
	}

	private generateTabId(): string {
		return `tab_${Date.now()}_${Math.random().toString(36).substring(2)}`
	}

	private handleMessage = (event: MessageEvent<TabMessage>) => {
		const message = event.data

		// Ignore messages from this tab
		if (message.tabId === this.tabId) return

		logger.log("Received message", message)

		switch (message.type) {
			case "RECORDING_LOCK_REQUEST":
				this.handleLockRequest(message)
				break
			case "RECORDING_LOCK_ACQUIRED":
				this.handleLockAcquired(message)
				break
			case "RECORDING_LOCK_RELEASED":
				this.handleLockReleased(message)
				break
			case "RECORDING_STATUS_UPDATE":
				this.handleStatusUpdate(message)
				break
			case "RECORDING_DATA_SYNC":
				this.handleDataSync(message)
				break
			case "TAB_HEARTBEAT":
				this.handleHeartbeat(message)
				break
			case "REQUEST_ACTIVE_TAB_FOCUS":
				this.handleActiveTabFocusRequest(message)
				break
			case "RECORD_SUMMARY_NOTIFICATION_CLOSE":
				this.handleRecordSummaryNotification(message)
				break
		}
	}

	private handleLockRequest(_message: TabMessage) {
		// If this tab holds the lock and receives a request, respond with current status
		if (this.status === "active") {
			this.sendMessage({
				type: "RECORDING_LOCK_ACQUIRED",
				tabId: this.tabId,
				timestamp: Date.now(),
				data: { currentHolder: this.tabId },
			})
		}
	}

	private handleLockAcquired(message: TabMessage) {
		if (message.tabId !== this.tabId) {
			// Another tab acquired the lock
			this.currentLockHolder = message.tabId
			if (this.status !== "inactive") {
				this.updateStatus("inactive")
			}

			if (this.modal) {
				this.modal?.destroy()
				this.modal = null
			}

			this.lockRequestPending = false
		}
	}

	private handleLockReleased(message: TabMessage) {
		if (message.tabId === this.currentLockHolder) {
			this.currentLockHolder = null
			this.callbacks.onLockReleased?.(message.data as TabLockReleaseData)

			// 如果是其他便签页关闭，则需要自动承接
			const isCloseTab = (message.data as TabLockReleaseData)?.type === "closeTab"
			const isSameOrganization =
				(message.data as TabLockReleaseData)?.organizationCode ===
				userStore.user.organizationCode

			const shouldRequestLock = this.shouldRequestLockAfterRelease()
			logger.log("Should request lock", { shouldRequestLock })
			// Only request lock if conditions are met
			if (isCloseTab && isSameOrganization && shouldRequestLock) {
				// 预加载录音总结服务和浮动面板
				import("@/opensource/services/recordSummary/utils/preloadService").then(
					({ preloadRecordSummaryService, preloadRecordSummaryFloatPanel }) => {
						preloadRecordSummaryService()
						preloadRecordSummaryFloatPanel()
					},
				)

				this.modal = MagicModal.confirm({
					title: t("recordingSummary.restore.title", { ns: "super" }),
					content: t("recordingSummary.restore.content", { ns: "super" }),
					onOk: () => {
						this.requestLockWithDelay()
						this.modal?.destroy()
						this.modal = null
					},
					onCancel: () => {
						this.modal?.destroy()
						this.modal = null
					},
					okText: t("recordingSummary.restore.confirm", { ns: "super" }),
					cancelText: t("recordingSummary.restore.cancel", { ns: "super" }),
				})
			}
		}
	}

	private handleStatusUpdate(message: TabMessage) {
		if (message.tabId === this.currentLockHolder && message.data) {
			const statusData = message.data as RecordingStatusData
			// Update UI to reflect active tab's recording status
			logger.log("Active tab status update", statusData)
		}
	}

	private handleDataSync(message: TabMessage) {
		// 如果当前没有锁持有者，则认为消息来源是锁的持有者
		if (!this.currentLockHolder) this.currentLockHolder = message.tabId
		if (message.tabId === this.currentLockHolder && this.status === "inactive") {
			// Sync recording data from active tab
			const syncData = message.data as RecordingDataSyncData
			this.callbacks.onRecordingDataSync?.(syncData, message.tabId === this.tabId)
			// logger.log("Synced recording data from active tab", syncData)
		}
	}

	private handleHeartbeat(message: TabMessage) {
		// Track other tabs' heartbeats for lock management
		if (message.tabId === this.currentLockHolder) {
			// Reset lock timeout since active tab is still alive
			this.resetLockTimeout()
		}
	}

	private handleActiveTabFocusRequest(_message: TabMessage) {
		console.log("handleActiveTabFocusRequest", this.status)
		if (this.status === "active") {
			window.focus()
			logger.log("Active tab focused by request")
		}
	}

	/**
	 * 处理录音总结通知
	 * @param message
	 */
	private handleRecordSummaryNotification(message: TabMessage) {
		// 如果弹出通知了，则关闭通知
		this.emit(
			TAB_COORDINATOR_EVENTS.RECORD_SUMMARY_NOTIFICATION_CLOSE,
			message.data as {
				workspaceId: string
				projectId: string
				topicId: string
			},
		)
	}

	/**
	 * 发送录音总结通知关闭
	 * @param workspaceId
	 * @param projectId
	 * @param topicId
	 */
	sendRecordSummaryNotificationClose(
		workspaceId?: string | null,
		projectId?: string | null,
		topicId?: string | null,
	) {
		this.sendMessage({
			type: "RECORD_SUMMARY_NOTIFICATION_CLOSE",
			tabId: this.tabId,
			timestamp: Date.now(),
			data: { workspaceId, projectId, topicId },
		})
	}

	private handleVisibilityChange = () => {
		if (document.hidden) {
			// Tab became hidden
			if (this.status === "active") {
				// Continue recording but reduce heartbeat frequency
			}
		} else {
			// Tab became visible
			this.sendHeartbeat()
		}
	}

	private handleTabClose = () => {
		if (this.status === "active") {
			this.releaseLock({
				type: "closeTab",
				data: undefined,
				organizationCode: userStore.user.organizationCode,
			})
		}
		this.cleanup()
	}

	private startHeartbeat() {
		this.heartbeatTimer = setInterval(() => {
			this.sendHeartbeat()
		}, this.HEARTBEAT_INTERVAL)
	}

	private sendHeartbeat() {
		this.sendMessage({
			type: "TAB_HEARTBEAT",
			tabId: this.tabId,
			timestamp: Date.now(),
		})
	}

	private resetLockTimeout() {
		if (this.lockTimeoutTimer) {
			clearTimeout(this.lockTimeoutTimer)
		}

		if (this.currentLockHolder && this.currentLockHolder !== this.tabId) {
			this.lockTimeoutTimer = setTimeout(() => {
				logger.log("Lock holder timeout, releasing lock", {
					holder: this.currentLockHolder,
				})
				this.currentLockHolder = null
			}, this.LOCK_TIMEOUT)
		}
	}

	private sendMessage(message: TabMessage) {
		try {
			this.channel.postMessage(message)
		} catch (error) {
			logger.error("Failed to send message", error)
		}
	}

	private updateStatus(newStatus: TabStatus) {
		if (this.status !== newStatus) {
			const oldStatus = this.status
			this.status = newStatus
			this.callbacks.onStatusChange?.(newStatus)
			logger.log("Status changed", { from: oldStatus, to: newStatus })
		}
	}

	/**
	 * Check if this tab should request lock after it's released by another tab
	 */
	private shouldRequestLockAfterRelease(): boolean {
		return (
			this.status === "inactive" && // Currently inactive
			!this.lockRequestPending // No pending request
		)
	}

	/**
	 * Request lock with intelligent delay to reduce race conditions
	 */
	private requestLockWithDelay() {
		// Calculate delay based on tab priority
		const priority = this.calculateTabPriority()
		const delay = Math.max(0, (10 - priority) * 100) // Higher priority = lower delay

		logger.log("Requesting lock with delay", { priority, delay })

		this.lockRequestDelayTimer = setTimeout(
			() => {
				this.lockRequestDelayTimer = null
				// Double-check conditions before actually requesting lock
				if (this.currentLockHolder === null && this.shouldRequestLockAfterRelease()) {
					this.requestLock()
				}
			},
			Math.min(delay, this.MAX_LOCK_REQUEST_DELAY),
		)
	}

	/**
	 * Calculate tab priority for lock acquisition
	 * Higher number = higher priority (should get lock sooner)
	 */
	private calculateTabPriority(): number {
		let priority = 5 // Base priority

		// Foreground tab gets priority
		if (!document.hidden) {
			priority += 3
		}

		// Recent user activity increases priority
		if (this.hasRecentUserActivity()) {
			priority += 2
		}

		// If this tab was previously active, give it slight priority
		if (this.status === "inactive" && this.hasRecentUserActivity()) {
			priority += 1
		}

		return Math.min(10, priority)
	}

	/**
	 * Check if user has been active recently (within 30 seconds)
	 */
	private hasRecentUserActivity(): boolean {
		const ACTIVITY_THRESHOLD = 30000 // 30 seconds
		return Date.now() - this.lastUserActivity < ACTIVITY_THRESHOLD
	}

	/**
	 * Update user activity timestamp
	 */
	private updateUserActivity() {
		this.lastUserActivity = Date.now()
	}

	/**
	 * Request recording lock (manual user action)
	 */
	requestLock(sessionId?: string): Promise<boolean> {
		// Update user activity timestamp when user manually requests lock
		this.updateUserActivity()

		return new Promise((resolve) => {
			if (this.status === "active") {
				resolve(true)
				return
			}

			if (this.lockRequestPending) {
				resolve(false)
				return
			}

			this.lockRequestPending = true
			this.updateStatus("pending")

			// Send lock request
			this.sendMessage({
				type: "RECORDING_LOCK_REQUEST",
				tabId: this.tabId,
				timestamp: Date.now(),
				data: { sessionId },
			})

			// Wait for response or timeout
			const timeout = setTimeout(() => {
				if (this.lockRequestPending && this.status === "pending") {
					// No response, assume we can take the lock
					this.acquireLock()
					resolve(true)
				} else if (this.status === "inactive") {
					resolve(false)
				}
			}, 2000) // 2 second timeout

			// Listen for lock acquisition
			const originalCallback = this.callbacks.onLockAcquired
			this.callbacks.onLockAcquired = () => {
				clearTimeout(timeout)
				resolve(true)
				this.callbacks.onLockAcquired = originalCallback
				originalCallback?.()
			}
		})
	}

	/**
	 * Acquire recording lock
	 */
	acquireLock() {
		this.currentLockHolder = this.tabId
		this.lockRequestPending = false
		this.updateStatus("active")

		this.sendMessage({
			type: "RECORDING_LOCK_ACQUIRED",
			tabId: this.tabId,
			timestamp: Date.now(),
		})

		// Notify lock acquisition
		this.callbacks.onLockAcquired?.()

		logger.log("Lock acquired", { tabId: this.tabId })
	}

	/**
	 * Release recording lock
	 */
	releaseLock({ type, data, organizationCode }: TabLockReleaseData) {
		if (this.status === "active") {
			this.sendMessage({
				type: "RECORDING_LOCK_RELEASED",
				tabId: this.tabId,
				timestamp: Date.now(),
				data: {
					type,
					data,
					organizationCode,
				},
			})

			this.currentLockHolder = null
			this.updateStatus("inactive")

			this.callbacks.onSendReleased?.()

			logger.log("Lock released", { tabId: this.tabId })
		}
	}

	/**
	 * Broadcast recording status update
	 */
	broadcastRecordingStatus(data: RecordingStatusData) {
		if (this.status === "active") {
			this.sendMessage({
				type: "RECORDING_STATUS_UPDATE",
				tabId: this.tabId,
				timestamp: Date.now(),
				data,
			})
		}
	}

	/**
	 * Broadcast recording data for synchronization
	 */
	broadcastRecordingData(data: RecordingDataSyncData) {
		if (this.status === "active") {
			this.sendMessage({
				type: "RECORDING_DATA_SYNC",
				tabId: this.tabId,
				timestamp: Date.now(),
				data,
			})
		}
	}

	/**
	 * Request focus on active tab
	 */
	requestActiveTabFocus() {
		this.sendMessage({
			type: "REQUEST_ACTIVE_TAB_FOCUS",
			tabId: this.tabId,
			timestamp: Date.now(),
		})
	}

	/**
	 * Get current status
	 */
	getStatus(): TabStatus {
		return this.status
	}

	/**
	 * Check if this tab has recording permission
	 */
	hasRecordingPermission(): boolean {
		return this.status === "active"
	}

	/**
	 * Check if any tab is currently recording
	 */
	isAnyTabRecording(): boolean {
		return this.currentLockHolder !== null
	}

	/**
	 * Get current lock holder tab ID
	 */
	getCurrentLockHolder(): string | null {
		return this.currentLockHolder
	}

	/**
	 * Cleanup resources
	 */
	cleanup() {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = null
		}

		if (this.lockTimeoutTimer) {
			clearTimeout(this.lockTimeoutTimer)
			this.lockTimeoutTimer = null
		}

		if (this.lockRequestDelayTimer) {
			clearTimeout(this.lockRequestDelayTimer)
			this.lockRequestDelayTimer = null
		}

		document.removeEventListener("visibilitychange", this.handleVisibilityChange)
		window.removeEventListener("unload", this.handleTabClose)

		this.channel.removeEventListener("message", this.handleMessage)
		this.channel.close()

		logger.log("TabCoordinator cleaned up", { tabId: this.tabId })
	}

	/**
	 * Update callbacks
	 */
	updateCallbacks(callbacks: TabCoordinatorCallbacks) {
		this.callbacks = { ...this.callbacks, ...callbacks }
	}
}
