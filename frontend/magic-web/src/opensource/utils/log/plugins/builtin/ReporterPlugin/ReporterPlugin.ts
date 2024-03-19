import type { LogContext, LoggerPlugin } from "../../types"
import { LogType } from "../../types"
// import { requestIdleCallback } from "../../../utils"
import { fetch } from "../../../helpers/fetch"
import { compressLogData, CompressionType, type CompressionConfig } from "./compression"
import { isDev } from "@/opensource/utils/env"
import { merge, chunk } from "lodash-es"

/**
 * 上报插件配置
 */
export interface ReporterPluginOptions {
	/** 是否启用 */
	enabled?: boolean
	/** 上报配置 */
	reporter?: {
		/** 上报URL */
		url?: string
		/** 需要上报的日志级别 */
		logType?: LogType[]
		/** 是否在开发环境上报 */
		enableInDev?: boolean
		/** 请求头 */
		headers?: Record<string, string>
		/** 请求超时时间 */
		timeout?: number
		/** 压缩配置 */
		compression?: CompressionConfig
		/** 批量上报配置 */
		batch?: {
			/** 是否启用批量上报 */
			enabled?: boolean
			/** 批量大小 */
			size?: number
			/** 批量间隔（毫秒） */
			interval?: number
		}
		/** 重试配置 */
		retry?: {
			/** 最大重试次数 */
			maxRetries?: number
			/** 重试间隔（毫秒） */
			interval?: number
		}
	}
}

/**
 * 日志上报插件
 * 负责将日志发送到服务器
 */
export class ReporterPlugin implements LoggerPlugin {
	readonly name = "reporter"
	readonly version = "1.0.0"
	readonly priority = 100 // 最低优先级，最后执行

	enabled = true
	private options: ReporterPluginOptions
	private batchQueue: LogContext[] = []
	private batchTimer: NodeJS.Timeout | null = null

	constructor(options: ReporterPluginOptions = {}) {
		this.options = merge(
			{
				enabled: true,
				reporter: {
					url: "/log-report",
					logType: [LogType.ERROR, LogType.REPORT],
					enableInDev: false,
					headers: {
						"Content-Type": "application/json",
					},
					timeout: 5000,
					compression: {
						type: CompressionType.GZIP,
						threshold: 0,
					},
					batch: {
						enabled: true,
						size: 30,
						interval: 5000,
					},
					retry: {
						maxRetries: 2,
						interval: 1000,
					},
				},
			},
			options || {},
		)
		this.enabled = this.options.enabled ?? true
	}

	init() {
		// 聚拢页面销毁、关闭前日志队列的消费
		const beforeUnloadHandler = () => {
			const logs = this.batchQueue.splice(0).map((context) => this.formatLogData(context))
			chunk(logs, 30).map((o) => this.reportLogs(o))
		}
		window.addEventListener("beforeunload", beforeUnloadHandler)
	}

	/**
	 * 检查是否应该处理此日志
	 */
	shouldHandle(context: LogContext): boolean {
		const reporterConfig = this.options.reporter!
		// 检查是否跳过上报
		if (context.skipReport) {
			return false
		}

		// 检查日志级别
		if (!reporterConfig.logType?.includes(context.logType)) {
			return false
		}

		// 检查开发环境设置
		if (isDev && !reporterConfig.enableInDev) {
			return false
		}

		return true
	}

	/**
	 * 处理日志上下文 - 上报日志
	 */
	process(context: LogContext): LogContext {
		const reporterConfig = this.options.reporter!

		try {
			if (reporterConfig.batch?.enabled) {
				this.addToBatch(context)
			} else {
				this.sendLog(context)
			}
		} catch (error) {
			console.error("Reporter plugin failed:", error)
		}

		return context
	}

	/**
	 * 发送单条日志
	 */
	private sendLog(context: LogContext): void {
		const logData = this.formatLogData(context)
		this.reportLogs([logData])
	}

	/**
	 * 添加到批量队列
	 */
	private addToBatch(context: LogContext): void {
		const batchConfig = this.options.reporter!.batch!

		this.batchQueue.push(context)

		// 检查是否达到批量大小
		if (this.batchQueue.length >= (batchConfig.size || 10)) {
			this.flushBatch()
		} else if (!this.batchTimer) {
			// 设置定时器
			this.batchTimer = setTimeout(() => {
				this.flushBatch()
			}, batchConfig.interval || 2000)
		}
	}

