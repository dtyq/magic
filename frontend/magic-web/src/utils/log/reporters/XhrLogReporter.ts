import type { ILogReporter, LogReporterConfig, ReportResult } from "./ILogReporter"

/**
 * 基于 XMLHttpRequest 的简化日志上报器
 * 提供更好的兼容性，支持老版本浏览器
 */
class XhrLogReporter implements ILogReporter {
	private config: Required<LogReporterConfig>
	private isDestroyed = false

	constructor(config: LogReporterConfig = {}) {
		this.config = {
			url: config.url || "/log-report",
			timeout: config.timeout || 10000,
			headers: {
				"Content-Type": "application/json",
				...config.headers,
			},
			enabled: config.enabled ?? true,
		}
	}

	getName(): string {
		return "XhrLogReporter"
	}

	isAvailable(): boolean {
		return !this.isDestroyed && this.config.enabled && typeof XMLHttpRequest !== "undefined"
	}

	async report(logData: Record<string, any> | Record<string, any>[]): Promise<ReportResult> {
		if (!this.isAvailable()) {
			return {
				success: false,
				error: new Error("Reporter not available"),
				timestamp: Date.now(),
			}
		}

		const startTime = Date.now()

		// 处理单条或多条数据
		const payload = Array.isArray(logData)
			? logData.length === 1
				? logData[0]
				: { logs: logData }
			: logData

		return new Promise((resolve) => {
			const xhr = new XMLHttpRequest()

			// 设置超时
			xhr.timeout = this.config.timeout

			// 配置请求
			xhr.open("POST", this.config.url, true)

			// 设置请求头
			Object.entries(this.config.headers).forEach(([key, value]) => {
				xhr.setRequestHeader(key, value)
			})

			// 成功回调
			xhr.onload = () => {
				const duration = Date.now() - startTime

				if (xhr.status >= 200 && xhr.status < 300) {
					resolve({
						success: true,
						timestamp: startTime,
						duration,
					})
				} else {
					resolve({
						success: false,
						error: new Error(`HTTP ${xhr.status}: ${xhr.statusText}`),
						timestamp: startTime,
						duration,
					})
				}
			}

			// 错误回调
			xhr.onerror = () => {
				const duration = Date.now() - startTime
				resolve({
					success: false,
					error: new Error("Network error"),
					timestamp: startTime,
					duration,
				})
			}

			// 超时回调
			xhr.ontimeout = () => {
				const duration = Date.now() - startTime
				resolve({
					success: false,
					error: new Error("Request timeout"),
					timestamp: startTime,
					duration,
				})
			}

			// 中止回调
			xhr.onabort = () => {
				const duration = Date.now() - startTime
				resolve({
					success: false,
					error: new Error("Request aborted"),
					timestamp: startTime,
					duration,
				})
			}

			// 发送请求
			try {
				xhr.send(JSON.stringify(payload))
			} catch (error) {
				const duration = Date.now() - startTime
				resolve({
					success: false,
					error: error as Error,
					timestamp: startTime,
					duration,
				})
			}
		})
	}

	destroy(): void {
		this.isDestroyed = true
	}
}

export { XhrLogReporter }
