import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { Plugin, UserConfig } from "vite"
import { afterEach, describe, expect, it } from "vitest"
import { buildOverlayFromLayers, type ResolvedLayerConfig } from "../layers"
import { resolveExtensionlessHtmlEntry } from "../../plugins/vite-plugin-overlay/html"

function getHtmlOverlayPlugin(config: { plugins?: unknown }): Plugin | undefined {
	return (config.plugins as Plugin[] | undefined)?.find(
		(plugin) => plugin.name === "vite-plugin-overlay:html",
	)
}

function requireHtmlOverlayPlugin(config: { plugins?: unknown }): Plugin {
	const plugin = getHtmlOverlayPlugin(config)
	if (!plugin) throw new Error("html overlay plugin is required")
	return plugin
}

function getGeneratedOverlayConfig(config: { plugins?: unknown }): UserConfig {
	const plugin = (config.plugins as Plugin[] | undefined)?.find(
		(candidate) => candidate.name === "vite-plugin-overlay:config",
	)
	if (!plugin) throw new Error("overlay config plugin is required")

	const configHook = plugin.config as unknown as () => UserConfig
	return configHook.call({} as never)
}

function loadVirtualHtml(plugin: Plugin, virtualPath: string): unknown {
	const loadHook = plugin.load as unknown as (id: string) => unknown
	return loadHook.call({} as never, virtualPath)
}

const tempRoots: string[] = []

function createTempDir() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "magic-layers-"))
	tempRoots.push(dir)
	return dir
}

function writeFile(root: string, relativePath: string, content = relativePath) {
	const filePath = path.join(root, relativePath)
	fs.mkdirSync(path.dirname(filePath), { recursive: true })
	fs.writeFileSync(filePath, content, "utf8")
	return filePath
}

function layer(name: string, rootPath: string): ResolvedLayerConfig {
	return { name, rootPath }
}

afterEach(() => {
	for (const tempRoot of tempRoots.splice(0)) {
		fs.rmSync(tempRoot, { recursive: true, force: true })
	}
})

