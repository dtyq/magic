/**
 * Main polyfill entry point
 * Dynamically loads polyfills only when missing
 */

const polyfillTasks: Promise<unknown>[] = []

if (!Promise.withResolvers) polyfillTasks.push(import("./promise-with-resolvers"))

if (!Array.prototype.at || !Array.prototype.findLast || !Array.prototype.findLastIndex) {
	polyfillTasks.push(import("./array-polyfills"))
}

if (!String.prototype.at || !String.prototype.replaceAll) {
	polyfillTasks.push(import("./string-polyfills"))
}

if (!("hasOwn" in Object)) polyfillTasks.push(import("./object-polyfills"))

if (typeof window !== "undefined" && (!window.requestIdleCallback || !window.cancelIdleCallback)) {
	polyfillTasks.push(import("./browser-api-polyfills"))
}

export const polyfillReady =
	polyfillTasks.length > 0 ? Promise.all(polyfillTasks) : Promise.resolve()
