// TypeScript declaration for Promise.withResolvers
// This extends the global Promise interface to include the withResolvers method

interface PromiseWithResolvers<T> {
	promise: Promise<T>
	resolve: (value: T | PromiseLike<T>) => void
	reject: (reason?: any) => void
}

interface PromiseConstructor {
	/**
	 * Returns an object with a new Promise and the resolve and reject functions
	 * to control it.
	 *
	 * @returns An object with promise, resolve, and reject properties
	 */
	withResolvers<T = any>(): PromiseWithResolvers<T>
}
