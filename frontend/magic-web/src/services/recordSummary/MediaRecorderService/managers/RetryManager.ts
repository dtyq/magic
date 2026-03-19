/**
 * Retry manager for handling retry logic with exponential backoff
 * 重试管理器，使用指数退避策略处理重试逻辑
 */

import type { RetryConfig, RetryResult } from "../types/RecorderTypes"
import { RetryExhaustedError, PermissionDeniedError } from "../types/RecorderErrors"
import type { LoggerInterface } from "../types/RecorderDependencies"

/**
 * Default retry configuration
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxAttempts: 5,
	baseDelayMs: 1000,
	maxDelayMs: 5000,
	shouldRetry: (error: Error, _attempt: number) => {
		// Don't retry if user explicitly denied permission
		if (error instanceof PermissionDeniedError) {
			return false
		}
		if (error.message?.includes("User denied permission")) {
			return false
		}
		return true
	},
}

/**
 * RetryManager handles retry logic with exponential backoff strategy
 * RetryManager 使用指数退避策略处理重试逻辑
 */
export class RetryManager {
	private readonly config: RetryConfig

	constructor(
		config: Partial<RetryConfig> = {},
		private readonly logger: LoggerInterface,
	) {
		this.config = { ...DEFAULT_RETRY_CONFIG, ...config }
	}

	/**
	 * Execute operation with retry logic
	 * 使用重试逻辑执行操作
	 */
	async execute<T>(
		operation: () => Promise<T>,
		operationName: string = "Operation",
	): Promise<RetryResult<T>> {
		let lastError: Error | null = null
		let attempt = 0

		for (attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
			try {
				this.logger.log(`${operationName}: Attempt ${attempt}/${this.config.maxAttempts}`)

				const result = await operation()

				if (attempt > 1) {
					this.logger.log(`${operationName}: Succeeded on attempt ${attempt}`)
				}

				return {
					success: true,
					result,
					attempts: attempt,
				}
			} catch (error) {
				lastError = error as Error
				this.logger.warn(`${operationName}: Attempt ${attempt} failed:`, error)

				// Check if we should retry
				const shouldRetry = this.config.shouldRetry
					? this.config.shouldRetry(lastError, attempt)
					: true

				if (!shouldRetry) {
					this.logger.log(`${operationName}: Not retrying due to error type`)
					break
				}

				// If this was not the last attempt, wait before retrying
				if (attempt < this.config.maxAttempts) {
					const delay = this.calculateDelay(attempt)
					this.logger.log(`${operationName}: Retrying in ${delay}ms...`)
					await this.sleep(delay)
				}
			}
		}

		// All retries exhausted or should not retry
		const error = new RetryExhaustedError(
			attempt,
			`${operationName} failed after ${attempt} attempt(s). Last error: ${lastError?.message}`,
			lastError || undefined,
		)

		return {
			success: false,
			error,
			attempts: attempt,
		}
	}

	/**
	 * Calculate delay for retry with exponential backoff
	 * 使用指数退避计算重试延迟
	 */
	private calculateDelay(attempt: number): number {
		const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt - 1)
		return Math.min(exponentialDelay, this.config.maxDelayMs)
	}

	/**
	 * Sleep for specified milliseconds
	 * 休眠指定毫秒数
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	/**
	 * Get current retry configuration
	 * 获取当前重试配置
	 */
	getConfig(): RetryConfig {
		return { ...this.config }
	}
}
