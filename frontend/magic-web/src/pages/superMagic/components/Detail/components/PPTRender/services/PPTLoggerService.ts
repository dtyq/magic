import { logger as Logger } from "@/utils/log"

const logger = Logger.createLogger("PPTLoggerService")

/**
 * PPTLoggerService - Logging service for PPT operations
 * Provides structured logging for debugging and monitoring
 */

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogContext {
	/** Operation name */
	operation: string
	/** Slide index if applicable */
	slideIndex?: number
	/** Additional metadata */
	metadata?: Record<string, unknown>
	/** Timestamp */
	timestamp?: number
}

export interface PPTLoggerConfig {
	/** Enable/disable logging */
	enabled?: boolean
	/** Minimum log level to output */
	level?: LogLevel
	/** Prefix for all log messages */
	prefix?: string
	/** Enable performance timing */
	enableTiming?: boolean
}

/**
 * PPTLoggerService - Structured logging for PPT operations
 */
export class PPTLoggerService {
	private config: Required<PPTLoggerConfig>
	private performanceMarks: Map<string, number> = new Map()

	private readonly LOG_LEVELS: Record<LogLevel, number> = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3,
	}

	constructor(config: PPTLoggerConfig = {}) {
		this.config = {
			enabled: config.enabled ?? true,
			level: config.level ?? "info",
			prefix: config.prefix ?? "[PPTStore]",
			enableTiming: config.enableTiming ?? true,
		}
	}

	/**
	 * Update logger configuration
	 */
	updateConfig(config: Partial<PPTLoggerConfig>): void {
		this.config = { ...this.config, ...config } as Required<PPTLoggerConfig>
	}

	/**
	 * Check if a log level should be output
	 */
	private shouldLog(level: LogLevel): boolean {
		if (!this.config.enabled) return false
		return this.LOG_LEVELS[level] >= this.LOG_LEVELS[this.config.level]
	}

	/**
	 * Format log message with context
	 */
	private formatMessage(message: string, context?: Partial<LogContext>): string {
		const parts = [this.config.prefix]

		if (context?.operation) {
			parts.push(`[${context.operation}]`)
		}

		if (context?.slideIndex !== undefined) {
			parts.push(`[Slide ${context.slideIndex}]`)
		}

		parts.push(message)

		return parts.join(" ")
	}

	/**
	 * Format metadata for output
	 */
	private formatMetadata(context?: Partial<LogContext>): unknown[] {
		const result: unknown[] = []

		if (context?.metadata) {
			result.push(context.metadata)
		}

		if (context?.timestamp) {
			result.push({ timestamp: new Date(context.timestamp).toISOString() })
		}

		return result
	}

	/**
	 * Debug level log
	 */
	debug(message: string, context?: Partial<LogContext>): void {
		if (!this.shouldLog("debug")) return

		const formattedMessage = this.formatMessage(message, context)
		const metadata = this.formatMetadata(context)

		console.debug(formattedMessage, ...metadata)
	}

	/**
	 * Info level log
	 */
	info(message: string, context?: Partial<LogContext>): void {
		if (!this.shouldLog("info")) return

		const formattedMessage = this.formatMessage(message, context)
		const metadata = this.formatMetadata(context)

		console.info(formattedMessage, ...metadata)
	}

	/**
	 * Warning level log
	 */
	warn(message: string, context?: Partial<LogContext>): void {
		if (!this.shouldLog("warn")) return

		const formattedMessage = this.formatMessage(message, context)
		const metadata = this.formatMetadata(context)

		logger.warn(formattedMessage, ...metadata)
	}

	/**
	 * Error level log
	 */
	error(message: string, error?: Error | unknown, context?: Partial<LogContext>): void {
		if (!this.shouldLog("error")) return

		const formattedMessage = this.formatMessage(message, context)
		const metadata = this.formatMetadata(context)

		if (error instanceof Error) {
			logger.error(formattedMessage, ...metadata, error)
		} else if (error) {
			logger.error(formattedMessage, ...metadata, { error })
		} else {
			logger.error(formattedMessage, ...metadata)
		}
	}

	/**
	 * Start performance timing for an operation
	 */
	startTiming(operationId: string): void {
		if (!this.config.enableTiming) return
		this.performanceMarks.set(operationId, Date.now())
	}

	/**
	 * End performance timing and log duration
	 */
	endTiming(operationId: string, context?: Partial<LogContext>): number | undefined {
		if (!this.config.enableTiming) return undefined

		const startTime = this.performanceMarks.get(operationId)
		if (!startTime) {
			this.warn(`No start time found for operation: ${operationId}`)
			return undefined
		}

		const duration = Date.now() - startTime
		this.performanceMarks.delete(operationId)

		this.debug(`Operation completed in ${duration}ms`, {
			...context,
			operation: operationId,
			metadata: { duration, ...context?.metadata },
		})

		return duration
	}

	/**
	 * Log operation start
	 */
	logOperationStart(operation: string, context?: Partial<Omit<LogContext, "operation">>): void {
		this.debug(`Starting operation`, {
			...context,
			operation,
		})

		if (this.config.enableTiming) {
			this.startTiming(operation)
		}
	}

	/**
	 * Log operation success
	 */
	logOperationSuccess(operation: string, context?: Partial<Omit<LogContext, "operation">>): void {
		if (this.config.enableTiming) {
			this.endTiming(operation, { ...context, operation })
		}

		this.info(`Operation completed successfully`, {
			...context,
			operation,
		})
	}

	/**
	 * Log operation error
	 */
	logOperationError(
		operation: string,
		error: Error | unknown,
		context?: Partial<Omit<LogContext, "operation">>,
	): void {
		if (this.config.enableTiming) {
			this.endTiming(operation, { ...context, operation })
		}

		this.error(`Operation failed`, error, {
			...context,
			operation,
		})
	}

	/**
	 * Group related logs together
	 */
	group(label: string): void {
		if (!this.config.enabled) return
		console.group(this.formatMessage(label))
	}

	/**
	 * End log group
	 */
	groupEnd(): void {
		if (!this.config.enabled) return
		console.groupEnd()
	}

	/**
	 * Clear all performance marks
	 */
	clearTimings(): void {
		this.performanceMarks.clear()
	}

	/**
	 * Get current configuration
	 */
	getConfig(): Readonly<Required<PPTLoggerConfig>> {
		return { ...this.config }
	}
}

/**
 * Create a new PPTLoggerService instance
 */
export function createPPTLogger(config?: PPTLoggerConfig): PPTLoggerService {
	return new PPTLoggerService(config)
}
