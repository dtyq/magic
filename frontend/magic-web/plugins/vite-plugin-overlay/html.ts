import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import type { Plugin, UserConfig } from "vite"

const HTML_EXT = ".html"

export interface HtmlOverlayLayerOption {
	rootPath: string
}

export interface HtmlOverlayPlan {
	config: UserConfig
	htmlOverrides: Map<string, string>
	htmlEntryNames: Set<string>
}

export interface VitePluginHtmlOverlayOptions {
	/**
	 * Absolute baseline-root (virtual) html path -> absolute overlay (real) html
	 * path. Built by createHtmlOverlayPlan: every root-level HTML entry is
	 * projected onto the baseline root so Vite's `root` (and everything derived
	 * from it: PostCSS/Tailwind config lookup, dev URLs, dist layout) stays at
	 * the project root regardless of which layer wins a given file.
	 */
	htmlOverrides: Map<string, string>
	/** Root-level HTML entry names that may also be addressed without `.html`. */
	htmlEntryNames: ReadonlySet<string>
}

/**
 * Discover root-level HTML entries across the active layers. A higher-priority
 * layer may override a same-named baseline entry or add a new top-level page,
 * but nested directories such as `public/` never become app build entries.
 */
export function createHtmlOverlayPlan({
	projectRoot,
	layers,
}: {
	projectRoot: string
	layers: HtmlOverlayLayerOption[]
}): HtmlOverlayPlan {
	if (layers.length === 0) {
		return { config: {}, htmlOverrides: new Map(), htmlEntryNames: new Set() }
	}

	// Baseline -> most-specific iteration: later layers overwrite earlier files.
	const entryPathByFileName = new Map<string, string>()
	for (const layer of layers) {
		for (const fileName of listRootHtmlFiles(layer.rootPath)) {
			entryPathByFileName.set(fileName, path.resolve(layer.rootPath, fileName))
		}
	}

	if (entryPathByFileName.size === 0) {
		return { config: {}, htmlOverrides: new Map(), htmlEntryNames: new Set() }
	}

	// HTML entries are projected onto virtual project-root paths so the dev URL
	// and build output stay stable even when the winning file lives in a layer.
	const input: Record<string, string> = {}
	const htmlOverrides = new Map<string, string>()
	entryPathByFileName.forEach((filePath, fileName) => {
		const virtualPath = path.resolve(projectRoot, fileName)
		input[fileName.slice(0, -HTML_EXT.length)] = virtualPath
		if (virtualPath !== filePath) htmlOverrides.set(virtualPath, filePath)
	})

	return {
		config: {
			root: projectRoot,
			build: { rolldownOptions: { input } },
			optimizeDeps: { entries: Array.from(entryPathByFileName.values()) },
		},
		htmlOverrides,
		htmlEntryNames: new Set(entryPathByFileName.keys()),
	}
}

/**
 * Resolve only declared root-level HTML entries from extensionless requests.
 * Unknown paths must remain available to Vite's normal SPA fallback.
 */
export function resolveExtensionlessHtmlEntry(
	pathname: string,
	htmlEntryNames: ReadonlySet<string>,
): string | null {
	const fileName = pathname.replace(/^\/+/, "")
	if (!fileName || fileName.includes("/") || fileName.endsWith(HTML_EXT)) return null

	const candidate = `${fileName}${HTML_EXT}`
	return htmlEntryNames.has(candidate) ? candidate : null
}

/** Top-level `*.html` regular files of a layer root; `[]` when the dir is absent. */
function listRootHtmlFiles(rootPath: string): string[] {
	try {
		return readdirSync(rootPath, { withFileTypes: true })
			.filter(
				(entry) =>
					entry.isFile() && !entry.name.startsWith(".") && entry.name.endsWith(HTML_EXT),
			)
			.map((entry) => entry.name)
	} catch {
		return []
	}
}

/**
 * Serve/emit overlay HTML entries under baseline-root virtual paths.
 *
 * The layered overlay projects source files onto `src/**`; this plugin is the
 * HTML counterpart. An entry like `enterprise/index.html` is addressed as
 * `<projectRoot>/index.html` everywhere (dev URL, build input, dist output),
 * while its CONTENT is read from the winning layer's real file:
 *   - build: the `load` hook maps the virtual id to the real file's content, so
 *     the bundle emits `dist/index.html` / `dist/shared.html` at the top level
 *     instead of `dist/enterprise/...`.
 *   - dev (direct request): the middleware serves overlay entries that have no
 *     baseline file on disk (e.g. `/shared.html`), which Vite's own html
 *     middleware would otherwise 404.
 *   - dev (SPA fallback): deep links (`/chat`) are rewritten to `/index.html`
 *     INSIDE Vite's middleware chain, after ours — the `transformIndexHtml`
 *     pre hook swaps the baseline disk content for the overlay content there.
 */
export default function vitePluginHtmlOverlay({
	htmlOverrides,
	htmlEntryNames,
}: VitePluginHtmlOverlayOptions): Plugin {
	function readOverlayHtml(virtualPath: string): string | null {
		const realPath = htmlOverrides.get(path.normalize(virtualPath))
		if (!realPath) return null
		return readFileSync(realPath, "utf8")
	}

	const overlayRealPaths = new Set(
		Array.from(htmlOverrides.values()).map((p) => path.normalize(p)),
	)

	return {
		name: "vite-plugin-overlay:html",
		enforce: "pre",

		// Overlay-unique virtual entries (e.g. <root>/shared.html) have no file on
		// disk, so the default fs resolver would reject them as UNRESOLVED_ENTRY.
		// Claim the id here; `load` below supplies the content.
		resolveId(source) {
			const normalized = path.normalize(source)
			return htmlOverrides.has(normalized) ? normalized : null
		},

		load(id) {
			return readOverlayHtml(id)
		},

		transformIndexHtml: {
			order: "pre",
			handler(_html, ctx) {
				return readOverlayHtml(ctx.filename) ?? undefined
			},
		},

		configureServer(server) {
			// Content edits to overlay html files need a full reload (they are
			// served outside Vite's module graph).
			overlayRealPaths.forEach((realPath) => server.watcher.add(realPath))
			server.watcher.on("change", (filePath) => {
				if (!overlayRealPaths.has(path.normalize(filePath))) return
				server.ws.send({ type: "full-reload" })
			})

			// Registered directly (not via the returned callback) so it runs BEFORE
			// Vite's html middleware, which only serves files that exist under root.
			server.middlewares.use(async (req, res, next) => {
				if (req.method !== "GET" && req.method !== "HEAD") return next()

				const url = req.url ?? "/"
				const [pathname] = url.split(/[?#]/, 1)
				const requestedFileName =
					pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "")
				const isHtmlRequest = requestedFileName.endsWith(HTML_EXT)
				const fileName = isHtmlRequest
					? requestedFileName
					: resolveExtensionlessHtmlEntry(pathname, htmlEntryNames)
				if (!fileName || fileName.includes("/")) return next()

				const virtualPath = path.resolve(server.config.root, fileName)
				const overlayHtml = readOverlayHtml(virtualPath)
				const html = overlayHtml ?? (isHtmlRequest ? null : readFileIfExists(virtualPath))
				if (html === null) return next()

				try {
					const transformedHtml = await server.transformIndexHtml(
						url,
						html,
						req.originalUrl,
					)
					res.setHeader("Content-Type", "text/html")
					res.end(transformedHtml)
				} catch (error) {
					next(error)
				}
			})
		},
	}
}

function readFileIfExists(filePath: string): string | null {
	try {
		return readFileSync(filePath, "utf8")
	} catch {
		return null
	}
}
