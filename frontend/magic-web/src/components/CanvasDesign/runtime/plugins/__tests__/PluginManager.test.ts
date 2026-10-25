import { afterEach, describe, expect, it, vi } from "vitest"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import { PluginManager } from "../PluginManager"

describe("PluginManager", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("does not register an asynchronous plugin load after destroy", async () => {
		let resolveManifestFile: ((value: { src: string }) => void) | undefined
		let getFileInfoCallCount = 0
		const getFileInfo = vi.fn(() => {
			getFileInfoCallCount += 1
			if (getFileInfoCallCount === 1) {
				return new Promise<{ src: string }>((resolve) => {
					resolveManifestFile = resolve
				})
			}
			return Promise.resolve({ src: "https://example.com/index.js" })
		})
		const resolveResourceReference: ResolveCanvasResourceReference = (input) => ({
			status: "resolved",
			resourceKind: "workspace-file",
			rawReference: "path" in input ? input.path : "",
			workspacePath: "path" in input ? input.path : "/plugin",
			storagePath: "path" in input ? input.path : "/plugin",
			identity: "path" in input ? input.path : "/plugin",
			candidates: ["path" in input ? input.path : "/plugin"],
			legacyRecovered: false,
			resolutionSource: "strict-path",
		})
		vi.stubGlobal(
			"fetch",
			vi.fn((input: RequestInfo | URL) => {
				const url = String(input)
				return Promise.resolve(
					new Response(
						url.includes("manifest.json")
							? JSON.stringify({ name: "example", entry: "index.js" })
							: "export default {}",
					),
				)
			}),
		)
		const manager = new PluginManager()

		const loadPromise = manager.loadUserPluginsFromCanvasResources({
			rootPath: "/canvas/plugins",
			directories: ["example"],
			getFileInfo,
			resolveResourceReference,
		})
		manager.destroy()
		resolveManifestFile?.({ src: "https://example.com/manifest.json" })
		await loadPromise

		expect(manager.list()).toEqual([])
	})
})
