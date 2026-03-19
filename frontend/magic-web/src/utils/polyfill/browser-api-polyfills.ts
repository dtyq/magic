/**
 * Browser API polyfills for older browsers
 * Includes: requestIdleCallback, cancelIdleCallback
 */

// requestIdleCallback polyfill
// @ts-ignore
if (typeof window !== "undefined" && !window.requestIdleCallback) {
	// @ts-ignore
	window.requestIdleCallback = function (callback, options) {
		const start = Date.now()
		return setTimeout(function () {
			callback({
				didTimeout: false,
				timeRemaining: function () {
					return Math.max(0, 50 - (Date.now() - start))
				},
			})
		}, options?.timeout || 1)
	}

	// @ts-ignore
	window.cancelIdleCallback = function (id) {
		clearTimeout(id)
	}
}

export {}
