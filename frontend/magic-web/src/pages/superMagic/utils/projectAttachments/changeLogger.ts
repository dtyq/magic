import { logger as Logger } from "@/infrastructure/logger"

const logger = Logger.createLogger("projectAttachmentsChangeLogger")
const STORAGE_KEY = "projectAttachmentsChangeLoggerEnabled"
const SERVER_REPORT_STORAGE_KEY = "projectAttachmentsChangeLoggerReportToServer"
const MAX_LOGS = 1000

export type ProjectAttachmentsChangeLogLevel = "debug" | "info" | "warn" | "error"

export interface ProjectAttachmentsChangeTraceContext {
	traceId?: string
	projectId?: string
	seqKeys?: string[]
	batchSize?: number
}

interface ProjectAttachmentsChangeLogEntry {
	timestamp: number
	time: string
	stage: string
	level: ProjectAttachmentsChangeLogLevel
	traceId?: string
	data: Record<string, unknown>
	error?: unknown
}

function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp)
	const hours = String(date.getHours()).padStart(2, "0")
	const minutes = String(date.getMinutes()).padStart(2, "0")
	const seconds = String(date.getSeconds()).padStart(2, "0")
	const ms = String(date.getMilliseconds()).padStart(3, "0")
	return `${hours}:${minutes}:${seconds}.${ms}`
}

function safeLocalStorageGet(key: string) {
	if (typeof window === "undefined") return null
	try {
		return window.localStorage.getItem(key)
	} catch (_error) {
		return null
	}
}

function safeLocalStorageSet(key: string, value: string) {
	if (typeof window === "undefined") return
	try {
		window.localStorage.setItem(key, value)
	} catch (_error) {
		// ignore localStorage failures in restricted webviews
	}
}

function safeLocalStorageRemove(key: string) {
	if (typeof window === "undefined") return
	try {
		window.localStorage.removeItem(key)
	} catch (_error) {
		// ignore localStorage failures in restricted webviews
	}
}

function normalizeError(error: unknown) {
	if (!error) return undefined
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
		}
	}
	return error
}

class ProjectAttachmentsChangeLogger {
	private enabled = false
	private reportToServer = false
	private logs: ProjectAttachmentsChangeLogEntry[] = []

	constructor() {
		this.enabled = safeLocalStorageGet(STORAGE_KEY) === "true"
		this.reportToServer = safeLocalStorageGet(SERVER_REPORT_STORAGE_KEY) === "true"

		if (this.enabled) {
			console.log("[ProjectAttachmentsChangeLogger] 已启用（从 localStorage 恢复）")
		}
		if (this.reportToServer) {
			console.log("[ProjectAttachmentsChangeLogger] 已开启线上日志上报")
		}
	}

	enable() {
		this.enabled = true
		safeLocalStorageSet(STORAGE_KEY, "true")
		console.log("[ProjectAttachmentsChangeLogger] 已启用")
	}

	disable() {
		this.enabled = false
		safeLocalStorageRemove(STORAGE_KEY)
		console.log("[ProjectAttachmentsChangeLogger] 已关闭")
	}

	enableServerReport() {
		this.reportToServer = true
		safeLocalStorageSet(SERVER_REPORT_STORAGE_KEY, "true")
		console.log("[ProjectAttachmentsChangeLogger] 已开启线上日志上报")
	}

	disableServerReport() {
		this.reportToServer = false
		safeLocalStorageRemove(SERVER_REPORT_STORAGE_KEY)
		console.log("[ProjectAttachmentsChangeLogger] 已关闭线上日志上报")
	}

	isEnabled() {
		return this.enabled
	}

	isServerReportEnabled() {
		return this.reportToServer
	}

	createTraceId(projectId?: string, seed?: string) {
		const normalizedSeed = seed || Math.random().toString(36).slice(2, 8)
		return `project-attachments-change:${projectId || "unknown"}:${normalizedSeed}:${Date.now()}`
	}

