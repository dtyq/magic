import { existsSync, readdirSync } from "node:fs"
import { join, resolve } from "path"
import { build } from "esbuild"
import type { OutputBundle } from "rollup"
import type { PluginOption, ResolvedConfig } from "vite"
import { collectPrecacheAssetUrlsFromAssetFilenames } from "./collect-precache-asset-urls"

const APP_SERVICE_WORKER_FILE_NAME = "sw.js"
const APP_SERVICE_WORKER_ROUTE_PATH = `/${APP_SERVICE_WORKER_FILE_NAME}`
const APP_SERVICE_WORKER_SOURCE_PATH = resolve(__dirname, "../src/sw.ts")

interface BuildAppServiceWorkerOptions {
	precacheAssetUrls: string[]
	warmUpAssetUrls: string[]
}

/**
 * Collects hashed js/css public paths from the Rollup output bundle (production build).
 */
function collectPrecacheUrlsFromBundle(bundle: OutputBundle): string[] {
	const assetFilenames = Object.keys(bundle).filter((fileName) => {
		if (!fileName.startsWith("assets/")) return false
		const item = bundle[fileName]
		if (!item) return false
		if (item.type === "asset") return /\.(js|css)$/i.test(fileName)
		if (item.type === "chunk") return /\.(js|css)$/i.test(fileName)
		return false
	})

	return collectPrecacheAssetUrlsFromAssetFilenames(assetFilenames)
}

/**
 * Reads hashed js/css filenames from dist/assets when bundle introspection is unavailable.
 */
function collectPrecacheUrlsFromDist(outDir: string): string[] {
	const assetsDir = join(outDir, "assets")
	if (!existsSync(assetsDir)) return []

	const filenames = readdirSync(assetsDir, { withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => `assets/${entry.name}`)

	return collectPrecacheAssetUrlsFromAssetFilenames(filenames)
}

/**
 * Bundles src/sw.ts to IIFE sw.js with an injected precache URL list constant.
 */
async function buildAppServiceWorkerSource(
	options: BuildAppServiceWorkerOptions,
): Promise<string | null> {
	if (!existsSync(APP_SERVICE_WORKER_SOURCE_PATH)) return null

	const result = await build({
		entryPoints: [APP_SERVICE_WORKER_SOURCE_PATH],
		bundle: true,
		write: false,
		format: "iife",
		target: "es2018",
		platform: "browser",
		define: {
			__SW_PRECACHE_ASSETS__: JSON.stringify(options.precacheAssetUrls),
			__SW_WARMUP_ASSETS__: JSON.stringify(options.warmUpAssetUrls),
		},
	})

	const outputFile = result.outputFiles?.[0]
	return outputFile?.text ?? null
}

export default function createAppServiceWorkerPlugin(): PluginOption {
	let resolvedConfig: ResolvedConfig | null = null

	return {
		name: "vite-plugin-app-service-worker",
		enforce: "post",
		configResolved(config) {
			resolvedConfig = config
		},
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url) {
					next()
					return
				}

				const pathname = new URL(req.url, "https://localhost").pathname
				if (pathname === "/warmup-assets.json") {
					res.statusCode = 200
					res.setHeader("Content-Type", "application/json; charset=utf-8")
					res.end(JSON.stringify([]))
					return
				}

				if (pathname !== APP_SERVICE_WORKER_ROUTE_PATH) {
					next()
					return
				}

				const transformedSource = await buildAppServiceWorkerSource({
					precacheAssetUrls: [],
					warmUpAssetUrls: [],
				})
				if (!transformedSource) {
					next()
					return
				}

				res.statusCode = 200
				res.setHeader("Content-Type", "application/javascript; charset=utf-8")
				res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
				res.setHeader("Pragma", "no-cache")
				res.setHeader("Expires", "0")
				res.setHeader("Service-Worker-Allowed", "/")
				res.end(transformedSource)
			})
		},
		async generateBundle(_options, bundle) {
			if (!resolvedConfig || resolvedConfig.command !== "build") return

			// precache is cleared, all items routed to warmup list
			const precacheAssetUrls: string[] = []
			const warmUpAssetUrls = collectPrecacheUrlsFromBundle(bundle)
			const transformedSource = await buildAppServiceWorkerSource({
				precacheAssetUrls,
				warmUpAssetUrls: [],
			})
			if (!transformedSource) return

			this.emitFile({
				type: "asset",
				fileName: APP_SERVICE_WORKER_FILE_NAME,
				source: transformedSource,
			})

			this.emitFile({
				type: "asset",
				fileName: "warmup-assets.json",
				source: JSON.stringify(warmUpAssetUrls),
			})
		},
	}
}

export { collectPrecacheUrlsFromBundle, collectPrecacheUrlsFromDist }
