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

const WORKER_DELAY_WARNING_COOLDOWN_MS = 60_000

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

export interface TimeTrackingWorkerDiagnostics {
	isRunning: boolean
	interval: number | null
	messageCount: number
	lastMessageTimestamp: number | null
	lastMessageInterval: number | null
	lastWorkerTimestamp: number | null
	lastDeliveryDelay: number | null
}

/**
 * TimeTrackingWorkerManager manages Web Worker for background time tracking
 * TimeTrackingWorkerManager 管理用于后台时间追踪的 Web Worker
 */
export class TimeTrackingWorkerManager {
	private worker: Worker | null = null
	private callback: TimeCheckCallback | null = null
	private messageCount = 0
	private lastMessageTimestamp: number | null = null
	private lastMessageInterval: number | null = null
	private lastWorkerTimestamp: number | null = null
	private lastDeliveryDelay: number | null = null
	private interval: number | null = null
	private lastDelayedWarningTimestamp: number | null = null

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
			this.messageCount = 0
			this.lastMessageTimestamp = null
			this.lastMessageInterval = null
			this.lastWorkerTimestamp = null
			this.lastDeliveryDelay = null
			this.interval = interval
			this.lastDelayedWarningTimestamp = null
			const heartbeatMessageInterval = Math.max(1, Math.ceil(60000 / interval))
			// Create Worker using Vite's ?worker import
			// 使用 Vite 的 ?worker import 创建 Worker
			this.worker = new TimeTrackingWorker()

			this.callback = callback

			// Set up message handler
			// 设置消息处理器
			this.worker.onmessage = (event: MessageEvent<TimeCheckMessage>) => {
				if (event.data.type === "timeCheck") {
					const now = Date.now()
					this.lastMessageInterval = this.lastMessageTimestamp
						? now - this.lastMessageTimestamp
						: null
					this.lastMessageTimestamp = now
					this.lastWorkerTimestamp = event.data.timestamp
					this.lastDeliveryDelay = now - event.data.timestamp
					this.messageCount++
					if (
						this.messageCount === 1 ||
						this.messageCount % heartbeatMessageInterval === 0
					) {
						this.logger.report({
							namespace: "recordingTimeTrackingWorker",
							data: {
								event: "heartbeat",
								interval,
								messageCount: this.messageCount,
								lastMessageInterval: this.lastMessageInterval,
								workerTimestamp: this.lastWorkerTimestamp,
								deliveryDelay: this.lastDeliveryDelay,
							},
						})
					}
					if (
						this.lastMessageInterval !== null &&
						this.lastMessageInterval > interval * 2 &&
						(this.lastDelayedWarningTimestamp === null ||
							now - this.lastDelayedWarningTimestamp >=
								WORKER_DELAY_WARNING_COOLDOWN_MS)
					) {
						this.logger.warn("TimeTrackingWorker message delayed", {
							interval,
							actualInterval: this.lastMessageInterval,
							messageCount: this.messageCount,
						})
						this.logger.report({
							namespace: "recordingTimeTrackingWorker",
							data: {
								event: "message_delayed",
								interval,
								actualInterval: this.lastMessageInterval,
								messageCount: this.messageCount,
							},
						})
						this.lastDelayedWarningTimestamp = now
					} else if (
						this.lastMessageInterval !== null &&
						this.lastMessageInterval <= interval * 2
					) {
						this.lastDelayedWarningTimestamp = null
					}
					this.callback?.()
				}
			}

			// Handle worker errors
			// 处理 Worker 错误
			this.worker.onerror = (error) => {
				this.logger.error({
					eventKey: "time_tracking_worker_failed",
					errorKind: "worker",
					error: error,
					message: "TimeTrackingWorker error:",
				})
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
			this.logger.error({
				eventKey: "start_time_tracking_worker_failed",
				errorKind: "worker",
				error: error,
				message: "Failed to start TimeTrackingWorker:",
			})
			this.worker?.terminate()
			this.worker = null
			this.callback = null
			this.interval = null
			this.lastDelayedWarningTimestamp = null
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
				this.logger.error({
					eventKey: "stopping_time_tracking_worker_failed",
					errorKind: "worker",
					error: error,
					message: "Error stopping TimeTrackingWorker:",
				})
			}

			this.worker = null
			this.callback = null
			this.interval = null
			this.lastDelayedWarningTimestamp = null
			this.logger.log("TimeTrackingWorker stopped")
		}
	}

	getDiagnostics(): TimeTrackingWorkerDiagnostics {
		return {
			isRunning: this.isRunning(),
			interval: this.interval,
			messageCount: this.messageCount,
			lastMessageTimestamp: this.lastMessageTimestamp,
			lastMessageInterval: this.lastMessageInterval,
			lastWorkerTimestamp: this.lastWorkerTimestamp,
			lastDeliveryDelay: this.lastDeliveryDelay,
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