describe("buildOverlayFromLayers html entries", () => {
	it("resolves an extensionless request only when it matches a declared HTML entry", () => {
		const htmlEntryNames = new Set(["login-popup-callback.html", "shared.html"])

		expect(resolveExtensionlessHtmlEntry("/login-popup-callback", htmlEntryNames)).toBe(
			"login-popup-callback.html",
		)
		expect(resolveExtensionlessHtmlEntry("/shared", htmlEntryNames)).toBe("shared.html")
		expect(resolveExtensionlessHtmlEntry("/workspace/123", htmlEntryNames)).toBeNull()
		expect(
			resolveExtensionlessHtmlEntry("/login-popup-callback.html", htmlEntryNames),
		).toBeNull()
	})

	it("lets a higher-priority layer override a same-named baseline HTML file", () => {
		const baseRoot = createTempDir()
		const enterpriseRoot = createTempDir()
		writeFile(baseRoot, "index.html", "base-index")
		writeFile(enterpriseRoot, "index.html", "enterprise-index")

		const overlayConfig = buildOverlayFromLayers({
			projectRoot: baseRoot,
			layers: [layer("base", baseRoot), layer("enterprise", enterpriseRoot)],
		})
		const config = getGeneratedOverlayConfig(overlayConfig)
		const input = config.build?.rolldownOptions?.input as Record<string, string>

		// The entry is projected onto the project root as a VIRTUAL path; root
		// never drifts to the winning layer's folder.
		const virtualIndex = path.resolve(baseRoot, "index.html")
		expect(input.index).toBe(virtualIndex)
		expect(config.root).toBe(baseRoot)

		// The html-overlay plugin maps the virtual id back to the winning content.
		const plugin = requireHtmlOverlayPlugin(overlayConfig)
		expect(loadVirtualHtml(plugin, virtualIndex)).toBe("enterprise-index")
	})

	it("unions layer-unique HTML pages into the entry set (addition, not override)", () => {
		const baseRoot = createTempDir()
		const enterpriseRoot = createTempDir()
		const baseIndex = writeFile(baseRoot, "index.html")
		writeFile(enterpriseRoot, "demo.html", "enterprise-demo")
		writeFile(enterpriseRoot, "shared.html")
		writeFile(enterpriseRoot, "login-popup-callback.html")

		const overlayConfig = buildOverlayFromLayers({
			projectRoot: baseRoot,
			layers: [layer("base", baseRoot), layer("enterprise", enterpriseRoot)],
		})
		const config = getGeneratedOverlayConfig(overlayConfig)
		const input = config.build?.rolldownOptions?.input as Record<string, string>

		expect(input.index).toBe(baseIndex)
		// Layer-unique pages are also addressed by virtual project-root paths, so
		// the build emits them at the dist top level instead of dist/<layer>/.
		expect(input.demo).toBe(path.resolve(baseRoot, "demo.html"))
		expect(input.shared).toBe(path.resolve(baseRoot, "shared.html"))
		// Entry key strips only the `.html` suffix; the file name is otherwise kept.
		expect(input["login-popup-callback"]).toBe(
			path.resolve(baseRoot, "login-popup-callback.html"),
		)
		expect(config.root).toBe(baseRoot)

		const plugin = requireHtmlOverlayPlugin(overlayConfig)
		expect(loadVirtualHtml(plugin, path.resolve(baseRoot, "demo.html"))).toBe("enterprise-demo")
		// The baseline-owned entry is NOT overridden: load defers to the real file.
		expect(loadVirtualHtml(plugin, baseIndex)).toBeNull()
	})

	it("only scans the layer root top level, never nested dirs like public/", () => {
		const baseRoot = createTempDir()
		writeFile(baseRoot, "index.html")
		// Static assets served from public/ must never leak in as build entries.
		writeFile(baseRoot, "public/husky.html")
		writeFile(baseRoot, "src/pages/nested.html")

		const overlayConfig = buildOverlayFromLayers({
			projectRoot: baseRoot,
			layers: [layer("base", baseRoot)],
		})
		const config = getGeneratedOverlayConfig(overlayConfig)
		const input = config.build?.rolldownOptions?.input as Record<string, string>

		expect(Object.keys(input)).toEqual(["index"])
	})

	it("ignores directories, dotfiles and non-html files", () => {
		const baseRoot = createTempDir()
		const baseIndex = writeFile(baseRoot, "index.html")
		writeFile(baseRoot, ".hidden.html")
		writeFile(baseRoot, "readme.md")
		// A directory whose name ends with .html must not be treated as an entry.
		fs.mkdirSync(path.join(baseRoot, "weird.html"), { recursive: true })

		const overlayConfig = buildOverlayFromLayers({
			projectRoot: baseRoot,
			layers: [layer("base", baseRoot)],
		})
		const config = getGeneratedOverlayConfig(overlayConfig)
		const input = config.build?.rolldownOptions?.input as Record<string, string>

		expect(input).toEqual({ index: baseIndex })
	})

	it("keeps root at the project root even when no index.html exists", () => {
		const baseRoot = createTempDir()
		const enterpriseRoot = createTempDir()
		writeFile(enterpriseRoot, "demo.html")

		const overlayConfig = buildOverlayFromLayers({
			projectRoot: baseRoot,
			layers: [layer("base", baseRoot), layer("enterprise", enterpriseRoot)],
		})
		const config = getGeneratedOverlayConfig(overlayConfig)

		expect(config.root).toBe(baseRoot)
	})

	it("returns an empty config when no HTML entries are found", () => {
		const baseRoot = createTempDir()

		const overlayConfig = buildOverlayFromLayers({
			projectRoot: baseRoot,
			layers: [layer("base", baseRoot)],
		})
		const config = getGeneratedOverlayConfig(overlayConfig)

		expect(config).toEqual({})
	})
})
