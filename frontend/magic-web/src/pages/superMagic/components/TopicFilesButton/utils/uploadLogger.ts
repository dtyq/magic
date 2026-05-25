import { logger as Logger } from "@/utils/log"

const serverLogger = Logger.createLogger("topicFilesUploadLogger")

function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp)
	const hours = String(date.getHours()).padStart(2, "0")
	const minutes = String(date.getMinutes()).padStart(2, "0")
	const seconds = String(date.getSeconds()).padStart(2, "0")
	const ms = String(date.getMilliseconds()).padStart(3, "0")
	return `${hours}:${minutes}:${seconds}.${ms}`
}

interface UploadLog {
	timestamp: number
	time: string
	stage: string
	data: Record<string, unknown>
	error?: unknown
}

class UploadLogger {
	private enabled = false
	private reportToServer = false
	private logs: UploadLog[] = []
	private sessionId: string | null = null
	private startTime = 0

	constructor() {
		if (typeof window === "undefined") return

		const savedState = window.localStorage.getItem("uploadLoggerEnabled")
		if (savedState === "true") {
			this.enabled = true
			console.log("📋 上传日志记录器已启用（从上次会话恢复）")
		}

		const savedReportState = window.localStorage.getItem("uploadLoggerReportToServer")
		if (savedReportState === "true") {
			this.reportToServer = true
			console.log("📤 上传日志将上报到线上日志系统")
		}
	}

	enable() {
		this.enabled = true
		if (typeof window !== "undefined") {
			window.localStorage.setItem("uploadLoggerEnabled", "true")
		}
		console.log("📋 上传日志记录器已启用")
	}

	disable() {
		this.enabled = false
		if (typeof window !== "undefined") {
			window.localStorage.removeItem("uploadLoggerEnabled")
		}
		console.log("📋 上传日志记录器已关闭")
	}

	enableServerReport() {
		this.reportToServer = true
		if (typeof window !== "undefined") {
			window.localStorage.setItem("uploadLoggerReportToServer", "true")
		}
		console.log("📤 已开启上传日志线上上报（仅关键错误）")
	}

	disableServerReport() {
		this.reportToServer = false
		if (typeof window !== "undefined") {
			window.localStorage.removeItem("uploadLoggerReportToServer")
		}
		console.log("📴 已关闭上传日志线上上报")
	}

	isEnabled() {
		return this.enabled
	}

	startSession(data: Record<string, unknown>) {
		if (!this.enabled) return

		this.sessionId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
		this.startTime = Date.now()
		this.logs = []

		console.log(`🎬 开始上传会话: ${this.sessionId} at ${formatTimestamp(this.startTime)}`)
		this.log("uploadStart", data)
	}

	log(stage: string, data: Record<string, unknown> = {}) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const elapsed = this.startTime ? timestamp - this.startTime : 0
		const log: UploadLog = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage,
			data: {
				...data,
				sessionId: this.sessionId,
				elapsed,
			},
		}

		this.logs.push(log)
		console.log(`📤 [${stage}] ${log.time} (+${elapsed}ms)`, log.data)
	}

	logError(stage: string, error: unknown, extraData?: Record<string, unknown>) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const elapsed = this.startTime ? timestamp - this.startTime : 0
		const log: UploadLog = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage: `${stage}_error`,
			data: {
				...extraData,
				sessionId: this.sessionId,
				elapsed,
			},
			error,
		}

		this.logs.push(log)
		console.error(`❌ [${stage}] ${log.time} (+${elapsed}ms) 上传链路错误`, log.data, error)

		if (this.reportToServer) {
			serverLogger.error(`[UploadLogger] ${stage} 发生错误`, {
				sessionId: this.sessionId,
				time: log.time,
				stage,
				...extraData,
				error,
			})
		}
	}

	finishSession(data: Record<string, unknown> = {}) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const totalElapsed = this.startTime ? timestamp - this.startTime : 0
		const log: UploadLog = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage: "uploadEnd",
			data: {
				...data,
				sessionId: this.sessionId,
				totalElapsed,
			},
		}

		this.logs.push(log)
		console.log(`🏁 [uploadEnd] ${log.time} 上传会话结束 (总耗时: ${totalElapsed}ms)`, log.data)
		this.printSummary()
	}

	private printSummary() {
		if (!this.enabled || this.logs.length === 0) return

		const stages = this.logs.map((log) => log.stage)
		const hasErrors = this.logs.some((log) => log.error)
		const totalTime = this.logs[this.logs.length - 1]?.timestamp - this.logs[0]?.timestamp

		console.log("📊 上传会话摘要", {
			sessionId: this.sessionId,
			totalStages: stages.length,
			stages,
			hasErrors,
			totalTime: `${totalTime}ms`,
			logsCount: this.logs.length,
		})

		if (hasErrors) {
			console.warn("⚠️ 本次上传会话包含错误，请运行 window.getUploadLogs() 查看详细信息")
		}
	}

	getLogs() {
		return this.logs
	}

	exportLogs() {
		const exportData = {
			sessionId: this.sessionId,
			startTime: this.startTime,
			startTimeFormatted: this.startTime ? formatTimestamp(this.startTime) : "",
			totalTime: this.startTime ? Date.now() - this.startTime : 0,
			logsCount: this.logs.length,
			logs: this.logs,
		}
		const json = JSON.stringify(exportData, null, 2)

		console.log("📋 上传日志导出：")
		console.log(json)

		if (typeof navigator !== "undefined" && navigator.clipboard) {
			navigator.clipboard
				.writeText(json)
				.then(() => {
					console.log("✅ 日志已复制到剪贴板")
				})
				.catch((error) => {
					console.error("❌ 复制到剪贴板失败", error)
				})
		}

		return exportData
	}

	clearLogs() {
		this.logs = []
		this.sessionId = null
		this.startTime = 0
		console.log("🗑️ 上传日志已清空")
	}
}

export const uploadLogger = new UploadLogger()

declare global {
	interface Window {
		uploadLogger: UploadLogger
		enableUploadLogger: () => void
		disableUploadLogger: () => void
		enableUploadLoggerServerReport: () => void
		disableUploadLoggerServerReport: () => void
		getUploadLogs: () => UploadLog[]
		exportUploadLogs: () => ReturnType<UploadLogger["exportLogs"]>
		clearUploadLogs: () => void
	}
}

if (typeof window !== "undefined") {
	window.uploadLogger = uploadLogger
	window.enableUploadLogger = () => uploadLogger.enable()
	window.disableUploadLogger = () => uploadLogger.disable()
	window.enableUploadLoggerServerReport = () => uploadLogger.enableServerReport()
	window.disableUploadLoggerServerReport = () => uploadLogger.disableServerReport()
	window.getUploadLogs = () => {
		console.table(uploadLogger.getLogs())
		return uploadLogger.getLogs()
	}
	window.exportUploadLogs = () => uploadLogger.exportLogs()
	window.clearUploadLogs = () => uploadLogger.clearLogs()
}
