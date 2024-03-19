/**
 * Logger types for iframe bridge communication
 */

export enum LogLevel {
	DEBUG = "debug",
	INFO = "info",
	WARN = "warn",
	ERROR = "error",
}

export interface LogEntry {
	id: string
	level: LogLevel
	message: string
	data?: unknown
	timestamp: number
	formattedTime: string
}
