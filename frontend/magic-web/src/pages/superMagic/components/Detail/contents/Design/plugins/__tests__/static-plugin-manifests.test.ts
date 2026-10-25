import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

const pluginsRoot = resolve(
	process.cwd(),
	"src/pages/superMagic/components/Detail/contents/Design/plugins",
)

const requiredCapabilities = [
	"ui.toast",
	"ui.close",
	"ui.setHeight",
	"assets.pickFiles",
	"assets.uploadFile",
	"assets.fetchBlob",
	"ai.getImageModels",
	"ai.generateAndPlace",
]

const supportedRuntimeVersions = [1]

function getPluginDirs() {
	return readdirSync(pluginsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((pluginDir) => existsSync(join(pluginsRoot, pluginDir, "manifest.json")))
		.sort()
}

describe("static CanvasDesign plugins", () => {
	it("declare version and required capabilities without exposing contributions", () => {
		const pluginDirs = getPluginDirs()
		expect(pluginDirs).toHaveLength(25)

		for (const pluginDir of pluginDirs) {
			const manifest = JSON.parse(
				readFileSync(join(pluginsRoot, pluginDir, "manifest.json"), "utf8"),
			)
			expect(manifest.capabilities, pluginDir).toEqual(
				expect.arrayContaining(requiredCapabilities),
			)
			expect(supportedRuntimeVersions, pluginDir).toContain(manifest.version)
			expect(manifest.contributes, pluginDir).toBeUndefined()
		}
	})

	it("use the create/render plugin entry instead of top-level mount", () => {
		for (const pluginDir of getPluginDirs()) {
			const runtimeCode = readFileSync(join(pluginsRoot, pluginDir, "index.js"), "utf8")
			const oldRuntimePath = join(pluginsRoot, pluginDir, "index.old.js")
			const oldRuntimeCode = existsSync(oldRuntimePath)
				? readFileSync(oldRuntimePath, "utf8")
				: ""
			const registerIndex = runtimeCode.indexOf("registerMagicCanvasPlugin({")
			if (oldRuntimeCode) {
				expect(oldRuntimeCode, pluginDir).toMatch(/mount\(ctx,\s*root\)/)
			}
			expect(registerIndex, pluginDir).toBeGreaterThan(0)
			expect(runtimeCode.slice(registerIndex), pluginDir).not.toMatch(/\nfunction\s/)
			expect(runtimeCode, pluginDir).toContain("function createInitialState()")
			expect(runtimeCode, pluginDir).toContain("MagicPluginKit.createPanelState")
			expect(runtimeCode, pluginDir).toContain("state: MagicPluginKit.createPanelState")
			expect(runtimeCode, pluginDir).toContain("state: instance.state")
			expect(runtimeCode, pluginDir).toContain("ctx.panel.render(root,")
			expect(runtimeCode, pluginDir).toMatch(/create\(ctx\)/)
			expect(runtimeCode, pluginDir).toMatch(
				/render\(ctx,\s*instance,\s*root(?:,\s*scope)?\)/,
			)
			expect(runtimeCode, pluginDir).not.toContain("return createPluginInstance(ctx)")
			expect(runtimeCode, pluginDir).not.toContain("return createPluginView(ctx")
			expect(runtimeCode, pluginDir).not.toContain("createPluginInstance")
			expect(runtimeCode, pluginDir).not.toContain("createPluginView")
			expect(runtimeCode, pluginDir).not.toContain("createPluginInitialState")
			expect(runtimeCode, pluginDir).not.toContain("initialState:")
			expect(runtimeCode, pluginDir).not.toContain("MagicPluginKit.render(ctx, root")
			expect(runtimeCode, pluginDir).not.toMatch(/mount\(ctx,\s*root\)/)
			expect(runtimeCode, pluginDir).not.toContain("MagicPluginKit.mount")
			expect(runtimeCode, pluginDir).not.toContain('root.querySelector(".mpk-panel")')
		}
	})
})
