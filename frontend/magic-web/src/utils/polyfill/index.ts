// Import Promise.withResolvers polyfill
import "./promise-with-resolvers"

// react-markdown 中使用 Object.hasOwn
// @ts-ignore
if (!Object.hasOwn) {
	Object.defineProperty(Object, "hasOwn", {
		value(object: null, property: any) {
			if (object === null) {
				throw new TypeError("Cannot convert undefined or null to object")
			}
			return Object.prototype.hasOwnProperty.call(Object(object), property)
		},
		configurable: true,
		enumerable: false,
		writable: true,
	})
}

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
