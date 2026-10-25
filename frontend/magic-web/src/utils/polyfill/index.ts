/**
 * Main polyfill entry point
 * Dynamically loads polyfills only when missing
 */

// requestIdleCallback is called bare (without feature detection) at many mount and service
// call sites, so it must exist synchronously once this module has been evaluated. A dynamic
// import resolves after the first render on browsers without it (Safari), which throws
// "Can't find variable: requestIdleCallback". The module is tiny and self-guarded.
import "./browser-api-polyfills"

const polyfillTasks: Promise<unknown>[] = []

if (!Promise.withResolvers) polyfillTasks.push(import("./promise-with-resolvers"))

if (!Array.prototype.at || !Array.prototype.findLast || !Array.prototype.findLastIndex) {
	polyfillTasks.push(import("./array-polyfills"))
}

if (!String.prototype.at || !String.prototype.replaceAll) {
	polyfillTasks.push(import("./string-polyfills"))
}

if (!("hasOwn" in Object)) polyfillTasks.push(import("./object-polyfills"))

export const polyfillReady =
	polyfillTasks.length > 0 ? Promise.all(polyfillTasks) : Promise.resolve()
