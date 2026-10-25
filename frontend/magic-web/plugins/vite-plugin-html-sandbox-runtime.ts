import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"

const requireModule = createRequire(import.meta.url)
const { getHtmlSandboxAllowedOrigins, setHtmlSandboxRuntimeCorsHeaders } = requireModule(
	"../server/utils/htmlSandboxRuntimeCors.cjs",
) as {
	getHtmlSandboxAllowedOrigins: (env?: NodeJS.ProcessEnv) => string[]
	setHtmlSandboxRuntimeCorsHeaders: (
		response: {
			getHeader(name: string): number | string | string[] | undefined
			removeHeader(name: string): void
			setHeader(name: string, value: number | string | readonly string[]): void
		},
		requestOrigin: string | undefined,
		allowedOrigins: string[],
	) => void
}

export default function createHtmlSandboxRuntimePlugin(
	env: NodeJS.ProcessEnv = process.env,
): Plugin {
	const allowedOrigins = getHtmlSandboxAllowedOrigins(env)

	return {
		name: "magic-html-sandbox-runtime",
		apply: "serve",
		config() {
			return {
				server: {
					cors: { origin: allowedOrigins },
				},
			}
		},
		configureServer(server) {
			const runtimeMiddleware = async (
				req: IncomingMessage,
				res: ServerResponse,
				next: (error?: Error) => void,
			) => {
				if (!req.url || (req.method !== "GET" && req.method !== "HEAD")) {
					next()
					return
				}

				const pathname = new URL(req.url, "http://vite.local").pathname
				if (pathname !== "/husky-runtime.js") {
					next()
					return
				}

				try {
					const runtimeSource = await readFile(
						resolve(__dirname, "../public/husky-runtime.js"),
					)
					const requestOrigin = Array.isArray(req.headers.origin)
						? req.headers.origin[0]
						: req.headers.origin
					setHtmlSandboxRuntimeCorsHeaders(res, requestOrigin, allowedOrigins)
					res.statusCode = 200
					res.setHeader("Cache-Control", "no-cache")
					res.setHeader("Content-Type", "text/javascript; charset=utf-8")
					res.end(req.method === "HEAD" ? undefined : runtimeSource)
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code === "ENOENT") {
						next()
						return
					}
					next(error as Error)
				}
			}

			// Vite 8 registers rejectNoCorsRequestMiddleware before configureServer
			// hooks. Put this narrow handler first so the generated runtime can be
			// loaded by an older cross-origin shell without `crossorigin`.
			const middlewareStack = (
				server.middlewares as typeof server.middlewares & {
					stack?: Array<{ route: string; handle: typeof runtimeMiddleware }>
				}
			).stack
			if (Array.isArray(middlewareStack)) {
				middlewareStack.unshift({ route: "", handle: runtimeMiddleware })
			} else {
				server.middlewares.use(runtimeMiddleware)
			}
		},
	}
}
