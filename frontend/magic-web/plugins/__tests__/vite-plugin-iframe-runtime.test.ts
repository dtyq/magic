import { TextDecoder, TextEncoder } from "node:util"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it, vi, afterEach } from "vitest"
import vitePluginIframeRuntime, { compileIframeRuntime } from "../vite-plugin-iframe-runtime"

afterEach(() => vi.unstubAllGlobals())

function useNativeEncoding() {
	// esbuild needs the Node encoder and its matching typed-array realm in jsdom.
	vi.stubGlobal("TextDecoder", TextDecoder)
	vi.stubGlobal("TextEncoder", TextEncoder)
	vi.stubGlobal("Uint8Array", new TextEncoder().encode("").constructor)
}

describe("iframe runtime build", () => {
	it("bundles every installer without unresolved imports or script terminators", async () => {
		useNativeEncoding()
		const { scripts, dependencies } = await compileIframeRuntime(process.cwd())
		expect(Object.keys(scripts).sort()).toEqual([
			"content-metrics",
			"legacy-cookie",
			"legacy-indexed-db",
			"legacy-storage",
			"navigation",
			"service-worker",
			"telemetry",
			"touch-pinch",
		])
		for (const script of Object.values(scripts)) {
			expect(typeof new Function(`return ${script}`)()).toBe("function")
			expect(script).not.toMatch(/<\/script/i)
		}
		expect(dependencies.some((file) => file.endsWith("/navigation.ts"))).toBe(true)
	})

	it("watches compiled dependencies and invalidates the virtual module on edits", async () => {
		useNativeEncoding()
		const plugin = vitePluginIframeRuntime({ projectRoot: process.cwd() })
		if (typeof plugin.load !== "function" || typeof plugin.handleHotUpdate !== "function")
			throw Error("Expected load and HMR hooks")
		const addWatchFile = vi.fn()
		const loaded = await plugin.load.call(
			{ addWatchFile } as never,
			"\0virtual:magic-iframe-runtime",
			{} as never,
		)
		expect(String(loaded)).toContain("export default")
		const dependency = addWatchFile.mock.calls
			.map(([file]) => String(file))
			.find((file) => file.endsWith("/navigation.ts"))
		expect(dependency).toBeDefined()
		const virtualModule = { id: "\0virtual:magic-iframe-runtime" }
		const invalidateModule = vi.fn()
		const result = await plugin.handleHotUpdate.call(
			{} as never,
			{
				file: dependency,
				modules: [],
				server: { moduleGraph: { getModuleById: () => virtualModule, invalidateModule } },
			} as never,
		)
		expect(invalidateModule).toHaveBeenCalledWith(virtualModule)
		expect(result).toEqual([virtualModule])
	})

	it("recompiles an edited transitive dependency instead of serving cached code", async () => {
		useNativeEncoding()
		const projectRoot = await mkdtemp(path.join(tmpdir(), "magic-iframe-runtime-"))
		try {
			const directory = path.join(
				projectRoot,
				"src/pages/superMagic/components/Detail/contents/HTML/iframe-runtime",
			)
			await mkdir(directory, { recursive: true })
			for (const name of [
				"telemetry",
				"content-metrics",
				"service-worker",
				"legacy-cookie",
				"legacy-storage",
				"legacy-indexed-db",
				"navigation",
				"touch-pinch",
			])
				await writeFile(
					path.join(directory, `${name}.ts`),
					'import value from "./shared"; export default () => value;',
				)
			const dependency = path.join(directory, "shared.ts")
			await writeFile(dependency, 'export default "before-update"')
			const plugin = vitePluginIframeRuntime({ projectRoot })
			if (typeof plugin.load !== "function" || typeof plugin.watchChange !== "function")
				throw Error("Missing build hooks")
			const context = { addWatchFile: vi.fn() }
			const first = await plugin.load.call(
				context as never,
				"\0virtual:magic-iframe-runtime",
				{} as never,
			)
			expect(String(first)).toContain("before-update")
			expect(context.addWatchFile).toHaveBeenCalledWith(dependency)
			await writeFile(dependency, 'export default "after-update"')
			await plugin.watchChange.call({} as never, dependency, { event: "update" })
			const second = await plugin.load.call(
				context as never,
				"\0virtual:magic-iframe-runtime",
				{} as never,
			)
			expect(String(second)).toContain("after-update")
			expect(String(second)).not.toContain("before-update")
		} finally {
			await rm(projectRoot, { recursive: true, force: true })
		}
	})
})
