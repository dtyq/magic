import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import type { InlineConfig, Plugin } from "vite"
import { createNoisePngBuffer } from "../shared/png"
import type { BenchmarkTarget } from "../shared/types"

const BROWSER_ROOT = fileURLToPath(new URL(".", import.meta.url))
const PACKAGE_ROOT = resolve(BROWSER_ROOT, "../..")
const ASSET_CACHE_MAX_BYTES = 32 * 1024 * 1024
const ASSET_CACHE_MAX_ENTRIES = 128

export function createBenchmarkViteConfig(target: BenchmarkTarget): InlineConfig {
	const targetPath =
		target === "dist"
			? resolve(PACKAGE_ROOT, "dist/index.js")
			: resolve(PACKAGE_ROOT, "src/index.ts")
	if (!existsSync(targetPath)) {
		throw new Error(`Benchmark target does not exist: ${targetPath}`)
	}

	return {
		configFile: false,
		root: BROWSER_ROOT,
		publicDir: false,
		logLevel: "error",
		resolve: {
			alias: [
				{
					find: "@html2pptx-benchmark-target",
					replacement: targetPath,
				},
			],
		},
		server: {
			host: "127.0.0.1",
			port: 0,
			strictPort: false,
		},
		plugins: [deterministicAssetPlugin()],
		optimizeDeps: {
			include: ["pptxgenjs", "@zumer/snapdom"],
		},
	}
}

function deterministicAssetPlugin(): Plugin {
	const cache = new Map<string, Buffer>()
	let cacheBytes = 0

	const readCached = (key: string): Buffer | undefined => {
		const buffer = cache.get(key)
		if (!buffer) return undefined
		cache.delete(key)
		cache.set(key, buffer)
		return buffer
	}

	const cacheBuffer = (key: string, buffer: Buffer): void => {
		if (buffer.byteLength > ASSET_CACHE_MAX_BYTES) return
		while (
			cache.size >= ASSET_CACHE_MAX_ENTRIES ||
			cacheBytes + buffer.byteLength > ASSET_CACHE_MAX_BYTES
		) {
			const oldestKey = cache.keys().next().value as string | undefined
			if (oldestKey === undefined) break
			const oldest = cache.get(oldestKey)
			cache.delete(oldestKey)
			cacheBytes -= oldest?.byteLength ?? 0
		}
		cache.set(key, buffer)
		cacheBytes += buffer.byteLength
	}

	return {
		name: "html2pptx-benchmark-assets",
		configureServer(server) {
			server.middlewares.use((request, response, next) => {
				const pathname = new URL(request.url ?? "/", "http://benchmark.local").pathname
				const match = pathname.match(
					/^\/__html2pptx_benchmark_asset\/(\d+)x(\d+)\/(\d+)\.png$/,
				)
				if (!match) {
					next()
					return
				}
				const width = Number(match[1])
				const height = Number(match[2])
				const seed = Number(match[3])
				if (width > 1024 || height > 1024) {
					response.statusCode = 400
					response.end("fixture dimensions exceed 1024px")
					return
				}
				const key = `${width}x${height}/${seed}`
				let buffer = readCached(key)
				if (!buffer) {
					buffer = createNoisePngBuffer(width, height, seed)
					cacheBuffer(key, buffer)
				}
				response.statusCode = 200
				response.setHeader("Content-Type", "image/png")
				response.setHeader("Content-Length", String(buffer.byteLength))
				response.setHeader("Cache-Control", "public, max-age=31536000, immutable")
				response.end(buffer)
			})
		},
	}
}
