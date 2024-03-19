import type { ILogReporter, LogReporterConfig, ReportResult } from "./ILogReporter"

/**
 * 基于 Navigator.sendBeacon 的简化日志上报器
 * 适用于页面关闭前的可靠日志发送，不会被页面卸载中断
 */
class BeaconLogReporter implements ILogReporter {
	private config: Required<LogReporterConfig>
	private isDestroyed = false

	constructor(config: LogReporterConfig = {}) {
		this.config = {
			url: config.url || "/log-report",
			timeout: config.timeout || 5000, // Beacon 不支持超时，仅作配置保留
			headers: config.headers || {}, // Beacon 不支持自定义头，仅作配置保留
			enabled: config.enabled ?? true,
		}
	}

	getName(): string {
		return "BeaconLogReporter"
	}

	isAvailable(): boolean {
		return (
			!this.isDestroyed &&
			this.config.enabled &&
			typeof navigator !== "undefined" &&
			typeof navigator.sendBeacon === "function"
		)
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

		try {
			// 处理单条或多条数据
			const logs = Array.isArray(logData) ? logData : [logData]
			const payload = logs.length === 1 ? logs[0] : { logs }
			const data = JSON.stringify(payload)

			// 检查数据大小限制（Beacon 通常限制在 64KB）
			const dataSize = new Blob([data]).size
			if (dataSize > 64 * 1024) {
				console.warn(
					`${this.getName()}: Payload size (${dataSize} bytes) exceeds recommended limit (64KB)`,
				)

				// 如果数据过大且是多条数据，分批发送
				if (logs.length > 1) {
					return this.sendInBatches(logs, startTime)
				}
			}

			const success = navigator.sendBeacon(this.config.url, data)
			const duration = Date.now() - startTime

			if (!success) {
				return {
					success: false,
					error: new Error("Failed to queue beacon request"),
					timestamp: startTime,
					duration,
				}
			}

			return {
				success: true,
				timestamp: startTime,
				duration,
			}
		} catch (error) {
			const duration = Date.now() - startTime
			return {
				success: false,
				error: error as Error,
				timestamp: startTime,
				duration,
			}
		}
	}

	private async sendInBatches(
		logs: Record<string, any>[],
		startTime: number,
	): Promise<ReportResult> {
		const batchSize = Math.max(1, Math.floor(logs.length / 2))
		let allSuccess = true
		let lastError: Error | undefined

		for (let i = 0; i < logs.length; i += batchSize) {
			const batch = logs.slice(i, i + batchSize)
			const result = await this.report(batch)

			if (!result.success) {
				allSuccess = false
				lastError = result.error
			}
		}

		const duration = Date.now() - startTime
		return {
			success: allSuccess,
			error: lastError,
			timestamp: startTime,
			duration,
		}
	}

	destroy(): void {
		this.isDestroyed = true
	}
}

export { BeaconLogReporter }
