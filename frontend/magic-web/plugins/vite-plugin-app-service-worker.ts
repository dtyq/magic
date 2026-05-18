import { existsSync } from "node:fs"
import { resolve } from "path"
import { build } from "esbuild"
import type { PluginOption } from "vite"

const APP_SERVICE_WORKER_FILE_NAME = "sw.js"
const APP_SERVICE_WORKER_ROUTE_PATH = `/${APP_SERVICE_WORKER_FILE_NAME}`
const APP_SERVICE_WORKER_SOURCE_PATH = resolve(__dirname, "../src/sw.ts")

async function buildAppServiceWorkerSource(): Promise<string | null> {
	if (!existsSync(APP_SERVICE_WORKER_SOURCE_PATH)) return null

	const result = await build({
		entryPoints: [APP_SERVICE_WORKER_SOURCE_PATH],
		bundle: true,
		write: false,
		format: "iife",
		target: "es2018",
		platform: "browser",
	})

	const outputFile = result.outputFiles?.[0]
	return outputFile?.text ?? null
}

export default function createAppServiceWorkerPlugin(): PluginOption {
	return {
		name: "vite-plugin-app-service-worker",
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url) {
					next()
					return
				}

				const pathname = new URL(req.url, "https://localhost").pathname
				if (pathname !== APP_SERVICE_WORKER_ROUTE_PATH) {
					next()
					return
				}

				const transformedSource = await buildAppServiceWorkerSource()
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
		async generateBundle() {
			const transformedSource = await buildAppServiceWorkerSource()
			if (!transformedSource) return

			this.emitFile({
				type: "asset",
				fileName: APP_SERVICE_WORKER_FILE_NAME,
				source: transformedSource,
			})
		},
	}
}
