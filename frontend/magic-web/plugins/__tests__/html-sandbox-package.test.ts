import { describe, expect, it } from "vitest"
import ts from "typescript"
import path from "node:path"
import { TextDecoder, TextEncoder } from "node:util"

describe("html-sandbox package resolution", () => {
	it("bundles root helpers from source without including the iframe runtime", async () => {
		const encodedTextConstructor = new TextEncoder().encode("").constructor
		Object.assign(globalThis, {
			TextDecoder,
			TextEncoder,
			Uint8Array: encodedTextConstructor,
		})
		const { build } = await import("esbuild")
		const result = await build({
			stdin: {
				contents: 'export { isSafeHref, getEditableTextContent } from "@dtyq/html-sandbox"',
				resolveDir: process.cwd(),
			},
			bundle: true,
			write: false,
			format: "esm",
			platform: "browser",
			conditions: ["magic-web-source"],
			metafile: true,
		})
		const code = result.outputFiles[0].text
		expect(code).toContain("isSafeHref")
		expect(code).toContain("getEditableTextContent")
		expect(code).not.toContain("MAGIC_DEVTOOLS_TOGGLE")
		expect(code).not.toContain("activateEditorRuntime")
		const bundledInputs = Object.values(result.metafile.outputs).flatMap((output) =>
			Object.entries(output.inputs)
				.filter(([, input]) => input.bytesInOutput > 0)
				.map(([name]) => name),
		)
		expect(bundledInputs).not.toContainEqual(expect.stringContaining("html-sandbox/dist/"))
		expect(bundledInputs).not.toContainEqual(expect.stringContaining("iframe-runtime.ts"))
	})

	it("resolves public, legacy, and HTML entries through the TypeScript package contract", () => {
		const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile)
		const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd())
		const containingFile = path.resolve("src/sandbox-consumer.ts")
		for (const [specifier, expected] of [
			["@dtyq/html-sandbox", "/src/index.ts"],
			["@dtyq/html-sandbox/runtime", "/src/runtime/index.ts"],
			["@dtyq/html-sandbox/utils/sourceNodes", "/src/utils/sourceNodes.ts"],
		]) {
			const resolved = ts.resolveModuleName(specifier, containingFile, parsed.options, ts.sys)
			expect(resolved.resolvedModule?.resolvedFileName).toContain(`html-sandbox${expected}`)
		}
	})
})
