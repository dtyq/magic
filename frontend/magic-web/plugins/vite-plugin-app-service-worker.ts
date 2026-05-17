import { existsSync, readFileSync } from "node:fs"
import { resolve } from "path"
import { transformSync } from "esbuild"
import type { PluginOption } from "vite"

const APP_SERVICE_WORKER_FILE_NAME = "sw.js"
const APP_SERVICE_WORKER_ROUTE_PATH = `/${APP_SERVICE_WORKER_FILE_NAME}`
const APP_SERVICE_WORKER_SOURCE_PATH = resolve(__dirname, "../src/sw.ts")

function buildAppServiceWorkerSource(): string | null {
	if (!existsSync(APP_SERVICE_WORKER_SOURCE_PATH)) return null

	const source = readFileSync(APP_SERVICE_WORKER_SOURCE_PATH, "utf-8")
	return transformSync(source, {
		loader: "ts",
		format: "iife",
		target: "es2018",
	}).code
}

export default function createAppServiceWorkerPlugin(): PluginOption {
	return {
		name: "vite-plugin-app-service-worker",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (!req.url) {
					next()
					return
				}

				const pathname = new URL(req.url, "https://localhost").pathname
				if (pathname !== APP_SERVICE_WORKER_ROUTE_PATH) {
					next()
					return
				}

				const transformedSource = buildAppServiceWorkerSource()
				if (!transformedSource) {
					next()
					return
				}

				res.statusCode = 200
				res.setHeader("Content-Type", "application/javascript; charset=utf-8")
				res.setHeader("Service-Worker-Allowed", "/")
				res.end(transformedSource)
			})
		},
		generateBundle() {
			const transformedSource = buildAppServiceWorkerSource()
			if (!transformedSource) return

			this.emitFile({
				type: "asset",
				fileName: APP_SERVICE_WORKER_FILE_NAME,
				source: transformedSource,
			})
		},
	}
}
