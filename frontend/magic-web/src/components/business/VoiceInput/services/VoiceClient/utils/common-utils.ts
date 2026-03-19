/**
 * Common utilities for voice client
 * General purpose helper functions
 */

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === "x" ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

/**
 * Delay execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateExponentialBackoff(
	attempt: number,
	baseDelay: number = 1000,
	backoffMultiplier: number = 2,
	maxDelay: number = 30000,
	jitter: boolean = true,
): number {
	const exponentialDelay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay)

	if (jitter) {
		// Add random jitter (±25%)
		const jitterAmount = exponentialDelay * 0.25
		return exponentialDelay + (Math.random() - 0.5) * 2 * jitterAmount
	}

	return exponentialDelay
}

/**
 * Check if enough time has passed since last operation
 */
export function hasEnoughTimePassed(
	lastTime: number,
	minInterval: number,
	currentTime: number = Date.now(),
): boolean {
	return currentTime - lastTime >= minInterval
}

/**
 * Clamp a number between min and max values
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

/**
 * Safe JSON stringify with error handling
 */
export function safeJsonStringify(obj: any): string {
	try {
		return JSON.stringify(obj)
	} catch (error) {
		return `[JSON Stringify Error: ${(error as Error).message}]`
	}
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T = any>(
	text: string,
): { success: boolean; data?: T; error?: string } {
	try {
		const data = JSON.parse(text) as T
		return { success: true, data }
	} catch (error) {
		return { success: false, error: (error as Error).message }
	}
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 Bytes"

	const k = 1024
	const sizes = ["Bytes", "KB", "MB", "GB"]
	const i = Math.floor(Math.log(bytes) / Math.log(k))

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
