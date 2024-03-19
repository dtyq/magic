import type { ILogReporter, LogReporterConfig, ReportResult } from "./ILogReporter"

/**
 * 基于 Fetch API 的简化日志上报器
 * 只负责单次上报，不处理队列逻辑
 */
class FetchLogReporter implements ILogReporter {
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
		return "FetchLogReporter"
	}

	isAvailable(): boolean {
		return (
			!this.isDestroyed &&
			this.config.enabled &&
			typeof fetch !== "undefined" &&
			typeof window !== "undefined"
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
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

			// 处理单条或多条数据
			const payload = Array.isArray(logData)
				? logData.length === 1
					? logData[0]
					: { logs: logData }
				: logData

			const response = await fetch(this.config.url, {
				method: "POST",
				headers: this.config.headers,
				body: JSON.stringify(payload),
				signal: controller.signal,
			})

			clearTimeout(timeoutId)
			const duration = Date.now() - startTime

			if (response.ok) {
				return {
					success: true,
					timestamp: startTime,
					duration,
				}
			}

			return {
				success: false,
				error: new Error(`HTTP ${response.status}: ${response.statusText}`),
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

	destroy(): void {
		this.isDestroyed = true
	}
}

export { FetchLogReporter }
