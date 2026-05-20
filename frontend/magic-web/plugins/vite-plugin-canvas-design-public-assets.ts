import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { PluginOption } from "vite"

const CANVAS_MEDIA_RESOURCE_SW_FILE_NAME = "canvas-media-resource-sw.js"
const CANVAS_MEDIA_RESOURCE_SW_PATH = resolve(
	__dirname,
	"../src/components/CanvasDesign/public",
	CANVAS_MEDIA_RESOURCE_SW_FILE_NAME,
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
				if (!pathname.endsWith(`/${CANVAS_MEDIA_RESOURCE_SW_FILE_NAME}`)) {
					next()
					return
				}

				if (!existsSync(CANVAS_MEDIA_RESOURCE_SW_PATH)) {
					next()
					return
				}

				res.statusCode = 200
				res.setHeader("Content-Type", "application/javascript; charset=utf-8")
				res.setHeader("Service-Worker-Allowed", "/")
				res.end(readFileSync(CANVAS_MEDIA_RESOURCE_SW_PATH))
			})
		},
		generateBundle() {
			if (!existsSync(CANVAS_MEDIA_RESOURCE_SW_PATH)) {
				return
			}

			this.emitFile({
				type: "asset",
				fileName: CANVAS_MEDIA_RESOURCE_SW_FILE_NAME,
				source: readFileSync(CANVAS_MEDIA_RESOURCE_SW_PATH),
			})
		},
	}
}
