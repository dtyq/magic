/**
 * Editor Logger
 * Logging utility for iframe runtime with history tracking
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

export class EditorLogger {
	private static enabled = true
	private static prefix = "[IframeRuntime]"
	private static logs: LogEntry[] = []
	private static maxLogs = 500 // Maximum number of logs to keep
	private static listeners: Set<(logs: LogEntry[]) => void> = new Set()

	/**
	 * Add a log entry
	 */
	private static addLog(level: LogLevel, message: string, data?: unknown): void {
		const timestamp = Date.now()
		const date = new Date(timestamp)
		// Format time as HH:MM:SS.mmm in 24-hour format
		const hours = String(date.getHours()).padStart(2, "0")
		const minutes = String(date.getMinutes()).padStart(2, "0")
		const seconds = String(date.getSeconds()).padStart(2, "0")
		const milliseconds = String(date.getMilliseconds()).padStart(3, "0")
		const formattedTime = `${hours}:${minutes}:${seconds}.${milliseconds}`

		const entry: LogEntry = {
			id: `${timestamp}-${Math.random().toString(36).slice(2, 9)}`,
			level,
			message,
			data,
			timestamp,
			formattedTime,
		}

		// Add to logs array
		this.logs.push(entry)

		// Keep only recent logs
		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(-this.maxLogs)
		}

		// Notify listeners
		this.notifyListeners()
	}

	static debug(message: string, data?: unknown): void {
		if (this.enabled) {
			console.debug(`${this.prefix} ${message}`, data)
			this.addLog(LogLevel.DEBUG, message, data)
		}
	}

	static info(message: string, data?: unknown): void {
		if (this.enabled) {
			console.log(`${this.prefix} ${message}`, data)
			this.addLog(LogLevel.INFO, message, data)
		}
	}

	static warn(message: string, data?: unknown): void {
		if (this.enabled) {
			console.warn(`${this.prefix} ${message}`, data)
			this.addLog(LogLevel.WARN, message, data)
		}
	}

	static error(message: string, error?: unknown): void {
		if (this.enabled) {
			console.error(`${this.prefix} ${message}`, error)
			this.addLog(LogLevel.ERROR, message, error)
		}
	}

	static setEnabled(enabled: boolean): void {
		this.enabled = enabled
	}

	/**
	 * Get all log entries
	 */
	static getLogs(): LogEntry[] {
		return [...this.logs]
	}

	/**
	 * Clear all logs
	 */
	static clearLogs(): void {
		this.logs = []
		this.notifyListeners()
	}

	/**
	 * Export logs as JSON string
	 */
	static exportLogs(): string {
		return JSON.stringify(
			{
				exportTime: new Date().toISOString(),
				totalLogs: this.logs.length,
				logs: this.logs,
			},
			null,
			2,
		)
	}

	/**
	 * Subscribe to log changes
	 */
	static subscribe(listener: (logs: LogEntry[]) => void): () => void {
		this.listeners.add(listener)
		// Immediately call with current logs (with error handling)
		try {
			listener([...this.logs])
		} catch (error) {
			console.error("Error in log listener:", error)
		}

		// Return unsubscribe function
		return () => {
			this.listeners.delete(listener)
		}
	}

	/**
	 * Notify all listeners
	 */
	private static notifyListeners(): void {
		const logsCopy = [...this.logs]
		this.listeners.forEach((listener) => {
			try {
				listener(logsCopy)
			} catch (error) {
				console.error("Error in log listener:", error)
			}
		})
	}
}
