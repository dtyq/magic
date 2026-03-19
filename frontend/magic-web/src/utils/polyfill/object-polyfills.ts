/**
 * Object polyfills for older browsers
 * Includes: hasOwn
 */

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

export {}
