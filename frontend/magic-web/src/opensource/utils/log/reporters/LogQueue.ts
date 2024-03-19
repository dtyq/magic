import { requestIdleCallback } from "../utils"
import type { ILogReporter } from "./ILogReporter"

/**
 * 日志队列配置接口
 */
interface LogQueueConfig {
	/**
	 * 批量大小
	 */
	batchSize?: number

	/**
	 * 延迟发送时间（毫秒）
	 */
	delayMs?: number

	/**
	 * 重试次数
	 */
	retryCount?: number

	/**
	 * 重试间隔（毫秒）
	 */
	retryDelayMs?: number

	/**
	 * 最大队列长度
	 */
	maxQueueSize?: number

	/**
	 * 是否启用
	 */
	enabled?: boolean
}

/**
 * 队列状态接口
 */
interface QueueStats {
	pendingCount: number
	sentCount: number
	failedCount: number
	retryCount: number
}

/**
 * 独立的日志队列管理器
 * 负责批量处理、延迟发送、重试机制等
 */
class LogQueue {
	private config: Required<LogQueueConfig>
	private reporter: ILogReporter
	private pendingLogs: Record<string, any>[] = []
	private batchTimer: number | null = null
	private isDestroyed = false
	private stats: QueueStats = {
		pendingCount: 0,
		sentCount: 0,
		failedCount: 0,
		retryCount: 0,
	}

	constructor(reporter: ILogReporter, config: LogQueueConfig = {}) {
		this.reporter = reporter
		this.config = {
			batchSize: config.batchSize || 10,
			delayMs: config.delayMs || 5000,
			retryCount: config.retryCount || 3,
			retryDelayMs: config.retryDelayMs || 1000,
			maxQueueSize: config.maxQueueSize || 1000,
			enabled: config.enabled ?? true,
		}

		// 页面卸载时处理剩余日志
		this.setupBeforeUnloadHandler()
	}

	/**
	 * 添加日志到队列
	 */
	async enqueue(logData: Record<string, any>): Promise<boolean> {
		if (!this.config.enabled || this.isDestroyed || !this.reporter.isAvailable()) {
			return false
		}

		// 检查队列是否已满
		if (this.pendingLogs.length >= this.config.maxQueueSize) {
			console.warn("LogQueue: Queue is full, dropping oldest logs")
			this.pendingLogs.shift() // 移除最旧的日志
		}

		// 添加到队列
		this.pendingLogs.push(logData)
		this.stats.pendingCount++

		// 如果批量大小为 1，立即发送
		if (this.config.batchSize === 1) {
			return this.processQueue()
		}

		// 如果达到批量大小，立即发送
		if (this.pendingLogs.length >= this.config.batchSize) {
			return this.processQueue()
		}

		// 设置延迟发送定时器
		this.scheduleBatchSend()
		return true
	}

	/**
	 * 立即处理队列中的所有日志
	 */
	async flush(): Promise<boolean> {
		if (this.batchTimer) {
			clearTimeout(this.batchTimer)
			this.batchTimer = null
		}

		return this.processQueue()
	}

	/**
	 * 获取队列统计信息
	 */
	getStats(): QueueStats {
		return {
			...this.stats,
			pendingCount: this.pendingLogs.length,
		}
	}

	/**
	 * 清空队列
	 */
	clear(): void {
		this.pendingLogs = []
		this.stats.pendingCount = 0

		if (this.batchTimer) {
			clearTimeout(this.batchTimer)
			this.batchTimer = null
		}
	}

	/**
	 * 销毁队列
	 */
	destroy(): void {
		this.isDestroyed = true

		// 尝试发送剩余日志
		if (this.pendingLogs.length > 0) {
			this.processQueue().catch((error) => {
				console.error("LogQueue: Failed to flush logs on destroy:", error)
			})
		}

		this.clear()
		this.removeBeforeUnloadHandler()
	}

	private scheduleBatchSend(): void {
		if (this.batchTimer) {
			return
		}

		this.batchTimer = window.setTimeout(() => {
			this.batchTimer = null
			this.processQueue()
		}, this.config.delayMs)
	}

	private async processQueue(): Promise<boolean> {
		if (this.pendingLogs.length === 0) {
			return true
		}

		const logsToSend = this.pendingLogs.splice(0, this.config.batchSize)

		return new Promise((resolve) => {
			requestIdleCallback(async () => {
				try {
					const success = await this.sendWithRetry(logsToSend)
					resolve(success)
				} catch (error) {
					console.error("LogQueue: Failed to process queue:", error)
					this.stats.failedCount += logsToSend.length
					resolve(false)
				}
			})
		})
	}

	private async sendWithRetry(
		logs: Record<string, any>[],
		attempt: number = 1,
	): Promise<boolean> {
		try {
			const result = await this.reporter.report(logs)

			if (result.success) {
				this.stats.sentCount += logs.length
				this.stats.pendingCount -= logs.length
				return true
			}

			// 如果失败且还有重试机会
			if (attempt < this.config.retryCount) {
				this.stats.retryCount++

				// 等待一段时间后重试
				await this.delay(this.config.retryDelayMs * Math.pow(2, attempt - 1))
				return this.sendWithRetry(logs, attempt + 1)
			}

			// 重试次数用完，标记为失败
			this.stats.failedCount += logs.length
			this.stats.pendingCount -= logs.length
			console.error("LogQueue: Failed to send logs after retries:", result.error)
			return false
		} catch (error) {
			// 如果还有重试机会
			if (attempt < this.config.retryCount) {
				this.stats.retryCount++
				await this.delay(this.config.retryDelayMs * Math.pow(2, attempt - 1))
				return this.sendWithRetry(logs, attempt + 1)
			}

			this.stats.failedCount += logs.length
			this.stats.pendingCount -= logs.length
			throw error
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	private beforeUnloadHandler: (() => void) | null = null

	private setupBeforeUnloadHandler(): void {
		if (typeof window === "undefined") {
			return
		}

		this.beforeUnloadHandler = () => {
			// 页面卸载时立即发送剩余日志
			if (this.pendingLogs.length > 0) {
				// 使用 sendBeacon 如果可能，否则尝试同步发送
				this.flush()
			}
		}

		window.addEventListener("beforeunload", this.beforeUnloadHandler)
		window.addEventListener("pagehide", this.beforeUnloadHandler)
		window.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden" && this.beforeUnloadHandler) {
				this.beforeUnloadHandler()
			}
		})
	}

	private removeBeforeUnloadHandler(): void {
		if (this.beforeUnloadHandler && typeof window !== "undefined") {
			window.removeEventListener("beforeunload", this.beforeUnloadHandler)
			window.removeEventListener("pagehide", this.beforeUnloadHandler)
			this.beforeUnloadHandler = null
		}
	}
}

export { LogQueue, type LogQueueConfig, type QueueStats }
