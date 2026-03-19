import { logger as Logger } from "@/utils/log"

/**
 * Namespaced logger interface
 * 命名空间日志接口
 */
export interface NamespacedLogger {
	log(message: string, ...args: unknown[]): void
	warn(message: string, ...args: unknown[]): void
	error(message: string, ...args: unknown[]): void
	report(
		message: string | { namespace: string; data: Record<string, unknown> },
		data?: unknown,
	): void
	setSessionId(sessionId: string): void
}

/**
 * Recording Logger Manager - Centralized logging for recording sessions
 * 录音日志管理器 - 集中管理录音会话的日志
 *
 * Features:
 * - Single global sessionId/task_key for all namespaces
 * - Automatically attaches task_key to all logs
 * - Manages multiple namespaces from one central place
 *
 * 特性：
 * - 全局唯一的 sessionId/task_key，所有命名空间共享
 * - 自动为所有日志附加 task_key
 * - 从中心位置管理所有命名空间
 */
class RecordingLoggerManager {
	private sessionId: string | null = null

	/**
	 * Set current session ID for all logging contexts
	 * 为所有日志上下文设置当前会话ID（全局设置，一次生效）
	 */
	setSessionId(sessionId: string): void {
		this.sessionId = sessionId
	}

	/**
	 * Clear session ID
	 * 清除会话ID
	 */
	clearSessionId(): void {
		this.sessionId = null
	}

	/**
	 * Get current session ID
	 * 获取当前会话ID
	 */
	getSessionId(): string | null {
		return this.sessionId
	}

	/**
	 * Helper to format data with session_id
	 * 帮助函数：格式化数据并附加 session_id
	 */
	private formatData(data: unknown): unknown {
		// If data is already an object, add session_id
		if (data && typeof data === "object" && !Array.isArray(data)) {
			return {
				...(data as Record<string, unknown>),
				session_id: this.sessionId,
			}
		}
		// If data is primitive or array, wrap it
		return {
			data,
			session_id: this.sessionId,
		}
	}

	/**
	 * Create a namespaced logger
	 * 创建命名空间日志记录器
	 */
	namespace(namespace: string): NamespacedLogger {
		const fullNamespace = `RecordSummary:${namespace}`

		return {
			log: (message: string, ...args: unknown[]) => {
				Logger.log({
					namespace: fullNamespace,
					data: [message, this.formatData(args[0])],
				})
			},

			warn: (message: string, ...args: unknown[]) => {
				Logger.warn({
					namespace: fullNamespace,
					data: [message, this.formatData(args[0])],
				})
			},

			error: (message: string, ...args: unknown[]) => {
				Logger.error({
					namespace: fullNamespace,
					data: [message, this.formatData(args[0])],
				})
			},

			report: (
				message: string | { namespace: string; data: Record<string, unknown> },
				data?: unknown,
			) => {
				// Support both signatures: LoggerInterface and our simplified one
				if (typeof message === "object" && "namespace" in message) {
					// LoggerInterface style: report(data: { namespace, data })
					Logger.report({
						...message,
						data: {
							...message.data,
							session_id: this.sessionId, // 录音会话ID
						},
					})
				} else {
					// Our simplified style: report(message, data)
					Logger.report({
						namespace: fullNamespace,
						data: [message, this.formatData(data)],
					})
				}
			},

			setSessionId: (sessionId: string) => {
				this.setSessionId(sessionId)
			},
		}
	}
}

/**
 * Global recording logger manager instance
 * 全局录音日志管理器实例
 */
export const recordingLogger = new RecordingLoggerManager()

/**
 * Create a recording logger with namespace
 * 创建带命名空间的录音日志记录器
 *
 * @param namespace - The namespace for this logger
 * @param enableConfig - Optional logger enable configuration (currently unused, for API compatibility)
 */
export function createRecordingLogger(namespace: string): NamespacedLogger {
	return recordingLogger.namespace(namespace)
}