	/**
	 * 刷新批量队列
	 */
	private flushBatch(): void {
		if (this.batchQueue.length === 0) return

		const logs = this.batchQueue.splice(0).map((context) => this.formatLogData(context))
		this.reportLogs(logs)

		// 清除定时器
		if (this.batchTimer) {
			clearTimeout(this.batchTimer)
			this.batchTimer = null
		}
	}

	/**
	 * 格式化日志数据
	 */
	private formatLogData(context: LogContext) {
		return {
			logType: context.logType,
			traceId: context.traceId,
			namespace: context.namespace,
			url: context.url,
			data: context.data,
			info: context.info,
			timestamp: context.timestamp,
		}
	}

	/**
	 * 上报日志数据
	 */
	private reportLogs(logData: any): void {
		// requestIdleCallback(async () => {
		// 	await this.sendRequest(logData, 0)
		// })
		this.sendRequest(logData, 0)
	}

	/**
	 * 发送请求（支持重试）
	 */
	private async sendRequest(logData: any, retryCount: number): Promise<void> {
		const reporterConfig = this.options.reporter!
		const retryConfig = reporterConfig.retry!

		try {
			// 压缩日志数据
			const compressionResult = await compressLogData(logData, reporterConfig.compression)

			// 准备请求头
			const headers = { ...reporterConfig.headers }
			let body: string | Uint8Array

			if (compressionResult.compressed) {
				// 根据压缩类型设置相应的头部
				switch (compressionResult.type) {
					case CompressionType.GZIP:
						headers["Content-Encoding"] = "gzip"
						headers["Content-Type"] = "application/octet-stream"
						body = compressionResult.data as Uint8Array
						break
					case CompressionType.LZ_STRING:
						headers["X-Compression"] = "lz-string"
						headers["Content-Type"] = "application/json"
						body = compressionResult.data as string
						break
					default:
						headers["Content-Type"] = "application/json"
						body = compressionResult.data as string
						break
				}
			} else {
				headers["Content-Type"] = "application/json"
				body = compressionResult.data as string
			}

			// const controller = new AbortController()
			// const timeoutId = setTimeout(() => controller.abort(), reporterConfig.timeout || 5000)

			const response = await fetch.internalFetch(reporterConfig.url!, {
				method: "POST",
				headers,
				body,
				keepalive: true,
				// signal: controller.signal,
			})

			// clearTimeout(timeoutId)

			if (!response.ok) {
				console.error(`HTTP ${response.status}: ${response.statusText}`)
			} else {
				// // 记录压缩效果（仅在开发模式下）
				// if (isDev && compressionResult.compressed) {
				// 	console.log(
				// 		`Log compression: ${compressionResult.originalSize} -> ${compressionResult.compressedSize} bytes ` +
				// 			`(${((1 - compressionResult.ratio) * 100).toFixed(1)}% saved)`,
				// 	)
				// }
			}
		} catch (error) {
			console.error("Failed to report logs:", error)

			// 检查是否需要重试
			if (retryCount < (retryConfig.maxRetries || 3)) {
				setTimeout(() => {
					this.sendRequest(logData, retryCount + 1)
				}, retryConfig.interval || 1000)
			}
		}
	}

	/**
	 * 插件销毁
	 */
	destroy(): void {
		// 刷新剩余的批量数据
		this.flushBatch()

		// 清除定时器
		if (this.batchTimer) {
			clearTimeout(this.batchTimer)
			this.batchTimer = null
		}
	}

	/**
	 * 获取队列状态
	 */
	getQueueStatus() {
		return {
			queueSize: this.batchQueue.length,
			batchEnabled: this.options.reporter?.batch?.enabled || false,
			hasPendingTimer: this.batchTimer !== null,
		}
	}

	/**
	 * 手动刷新队列
	 */
	flush(): void {
		this.flushBatch()
	}
}

/**
 * 上报插件工厂函数
 */
export function createReporterPlugin(options?: ReporterPluginOptions): ReporterPlugin {
	return new ReporterPlugin(options)
}
