/**
 * vite-plugin-magic-api
 *
 * Compiles the Magic API prelude entry (prelude-entry.ts) into a
 * self-contained IIFE string at build time and exposes it as the
 * virtual module `virtual:magic-api`.
 *
 * The IIFE is injected into the iframe document's <head> by
 * full-content.ts — it must run synchronously before any user scripts.
 *
 * @dtyq/html-sandbox/runtime is externalised to
 * window.MagicHtmlSandboxRuntime (already available when the shell
 * starts) so the runtime code is not duplicated in the bundle.
 */

import path from "node:path"
import type { Plugin } from "vite"

const VIRTUAL_MODULE_ID = "virtual:magic-api"
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`

/**
 * JS stub that maps public package and legacy runtime imports to the shell
 * global.  `|| class {}` ensures `extends BaseRuntimeBridgeApiPlugin`
 * doesn't throw at module evaluation time when the runtime is absent;
 * the real guard is in prelude-entry.ts which short-circuits before
 * registerRuntimePlugins.
 */
const RUNTIME_STUB_SOURCE = `
var _RT = (typeof window !== "undefined" && window.MagicHtmlSandboxRuntime) || {};
export var BaseRuntimeBridgeApiPlugin = _RT.BaseRuntimeBridgeApiPlugin || class {};
export var registerRuntimePlugins = _RT.registerRuntimePlugins;
export var runtimeLoggerHub = _RT.runtimeLoggerHub;
export var RuntimeLoggerHub = _RT.RuntimeLoggerHub;
export var installRegisteredRuntimePlugins = _RT.installRegisteredRuntimePlugins;

`

interface MagicApiPluginOptions {
	projectRoot: string
}

export default function vitePluginMagicApi({ projectRoot }: MagicApiPluginOptions): Plugin {
	const preludeEntryPath = path.resolve(
		projectRoot,
		"src/pages/superMagic/components/Detail/contents/HTML/iframe-api/magic-api/prelude-entry.ts",
	)
	const htmlSandboxPackageRoot = path.resolve(projectRoot, "packages/html-sandbox")

	let cachedCode: string | null = null

	function createRuntimeStubPlugin(): import("esbuild").Plugin {
		return {
			name: "magic-api-runtime-stub",
			setup(build) {
				build.onResolve({ filter: /^@dtyq\/html-sandbox\/runtime(?:\/|$)/ }, () => ({
					path: "html-sandbox-runtime-stub",
					namespace: "magic-api-stub",
				}))

				build.onResolve({ filter: /^@dtyq\/html-sandbox$/ }, () => ({
					path: "html-sandbox-runtime-stub",
					namespace: "magic-api-stub",
				}))

				build.onLoad({ filter: /.*/, namespace: "magic-api-stub" }, () => ({
					// Keep the origin policy shared with the package instead of copying it
					// into the runtime stub when root imports also request host helpers.
					contents: `${RUNTIME_STUB_SOURCE}
export { getParentOrigin } from ${JSON.stringify(path.resolve(htmlSandboxPackageRoot, "src/utils/parentOrigin.ts"))};`,
					resolveDir: projectRoot,
					loader: "js",
				}))
			},
		}
	}

	function createPathAliasPlugin(): import("esbuild").Plugin {
		return {
			name: "magic-api-path-alias",
			setup(build) {
				build.onResolve({ filter: /^@\// }, (args) => ({
					path: path.resolve(projectRoot, "src", args.path.slice(2)),
				}))
			},
		}
	}

	async function buildPrelude(): Promise<string> {
		const esbuild = await import("esbuild")
		const result = await esbuild.build({
			entryPoints: [preludeEntryPath],
			bundle: true,
			write: false,
			format: "iife",
			platform: "browser",
			conditions: ["magic-web-source"],
			target: "es2018",
			minify: true,
			sourcemap: false,
			legalComments: "none",
			plugins: [createRuntimeStubPlugin(), createPathAliasPlugin()],
		})

		const outputFile = result.outputFiles?.[0]
		if (!outputFile) {
			throw new Error("[vite-plugin-magic-api] esbuild produced no output")
		}

		return outputFile.text.replace(/<\/script/gi, "<\\/script")
	}

	return {
		name: "vite-plugin-magic-api",
		enforce: "pre",

		resolveId(id) {
			if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID
		},

		async load(id) {
			if (id !== RESOLVED_VIRTUAL_MODULE_ID) return

			if (!cachedCode) {
				cachedCode = await buildPrelude()
			}

			return `export default ${JSON.stringify(cachedCode)}`
		},

		handleHotUpdate({ file }) {
			const magicApiDir = path.resolve(
				projectRoot,
				"src/pages/superMagic/components/Detail/contents/HTML/iframe-api/magic-api",
			)
			if (file.startsWith(magicApiDir) && file.endsWith(".ts")) {
				cachedCode = null
			}
		},

		buildStart() {
			cachedCode = null
		},
	}
}
