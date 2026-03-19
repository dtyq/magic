/**
 * Manager for time tracking Web Worker
 * 时间追踪 Web Worker 管理器
 *
 * Provides reliable time checking using Web Worker, which is not affected
 * by browser tab visibility or main thread throttling.
 * 使用 Web Worker 提供可靠的时间检查，不受浏览器标签页可见性或主线程降频影响。
 */

import type { LoggerInterface } from "../types/RecorderDependencies"
import TimeTrackingWorker from "../workers/time-tracking-worker?worker"

/**
 * Callback function for time check events
 * 时间检查事件的回调函数
 */
export interface TimeCheckCallback {
	(): void
}

/**
 * Worker message types
 * Worker 消息类型
 */
interface TimeCheckCommand {
	type: "start" | "stop"
	interval?: number
}

interface TimeCheckMessage {
	type: "timeCheck"
	timestamp: number
}

/**
 * TimeTrackingWorkerManager manages Web Worker for background time tracking
 * TimeTrackingWorkerManager 管理用于后台时间追踪的 Web Worker
 */
export class TimeTrackingWorkerManager {
	private worker: Worker | null = null
	private callback: TimeCheckCallback | null = null

	constructor(private readonly logger: LoggerInterface) {}

	/**
	 * Start time tracking worker
	 * 启动时间追踪 Worker
	 *
	 * @param callback - Callback to invoke on time check
	 * @param interval - Check interval in milliseconds
	 */
	start(callback: TimeCheckCallback, interval: number = 1000): void {
		try {
			// Create Worker using Vite's ?worker import
			// 使用 Vite 的 ?worker import 创建 Worker
			this.worker = new TimeTrackingWorker()

			this.callback = callback

			// Set up message handler
			// 设置消息处理器
			this.worker.onmessage = (event: MessageEvent<TimeCheckMessage>) => {
				if (event.data.type === "timeCheck") {
					this.callback?.()
				}
			}

			// Handle worker errors
			// 处理 Worker 错误
			this.worker.onerror = (error) => {
				this.logger.error("TimeTrackingWorker error:", error)
			}

			// Start periodic checking
			// 启动定期检查
			const command: TimeCheckCommand = {
				type: "start",
				interval,
			}
			this.worker.postMessage(command)

			this.logger.log("TimeTrackingWorker started", { interval })
		} catch (error) {
			this.logger.error("Failed to start TimeTrackingWorker:", error)
			// Don't throw - allow system to work without Worker fallback
			// 不抛出异常 - 允许系统在没有 Worker 兜底的情况下工作
		}
	}

	/**
	 * Stop time tracking worker
	 * 停止时间追踪 Worker
	 */
	stop(): void {
		if (this.worker) {
			try {
				// Send stop command
				// 发送停止命令
				const command: TimeCheckCommand = {
					type: "stop",
				}
				this.worker.postMessage(command)

				// Terminate worker
				// 终止 Worker
				this.worker.terminate()
			} catch (error) {
				this.logger.error("Error stopping TimeTrackingWorker:", error)
			}

			this.worker = null
			this.callback = null
			this.logger.log("TimeTrackingWorker stopped")
		}
	}

	/**
	 * Check if worker is running
	 * 检查 Worker 是否正在运行
	 */
	isRunning(): boolean {
		return this.worker !== null
	}
}
