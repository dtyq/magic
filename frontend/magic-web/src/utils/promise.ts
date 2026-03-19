/**
 * Create a promise that rejects after a specified timeout
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Custom error message (optional)
 * @returns A promise that rejects after the timeout
 */
function createTimeoutPromise(timeoutMs: number, errorMessage?: string): Promise<never> {
	return new Promise((_, reject) => {
		setTimeout(() => {
			reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`))
		}, timeoutMs)
	})
}

/**
 * Wrap a promise with timeout protection
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Custom error message (optional)
 * @returns A promise that will reject if the original promise doesn't resolve/reject within the timeout
 * @example
 * ```ts
 * const result = await withTimeout(
 *   fetch('/api/data'),
 *   5000,
 *   'API request timeout'
 * )
 * ```
 */
export function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	errorMessage?: string,
): Promise<T> {
	return Promise.race([promise, createTimeoutPromise(timeoutMs, errorMessage)])
}
