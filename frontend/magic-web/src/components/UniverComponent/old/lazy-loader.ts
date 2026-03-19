/**
 * Univer Lazy Loading Manager
 * Provides on-demand loading and caching mechanism to avoid unnecessary preloading
 */

// Cache for loaded modules
const moduleCache = new Map<string, any>()

// Global loading state
let isLoading = false
let loadPromise: Promise<any> | null = null

/**
 * Load Univer core modules on demand
 * Only loads when truly needed, supports caching and deduplication
 */
export async function loadUniverCore() {
	// Check cache
	const cacheKey = "univer-core"
	if (moduleCache.has(cacheKey)) {
		return moduleCache.get(cacheKey)
	}

	isLoading = true

	try {
		loadPromise = Promise.all([
			import(/* webpackChunkName: "univer-core" */ "@univerjs/core"),
			import(/* webpackChunkName: "univer-design" */ "@univerjs/design"),
			import(/* webpackChunkName: "univer-ui" */ "@univerjs/ui"),
		])

		const [core, design, ui] = await loadPromise

		const coreModules = {
			...core,
			...design,
			...ui,
		}

		// Cache core modules
		moduleCache.set(cacheKey, coreModules)

		return coreModules
	} finally {
		isLoading = false
		loadPromise = null
	}
}

/**
 * Load Univer Sheets modules on demand
 */
export async function loadUniverSheets() {
	const cacheKey = "univer-sheets"
	if (moduleCache.has(cacheKey)) {
		return moduleCache.get(cacheKey)
	}

	try {
		console.log("🚀 Starting lazy loading of Univer Sheets modules...")

		const [sheets, sheetsUi, facade] = await Promise.all([
			import(/* webpackChunkName: "univer-sheets" */ "@univerjs/sheets"),
			import(/* webpackChunkName: "univer-sheets-ui" */ "@univerjs/sheets-ui"),
			import(/* webpackChunkName: "univer-sheets-facade" */ "@univerjs/sheets/facade"),
		])

		const sheetsModules = {
			...sheets,
			...sheetsUi,
			...facade,
		}

		moduleCache.set(cacheKey, sheetsModules)
		console.log("✅ Univer Sheets modules loaded successfully")

		return sheetsModules
	} catch (error) {
		console.error("❌ Failed to load Univer Sheets modules:", error)
		throw error
	}
}

/**
 * Load Univer Docs modules on demand
 */
export async function loadUniverDocs() {
	const cacheKey = "univer-docs"
	if (moduleCache.has(cacheKey)) {
		return moduleCache.get(cacheKey)
	}

	try {
		const [docs, docsUi] = await Promise.all([
			import(/* webpackChunkName: "univer-docs" */ "@univerjs/docs"),
			import(/* webpackChunkName: "univer-docs-ui" */ "@univerjs/docs-ui"),
		])

		const docsModules = {
			...docs,
			...docsUi,
		}

		moduleCache.set(cacheKey, docsModules)

		return docsModules
	} catch (error) {
		console.error("❌ Failed to load Univer Docs modules:", error)
		throw error
	}
}

/**
 * Load Univer styles on demand
 */
export async function loadUniverStyles() {
	const cacheKey = "univer-styles"
	if (moduleCache.has(cacheKey)) {
		return moduleCache.get(cacheKey)
	}

	try {
		console.log("🚀 Starting lazy loading of Univer styles...")
		// one-shot dynamic import to merge css into single chunk
		await import(
			/* webpackChunkName: "univer-styles-bundle" */ "./bundles/univer-styles.bundle"
		)

		moduleCache.set(cacheKey, true)
		console.log("✅ Univer styles loaded successfully")

		return true
	} catch (error) {
		console.error("❌ Failed to load Univer styles:", error)
		throw error
	}
}

/**
 * Load Univer localization resources on demand
 */
export async function loadUniverLocales() {
	const cacheKey = "univer-locales"
	if (moduleCache.has(cacheKey)) {
		return moduleCache.get(cacheKey)
	}

	try {
		const localesBundle = await import(
			/* webpackChunkName: "univer-locales-zhCN-bundle" */ "./bundles/univer-locales.zh-CN.bundle"
		)
		const { DesignZhCN, UIZhCN, SheetsZhCN, SheetsUIZhCN, DocsUIZhCN, overrideLocales } =
			localesBundle

		const locales = {
			DesignZhCN,
			UIZhCN,
			SheetsZhCN,
			SheetsUIZhCN,
			DocsUIZhCN,
			overrideLocales,
		}

		moduleCache.set(cacheKey, locales)

		return locales
	} catch (error) {
		console.error("❌ Failed to load Univer localization resources:", error)
		throw error
	}
}

/**
 * Load Univer Facade API on demand
 */
export async function loadUniverFacade() {
	const cacheKey = "univer-facade"
	if (moduleCache.has(cacheKey)) {
		return moduleCache.get(cacheKey)
	}

	try {
		console.log("🚀 Starting lazy loading of Univer Facade API...")

		const facade = await import(/* webpackChunkName: "univer-facade" */ "@univerjs/core/facade")

		moduleCache.set(cacheKey, facade)
		console.log("✅ Univer Facade API loaded successfully")

		return facade
	} catch (error) {
		console.error("❌ Failed to load Univer Facade API:", error)
		throw error
	}
}

/**
 * Load required Univer modules based on file type
 */
export async function loadUniverModulesByFileType(fileType: "sheet" | "doc" | "slide") {
	const modules: any = {}

	try {
		// Always load core modules
		const coreModules = await loadUniverCore()
		Object.assign(modules, coreModules)

		// Load styles
		await loadUniverStyles()

		// Load localization resources
		const locales = await loadUniverLocales()
		Object.assign(modules, locales)

		// Load Facade API
		const facade = await loadUniverFacade()
		Object.assign(modules, facade)

		// Load specific modules based on file type
		switch (fileType) {
			case "doc":
			case "sheet": {
				const docsModules = await loadUniverDocs()
				const sheetsModules = await loadUniverSheets()
				Object.assign(modules, docsModules)
				Object.assign(modules, sheetsModules)

				console.log(modules)
				break
			}
			case "slide": {
				// TODO: Implement lazy loading for Slides modules
				console.warn("Slides module lazy loading not yet implemented")
				break
			}
		}

		console.log(`✅ All ${fileType} related Univer modules loaded successfully`)
		return modules
	} catch (error) {
		console.error(`❌ Failed to load ${fileType} related Univer modules:`, error)
		throw error
	}
}

/**
 * Clear module cache (for development environment hot reloading)
 */
export function clearUniverCache() {
	moduleCache.clear()
	isLoading = false
	loadPromise = null
	console.log("🧹 Univer module cache cleared")
}

/**
 * Check if module is already loaded
 */
export function isModuleLoaded(moduleKey: string): boolean {
	return moduleCache.has(moduleKey)
}

/**
 * Get information about loaded modules
 */
export function getLoadedModulesInfo() {
	return {
		loadedModules: Array.from(moduleCache.keys()),
		cacheSize: moduleCache.size,
		isLoading,
	}
}
