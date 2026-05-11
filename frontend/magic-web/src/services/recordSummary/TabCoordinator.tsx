import MagicModal from "@/components/base/MagicModal"
import { RecordSummaryActionButton } from "@/components/business/RecordingSummary/components/RecordSummaryAlertCard"
import { userStore } from "@/models/user"
import { logger as Logger } from "@/utils/log"
import { t } from "i18next"
import { shouldSkipRecordingSessionRestoreOnCurrentRoute } from "./recordingRestoreRouteGuard"

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

/**
 * Intent that describes what the user wants to do after acquiring the lock
 * following a tab-close handoff dialog.
 */
export type LockAcquireIntent = "restore" | "finish"

export interface TabCoordinatorCallbacks {
	onStatusChange?: (status: TabStatus) => void
	onRecordingDataSync?: (data: RecordingDataSyncData, isCurrentTab: boolean) => void
	onActiveTabRequest?: () => void // When user requests to focus active tab
	onLockAcquired?: () => void
	onLockReleased?: (data?: TabLockReleaseData) => void
	onSendReleased?: () => void
	/** Called when the user explicitly chooses to discard the historical recording */
	onDiscardHistoricalRecording?: () => void
	/** Called when the user explicitly chooses to summarize (finish) the historical recording */
	onSummarizeHistoricalRecording?: () => void
}

/**
 * Lock request priority levels.
 * Higher value = higher priority. A pending request can be preempted
 * by a new request with strictly higher priority.
 */
export const LOCK_PRIORITY_BACKGROUND = 0 // used by automatic session restore
export const LOCK_PRIORITY_USER = 10 // used by direct user actions

interface PendingLockRequest {
	resolve: (value: boolean) => void
	timeoutId: NodeJS.Timeout
	priority: number
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
	/** Replaces the old lockRequestPending boolean — carries resolve + priority */
	private pendingLockRequest: PendingLockRequest | null = null
	/** Intent set by the handoff modal before requesting the lock */
	private lockAcquireIntent: LockAcquireIntent = "restore"
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
			// Another tab acquired the lock — cancel any pending request on this tab
			this.cancelPendingLockRequest(false)

			this.setCurrentLockHolder(message.tabId)
			if (this.status !== "inactive") {
				this.updateStatus("inactive")
			}

