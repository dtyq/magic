// Polyfill for Promise.withResolvers (ES2024)
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers

interface PromiseWithResolvers<T> {
	promise: Promise<T>
	resolve: (value: T | PromiseLike<T>) => void
	reject: (reason?: any) => void
}

if (!Promise.withResolvers) {
	Promise.withResolvers = function <T>(): PromiseWithResolvers<T> {
		let resolve: (value: T | PromiseLike<T>) => void
		let reject: (reason?: any) => void

		const promise = new Promise<T>((res, rej) => {
			resolve = res
			reject = rej
		})

		return { promise, resolve: resolve!, reject: reject! }
	}
}

export {}
