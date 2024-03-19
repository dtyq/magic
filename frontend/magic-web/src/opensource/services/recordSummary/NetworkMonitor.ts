import { recordingLogger } from "./utils/RecordingLogger"

const logger = recordingLogger.namespace("Network:Monitor")

/**
 * Network status change callback
 * 网络状态变化回调
 */
export type NetworkStatusCallback = (isOnline: boolean) => void

/**
 * Network monitor for detecting online/offline status
 * 网络状态监听器，用于检测在线/离线状态
 */
export class NetworkMonitor {
	private isOnline: boolean = navigator.onLine
	private listeners: Set<NetworkStatusCallback> = new Set()
	private handleOnline = () => this.updateStatus(true)
	private handleOffline = () => this.updateStatus(false)

	constructor() {
		this.initializeListeners()
		logger.log("Network monitor initialized", {
			initialStatus: this.isOnline ? "online" : "offline",
		})
	}

	/**
	 * Initialize native event listeners
	 * 初始化原生事件监听器
	 */
	private initializeListeners() {
		window.addEventListener("online", this.handleOnline)
		window.addEventListener("offline", this.handleOffline)
	}

	/**
	 * Update network status and notify listeners
	 * 更新网络状态并通知监听器
	 */
	private updateStatus(isOnline: boolean) {
		const previousStatus = this.isOnline
		this.isOnline = isOnline

		if (previousStatus !== isOnline) {
			logger.report("Network status changed", {
				from: previousStatus ? "online" : "offline",
				to: isOnline ? "online" : "offline",
			})

			// Notify all listeners
			this.listeners.forEach((callback) => {
				try {
					callback(isOnline)
				} catch (error) {
					logger.error("Error in network status callback", error)
				}
			})
		}
	}

	/**
	 * Subscribe to network status changes
	 * 订阅网络状态变化
	 */
	subscribe(callback: NetworkStatusCallback): () => void {
		this.listeners.add(callback)

		// Return unsubscribe function
		return () => {
			this.listeners.delete(callback)
		}
	}

	/**
	 * Get current network status
	 * 获取当前网络状态
	 */
	getStatus(): boolean {
		return this.isOnline
	}

	/**
	 * Check if currently online
	 * 检查是否在线
	 */
	isNetworkOnline(): boolean {
		return this.isOnline
	}

	/**
	 * Check if currently offline
	 * 检查是否离线
	 */
	isNetworkOffline(): boolean {
		return !this.isOnline
	}

	/**
	 * Wait for network to come online
	 * 等待网络恢复在线
	 */
	waitForOnline(timeout?: number): Promise<void> {
		// Already online
		if (this.isOnline) {
			return Promise.resolve()
		}

		return new Promise((resolve, reject) => {
			let timeoutId: NodeJS.Timeout | null = null
			let unsubscribe: (() => void) | null = null

			const cleanup = () => {
				if (timeoutId) clearTimeout(timeoutId)
				if (unsubscribe) unsubscribe()
			}

			unsubscribe = this.subscribe((isOnline) => {
				if (isOnline) {
					cleanup()
					resolve()
				}
			})

			if (timeout) {
				timeoutId = setTimeout(() => {
					cleanup()
					reject(new Error("Timeout waiting for network"))
				}, timeout)
			}
		})
	}

	/**
	 * Dispose and cleanup
	 * 销毁并清理资源
	 */
	dispose() {
		window.removeEventListener("online", this.handleOnline)
		window.removeEventListener("offline", this.handleOffline)
		this.listeners.clear()
		logger.log("Network monitor disposed")
	}
}

/**
 * Singleton instance for global use
 * 单例实例供全局使用
 */
let globalNetworkMonitor: NetworkMonitor | null = null

/**
 * Get or create global network monitor instance
 * 获取或创建全局网络监听器实例
 */
export function getNetworkMonitor(): NetworkMonitor {
	if (!globalNetworkMonitor) {
		globalNetworkMonitor = new NetworkMonitor()
	}
	return globalNetworkMonitor
}

/**
 * Dispose global network monitor
 * 销毁全局网络监听器
 */
export function disposeNetworkMonitor() {
	if (globalNetworkMonitor) {
		globalNetworkMonitor.dispose()
		globalNetworkMonitor = null
	}
}