			if (this.modal) {
				this.modal?.destroy()
				this.modal = null
			}
		}
	}

	/**
	 * 从 localStorage 读取历史录音会话的摘要信息（不依赖 service 层）
	 */
	private getStoredSessionInfo(): { startTime: number; totalDuration: number } | null {
		try {
			const raw = localStorage.getItem("recordSummary_currentSession")
			if (!raw) return null
			const session = JSON.parse(raw)
			if (typeof session?.startTime === "number") {
				return { startTime: session.startTime, totalDuration: session.totalDuration ?? 0 }
			}
		} catch {
			// ignore
		}
		return null
	}

	/**
	 * 将毫秒时长格式化为 HH:mm:ss / mm:ss
	 */
	private formatDuration(ms: number): string {
		const totalSec = Math.floor(ms / 1000)
		const h = Math.floor(totalSec / 3600)
		const m = Math.floor((totalSec % 3600) / 60)
		const s = totalSec % 60
		const mm = String(m).padStart(2, "0")
		const ss = String(s).padStart(2, "0")
		return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
	}

	private handleLockReleased(message: TabMessage) {
		if (message.tabId === this.currentLockHolder) {
			this.setCurrentLockHolder(null)
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
				if (shouldSkipRecordingSessionRestoreOnCurrentRoute()) {
					logger.log("Skip restore modal on share/admin route")
					return
				}

				// 预加载录音总结服务和浮动面板
				import("@/services/recordSummary/utils/preloadService").then(
					({ preloadRecordSummaryService, preloadRecordSummaryFloatPanel }) => {
						preloadRecordSummaryService()
						preloadRecordSummaryFloatPanel()
					},
				)

				const sessionInfo = this.getStoredSessionInfo()

				this.modal = MagicModal.confirm({
					title: t("recordingSummary.restore.title", { ns: "super" }),
					content: (
						<div className="flex flex-col gap-2">
							<p>{t("recordingSummary.restore.content", { ns: "super" })}</p>
							{sessionInfo && (
								<div className="space-y-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
									<div className="flex gap-2">
										<span className="shrink-0 font-medium">
											{t("recordingSummary.restore.sessionStartTime", {
												ns: "super",
											})}
											：
										</span>
										<span>
											{new Date(sessionInfo.startTime).toLocaleString()}
										</span>
									</div>
									<div className="flex gap-2">
										<span className="shrink-0 font-medium">
											{t("recordingSummary.restore.sessionDuration", {
												ns: "super",
											})}
											：
										</span>
										<span>
											{this.formatDuration(sessionInfo.totalDuration)}
										</span>
									</div>
								</div>
							)}
						</div>
					),
					// 不允许通过遮罩或关闭按钮关闭，必须明确选择一个操作
					closable: false,
					maskClosable: false,
					// 使用自定义 footer 呈现三个操作按钮
					footer: (
						<div className="flex items-center justify-between border-t border-border bg-muted/60 p-4">
							<RecordSummaryActionButton
								appearance="danger"
								data-testid="record-restore-modal-discard-button"
								onClick={() => {
									this.modal?.destroy()
									this.modal = null
									this.callbacks.onDiscardHistoricalRecording?.()
								}}
							>
								{t("recordingSummary.restore.discard", { ns: "super" })}
							</RecordSummaryActionButton>
							<div className="flex items-center gap-2">
								<RecordSummaryActionButton
									appearance="secondary"
									data-testid="record-restore-modal-finish-button"
									onClick={() => {
										this.modal?.destroy()
										this.modal = null
										this.callbacks.onSummarizeHistoricalRecording?.()
									}}
								>
									{t("recordingSummary.restore.finish", { ns: "super" })}
								</RecordSummaryActionButton>
								<RecordSummaryActionButton
									appearance="primary"
									data-testid="record-restore-modal-restore-button"
									onClick={() => {
										this.modal?.destroy()
										this.modal = null
										this.requestLockWithDelay("restore")
									}}
								>
									{t("recordingSummary.restore.confirm", { ns: "super" })}
								</RecordSummaryActionButton>
							</div>
						</div>
					),
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
		if (!this.currentLockHolder) this.setCurrentLockHolder(message.tabId)
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

	/**
	 * Set the current lock holder and (re)start the holder-timeout watchdog.
	 * Call this instead of directly assigning `currentLockHolder` so the timeout
	 * is always in sync with the holder value.
	 */
	private setCurrentLockHolder(tabId: string | null) {
		this.currentLockHolder = tabId
		this.resetLockTimeout()
	}

	private resetLockTimeout() {
		if (this.lockTimeoutTimer) {
			clearTimeout(this.lockTimeoutTimer)
			this.lockTimeoutTimer = null
		}

		if (this.currentLockHolder && this.currentLockHolder !== this.tabId) {
			this.lockTimeoutTimer = setTimeout(() => {
				logger.log("Lock holder timeout, releasing lock", {
					holder: this.currentLockHolder,
				})
				this.currentLockHolder = null
				this.lockTimeoutTimer = null
			}, this.LOCK_TIMEOUT)
		}
	}

	/**
	 * Cancel the currently pending lock request (if any) and optionally resolve
	 * it with the given value so the caller's Promise settles immediately.
	 */
	private cancelPendingLockRequest(resolveValue: boolean) {
		if (this.pendingLockRequest) {
			clearTimeout(this.pendingLockRequest.timeoutId)
			this.pendingLockRequest.resolve(resolveValue)
			this.pendingLockRequest = null
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
			!this.pendingLockRequest // No pending request
		)
	}

	/**
	 * Get the intent stored for the next lock acquisition (used by callers
	 * such as `tabCoordinatorInstance` to decide what to do after the lock is
	 * granted from the handoff dialog).
	 */
	getLockAcquireIntent(): LockAcquireIntent {
		return this.lockAcquireIntent
	}

	/**
	 * Request lock with intelligent delay to reduce race conditions.
	 * @param intent What to do after acquiring the lock (default: "restore").
	 */
	private requestLockWithDelay(intent: LockAcquireIntent = "restore") {
		this.lockAcquireIntent = intent

		// Calculate delay based on tab priority
		const priority = this.calculateTabPriority()
		const delay = Math.max(0, (10 - priority) * 100) // Higher priority = lower delay

		logger.log("Requesting lock with delay", { priority, delay, intent })

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
	 * Request the recording lock.
	 *
	 * @param sessionId  Optional session ID (forwarded in the lock-request message).
	 * @param priority   Priority of this request (default: LOCK_PRIORITY_USER).
	 *                   A pending request with lower priority is cancelled and
	 *                   immediately resolved with `false` so the new request can
	 *                   proceed.  A request with equal or lower priority than an
	 *                   existing pending one resolves with `false` right away.
	 *
	 * The returned Promise is guaranteed to settle — it never hangs indefinitely.
	 */
	requestLock(sessionId?: string, priority: number = LOCK_PRIORITY_USER): Promise<boolean> {
		// Update user activity timestamp when user manually requests lock
		if (priority >= LOCK_PRIORITY_USER) {
			this.updateUserActivity()
		}

		return new Promise((resolve) => {
			if (this.status === "active") {
				resolve(true)
				return
			}

			if (this.pendingLockRequest) {
				if (priority > this.pendingLockRequest.priority) {
					// Preempt the lower-priority pending request
					logger.log("Preempting lower-priority lock request", {
						existingPriority: this.pendingLockRequest.priority,
						newPriority: priority,
					})
					this.cancelPendingLockRequest(false)
					// Fall through to start a new request below
				} else {
					// Equal or lower priority — yield immediately
					logger.log("Lock request yielded to higher-priority pending request", {
						pendingPriority: this.pendingLockRequest.priority,
						thisPriority: priority,
					})
					resolve(false)
					return
				}
			}

			this.updateStatus("pending")

			// Send lock request
			this.sendMessage({
				type: "RECORDING_LOCK_REQUEST",
				tabId: this.tabId,
				timestamp: Date.now(),
				data: { sessionId },
			})

			// Wait for response or timeout
			const timeoutId = setTimeout(() => {
				// Only act if this specific request is still the pending one
				if (this.pendingLockRequest?.timeoutId !== timeoutId) return

				this.pendingLockRequest = null

				if (this.status === "pending") {
					// No competing tab responded — we can take the lock
					this.acquireLock()
					resolve(true)
				} else {
					// Status changed (inactive/disconnected) — lock is taken or unavailable
					resolve(false)
					if (this.status !== "inactive") {
						this.updateStatus("inactive")
					}
				}
			}, 2000)

			this.pendingLockRequest = { resolve, timeoutId, priority }
		})
	}

	/**
	 * Acquire recording lock
	 */
	acquireLock() {
		// Clear any pending request — we already won the lock
		if (this.pendingLockRequest) {
			clearTimeout(this.pendingLockRequest.timeoutId)
			this.pendingLockRequest = null
		}

		this.currentLockHolder = this.tabId
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

		// Settle any pending lock request so callers are not left hanging
		this.cancelPendingLockRequest(false)

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
