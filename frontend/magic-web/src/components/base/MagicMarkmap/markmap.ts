import { loadCSS, loadJS } from "markmap-common"
import type { Transformer } from "markmap-lib"

let transformerInstance: Transformer | null = null
let initPromise: Promise<Transformer> | null = null

async function initMarkmap(): Promise<Transformer> {
	if (initPromise) return initPromise

	initPromise = (async () => {
		if (transformerInstance) return transformerInstance

		const [{ Transformer }, markmap] = await Promise.all([
			import("markmap-lib"),
			import("markmap-view"),
		])

		transformerInstance = new Transformer()
		const { scripts, styles } = transformerInstance.getAssets()

		if (styles) loadCSS(styles)
		if (scripts) loadJS(scripts, { getMarkmap: () => markmap })

		return transformerInstance
	})()

	return initPromise
}

export async function ensureMarkmapInitialized(): Promise<Transformer> {
	return initMarkmap()
}

export function getTransformer(): Transformer {
	if (!transformerInstance) {
		throw new Error(
			"Markmap transformer not initialized. Call ensureMarkmapInitialized() first.",
		)
	}
	return transformerInstance
}

// Lazy getter for backward compatibility
// Note: This will throw if accessed before initialization
// Use ensureMarkmapInitialized() before accessing transformer
export const transformer = new Proxy({} as Transformer, {
	get(_target, prop) {
		if (!transformerInstance) {
			throw new Error(
				"Markmap transformer not initialized. Call ensureMarkmapInitialized() before accessing transformer.",
			)
		}
		return transformerInstance[prop as keyof Transformer]
	},
})