	log(
		stage: string,
		data: Record<string, unknown> = {},
		options: {
			level?: ProjectAttachmentsChangeLogLevel
			traceId?: string
			error?: unknown
		} = {},
	) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const level = options.level || "info"
		const entry: ProjectAttachmentsChangeLogEntry = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage,
			level,
			traceId: options.traceId,
			data: {
				...data,
				traceId: options.traceId,
			},
			error: normalizeError(options.error),
		}

		this.logs.push(entry)
		if (this.logs.length > MAX_LOGS) {
			this.logs = this.logs.slice(-MAX_LOGS)
		}

		const message = `[ProjectAttachmentsChangeLogger] ${entry.time} [${stage}]`
		if (level === "error") {
			console.error(message, entry.data, entry.error)
		} else if (level === "warn") {
			console.warn(message, entry.data)
		} else if (level === "debug") {
			console.debug(message, entry.data)
		} else {
			console.log(message, entry.data)
		}

		if (this.reportToServer) {
			logger.error({
				eventKey: "project_attachments_change_logger_failed",
				errorKind: "unknown",
				error: entry.error,
				message: `[ProjectAttachmentsChangeLogger] ${stage}`,
				context: { ...entry.data, level, time: entry.time },
			})
		}
	}

	getLogs() {
		return this.logs
	}

	exportLogs() {
		const exportData = {
			exportedAt: Date.now(),
			exportedAtFormatted: formatTimestamp(Date.now()),
			logsCount: this.logs.length,
			logs: this.logs,
		}
		const json = JSON.stringify(exportData, null, 2)
		console.log("[ProjectAttachmentsChangeLogger] 日志导出：")
		console.log(json)

		if (typeof navigator !== "undefined" && navigator.clipboard) {
			navigator.clipboard.writeText(json).catch((error) => {
				console.error("[ProjectAttachmentsChangeLogger] 复制到剪贴板失败", error)
			})
		}

		return exportData
	}

	clearLogs() {
		this.logs = []
		console.log("[ProjectAttachmentsChangeLogger] 日志已清空")
	}
}

export const projectAttachmentsChangeLogger = new ProjectAttachmentsChangeLogger()

declare global {
	interface Window {
		projectAttachmentsChangeLogger: ProjectAttachmentsChangeLogger
		enableProjectAttachmentsChangeLogger: () => void
		disableProjectAttachmentsChangeLogger: () => void
		enableProjectAttachmentsChangeLoggerServerReport: () => void
		disableProjectAttachmentsChangeLoggerServerReport: () => void
		getProjectAttachmentsChangeLogs: () => ProjectAttachmentsChangeLogEntry[]
		exportProjectAttachmentsChangeLogs: () => ReturnType<
			ProjectAttachmentsChangeLogger["exportLogs"]
		>
		clearProjectAttachmentsChangeLogs: () => void
	}
}

if (typeof window !== "undefined") {
	window.projectAttachmentsChangeLogger = projectAttachmentsChangeLogger
	window.enableProjectAttachmentsChangeLogger = () => projectAttachmentsChangeLogger.enable()
	window.disableProjectAttachmentsChangeLogger = () => projectAttachmentsChangeLogger.disable()
	window.enableProjectAttachmentsChangeLoggerServerReport = () =>
		projectAttachmentsChangeLogger.enableServerReport()
	window.disableProjectAttachmentsChangeLoggerServerReport = () =>
		projectAttachmentsChangeLogger.disableServerReport()
	window.getProjectAttachmentsChangeLogs = () => {
		console.table(projectAttachmentsChangeLogger.getLogs())
		return projectAttachmentsChangeLogger.getLogs()
	}
	window.exportProjectAttachmentsChangeLogs = () => projectAttachmentsChangeLogger.exportLogs()
	window.clearProjectAttachmentsChangeLogs = () => projectAttachmentsChangeLogger.clearLogs()
}
