/**
 * Recording summary error manager
 * 录音纪要错误管理器
 */

import { logger as Logger } from "@/utils/log"

const logger = Logger.createLogger("RecordingErrorManager", {
	enableConfig: { console: false },
})

/**
 * Error code constants
 * 错误码常量
 */
export const ERROR_CODES = {
	/** Task status errors (43200-43299) */
	TASK_ALREADY_COMPLETED: 43200,
	TASK_ALREADY_CANCELED: 43201,
	TASK_IS_SUMMARIZING: 43202,
	TASK_AUTO_STOPPED_BY_TIMEOUT: 43203,
	INVALID_STATUS_TRANSITION: 43204,
	RECORDING_ALREADY_STOPPED: 43205,
	UPLOAD_NOT_ALLOWED: 43206,
	STATUS_REPORT_NOT_ALLOWED: 43207,
	TASK_NOT_EXIST: 43209,
	TASK_NOT_BELONG_TO_USER: 43211,
	TASK_NOT_FOUND: 43212,
	/** Sandbox errors (43300-43399) */
	SANDBOX_START_RETRY_EXCEEDED: 43305,
	/** Project errors */
	PROJECT_NOT_FOUND: 51200,
} as const

/**
 * Set of error codes that indicate the task has ended and recording should stop
 * 表示任务已结束、需要停止录音的错误码集合
 */
export const TASK_END_CODES: ReadonlySet<number> = new Set([
	ERROR_CODES.TASK_ALREADY_COMPLETED,
	ERROR_CODES.TASK_ALREADY_CANCELED,
	ERROR_CODES.TASK_IS_SUMMARIZING,
	ERROR_CODES.TASK_AUTO_STOPPED_BY_TIMEOUT,
	ERROR_CODES.INVALID_STATUS_TRANSITION,
	ERROR_CODES.RECORDING_ALREADY_STOPPED,
	ERROR_CODES.UPLOAD_NOT_ALLOWED,
	ERROR_CODES.STATUS_REPORT_NOT_ALLOWED,
	ERROR_CODES.TASK_NOT_EXIST,
	ERROR_CODES.TASK_NOT_BELONG_TO_USER,
	ERROR_CODES.TASK_NOT_FOUND,
	ERROR_CODES.SANDBOX_START_RETRY_EXCEEDED,
	ERROR_CODES.PROJECT_NOT_FOUND,
])

/**
 * Task end error interface
 * 任务结束错误接口
 */
export interface TaskEndError extends Error {
	code: number
	sessionId: string
}

/**
 * Error handler callback type
 * 错误处理回调类型
 */
export type ErrorHandler = (error: TaskEndError) => void | Promise<void>

/**
 * Recording error manager class
 * 录音错误管理器类
 */
export class RecordingErrorManager {
	private taskEndHandlers: Set<ErrorHandler> = new Set()

	/**
	 * Check if error is a task end error
	 * 检查错误是否为任务结束错误
	 */
	isTaskEndError(error: unknown): error is TaskEndError {
		return (
			error !== null &&
			typeof error === "object" &&
			"code" in error &&
			TASK_END_CODES.has((error as { code: number }).code)
		)
	}

	/**
	 * Create a task end error
	 * 创建任务结束错误
	 */
	createTaskEndError(
		sessionId: string,
		code: number = ERROR_CODES.TASK_ALREADY_COMPLETED,
	): TaskEndError {
		const error = new Error(
			`Task ended (error code: ${code}). Recording should be stopped for session ${sessionId}`,
		) as TaskEndError
		error.code = code
		error.sessionId = sessionId
		return error
	}

	/**
	 * Extract session ID from error if it's a task end error
	 * 如果是任务结束错误，提取会话ID
	 */
	getSessionIdFromError(error: unknown): string | undefined {
		if (this.isTaskEndError(error)) {
			return error.sessionId
		}
		return undefined
	}

	/**
	 * Register a task end error handler
	 * 注册任务结束错误处理器
	 */
	onTaskEnd(handler: ErrorHandler): () => void {
		this.taskEndHandlers.add(handler)
		return () => {
			this.taskEndHandlers.delete(handler)
		}
	}

	/**
	 * Handle task end error
	 * 处理任务结束错误
	 */
	async handleTaskEnd(error: TaskEndError): Promise<void> {
		logger.warn(`Task ended for session ${error.sessionId} (error code: ${error.code})`)

		// Call all registered handlers
		const handlerPromises = Array.from(this.taskEndHandlers).map(async (handler) => {
			try {
				await handler(error)
			} catch (handlerError) {
				logger.error(
					`Error in task end handler for session ${error.sessionId}:`,
					handlerError,
				)
			}
		})

		await Promise.all(handlerPromises)
	}

	/**
	 * Check and handle error if it's a task end error
	 * 检查并处理错误（如果是任务结束错误）
	 */
	async checkAndHandleError(error: unknown): Promise<boolean> {
		if (this.isTaskEndError(error)) {
			await this.handleTaskEnd(error)
			return true
		}
		return false
	}

	/**
	 * Clear all handlers
	 * 清除所有处理器
	 */
	clearHandlers(): void {
		this.taskEndHandlers.clear()
	}
}

// Export a default instance for easy usage
export const defaultErrorManager = new RecordingErrorManager()

// Export utility functions for backward compatibility
export const ERROR_CODE_TASK_ENDED = ERROR_CODES.TASK_ALREADY_COMPLETED

export function isTaskEndError(error: unknown): error is TaskEndError {
	return defaultErrorManager.isTaskEndError(error)
}

export function createTaskEndError(sessionId: string, code?: number): TaskEndError {
	return defaultErrorManager.createTaskEndError(sessionId, code)
}

export function getSessionIdFromError(error: unknown): string | undefined {
	return defaultErrorManager.getSessionIdFromError(error)
}
