import type { Plugin } from "vite"

interface TransformFilter {
	id?: RegExp
	code?: RegExp
}

/**
 * Adds a native hook filter to a third-party plugin's function-style `transform`.
 *
 * Rolldown evaluates `filter` before crossing into JS, so modules the plugin would ignore anyway
 * skip the JS call entirely. The filter must be a superset of what the plugin acts on; the plugin
 * keeps its own checks, so output is unchanged for modules that pass.
 */
export function withTransformFilter(plugin: Plugin, filter: TransformFilter): Plugin {
	const { transform } = plugin
	if (typeof transform !== "function") {
		throw new TypeError(`[withTransformFilter] ${plugin.name} has no function transform hook`)
	}

	return { ...plugin, transform: { filter, handler: transform } }
}
