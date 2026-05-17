import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { PluginOption } from "vite"

const CANVAS_MEDIA_RESOURCE_SW_SOURCE_FILE_NAME = "canvas-media-resource-sw.js"
const CANVAS_MEDIA_RESOURCE_SW_OUTPUT_FILE_NAME = "sw.js"
const CANVAS_MEDIA_RESOURCE_SW_SCOPE = "/canvas-design-media/"
const CANVAS_MEDIA_RESOURCE_SW_ROUTE_PATH = `${CANVAS_MEDIA_RESOURCE_SW_SCOPE}${CANVAS_MEDIA_RESOURCE_SW_OUTPUT_FILE_NAME}`
const CANVAS_MEDIA_RESOURCE_SW_PATH = resolve(
	__dirname,
	"../src/components/CanvasDesign/public",
	CANVAS_MEDIA_RESOURCE_SW_SOURCE_FILE_NAME,
)

export default function createCanvasDesignPublicAssetsPlugin(): PluginOption {
	return {
		name: "vite-plugin-canvas-design-public-assets",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (!req.url) {
					next()
					return
				}

				const pathname = new URL(req.url, "https://localhost").pathname
				if (pathname !== CANVAS_MEDIA_RESOURCE_SW_ROUTE_PATH) {
					next()
					return
				}

				if (!existsSync(CANVAS_MEDIA_RESOURCE_SW_PATH)) {
					next()
					return
				}

				// 仅把 Canvas SW 暴露在子作用域下，避免与主 SW 争抢根 scope 的控制权。
				res.statusCode = 200
				res.setHeader("Content-Type", "application/javascript; charset=utf-8")
				res.setHeader("Service-Worker-Allowed", CANVAS_MEDIA_RESOURCE_SW_SCOPE)
				res.end(readFileSync(CANVAS_MEDIA_RESOURCE_SW_PATH))
			})
		},
		generateBundle() {
			if (!existsSync(CANVAS_MEDIA_RESOURCE_SW_PATH)) {
				return
			}

			this.emitFile({
				type: "asset",
				// 产物统一挂到 /canvas-design-media/sw.js，让注册路径和 scope 推导保持一致。
				fileName: `canvas-design-media/${CANVAS_MEDIA_RESOURCE_SW_OUTPUT_FILE_NAME}`,
				source: readFileSync(CANVAS_MEDIA_RESOURCE_SW_PATH),
			})
		},
	}
}
