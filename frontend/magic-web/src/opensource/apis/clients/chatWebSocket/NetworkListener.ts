import { logger as Logger } from "@/opensource/utils/log"

const logger = Logger.createLogger("network listener")

/**
 * 网络状态监听器
 * 负责监听网络状态变化，并提供状态查询接口
 */
export class NetworkListener {
	private isOnline = true
	private initialized = false
	private onlineHandler: (() => void) | null = null
	private offlineHandler: (() => void) | null = null
	private onOnlineChangeCallback: ((online: boolean) => void) | null = null

	/**
	 * 初始化网络状态监听
	 */
	init() {
		if (this.initialized) return

		// 浏览器环境检查
		if (typeof window === "undefined" || typeof navigator === "undefined") return

		this.isOnline = navigator.onLine
		this.initialized = true

		this.onlineHandler = () => {
			const wasOffline = !this.isOnline
			this.isOnline = true

			if (wasOffline && this.onOnlineChangeCallback) {
				this.onOnlineChangeCallback(true)
			}
		}

		this.offlineHandler = () => {
			this.isOnline = false
			if (this.onOnlineChangeCallback) {
				this.onOnlineChangeCallback(false)
			}
		}

		window.addEventListener("online", this.onlineHandler)
		window.addEventListener("offline", this.offlineHandler)
		logger.log("网络状态监听器已初始化")
	}

	/**
	 * 设置网络状态变化回调
	 * @param callback 当网络状态变化时调用的回调函数
	 */
	onOnlineChange(callback: (online: boolean) => void) {
		this.onOnlineChangeCallback = callback
	}

	/**
	 * 获取当前网络是否在线
	 * @returns 网络是否在线
	 */
	getIsOnline(): boolean {
		return this.isOnline
	}

	/**
	 * 清理网络状态监听器
	 */
	destroy() {
		if (typeof window === "undefined") return

		if (this.onlineHandler) {
			window.removeEventListener("online", this.onlineHandler)
			this.onlineHandler = null
		}

		if (this.offlineHandler) {
			window.removeEventListener("offline", this.offlineHandler)
			this.offlineHandler = null
		}

		this.initialized = false
	}
}
