import { build } from "esbuild"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { appendFile, cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import magicApiPlugin from "../../plugins/vite-plugin-magic-api"
import { compileIframeRuntime } from "../../plugins/vite-plugin-iframe-runtime"

export const fixtureRoot = dirname(fileURLToPath(import.meta.url))
export const projectRoot = resolve(fixtureRoot, "../..")
export const outputRoot = resolve(projectRoot, "node_modules/.cache/html-sandbox-fixtures")

export async function buildFixtures() {
	await mkdir(outputRoot, { recursive: true })
	// Use the production shell builder and production prelude plugin. An empty
	// virtual:magic-api (used by ordinary jsdom tests) would hide boot-order bugs.
	execFileSync(
		process.execPath,
		[
			resolve(projectRoot, "packages/html-sandbox/scripts/build.cjs"),
			"--out-file",
			resolve(outputRoot, "shell.html"),
			"--runtime-out-file",
			resolve(outputRoot, "husky-runtime.js"),
		],
		{ cwd: projectRoot, stdio: "inherit" },
	)
	// A loaded shell fallback must not masquerade as a successful host runtime load.
	await appendFile(
		resolve(outputRoot, "husky-runtime.js"),
		"\nwindow.__FIXTURE_HOST_RUNTIME_LOADED__ = true;\n",
	)
	const plugin = magicApiPlugin({ projectRoot })
	const load = typeof plugin.load === "function" ? plugin.load : plugin.load?.handler
	if (!load) throw new Error("Magic API plugin has no loader")
	const preludeModule = await load.call({} as never, "\0virtual:magic-api")
	if (typeof preludeModule !== "string") throw new Error("Missing production prelude")
	const iframeRuntime = await compileIframeRuntime(projectRoot)
	await build({
		entryPoints: [resolve(fixtureRoot, "host.ts")],
		outfile: resolve(outputRoot, "host.js"),
		bundle: true,
		format: "esm",
		platform: "browser",
		target: "es2022",
		alias: { "@": resolve(projectRoot, "src") },
		plugins: [
			{
				name: "fixture-host-boundaries",
				setup(builder) {
					const boundaryModules = new Set([
						"@/apis",
						"@/components/base/MagicToaster/utils",
						"@/pages/superMagic/fileAccess/fileApi",
						"@/pages/superMagic/stores/core",
						"@/pages/superMagic/utils/topics",
						"@/pages/superMagic/utils/handleFIle",
						"@/pages/superMagic/utils/projectAttachments/attachmentMutationWaiter",
						"@/pages/superMagic/hooks/useChatWorkspace",
						"@/services/superMagic/DefaultAgentSelectionService",
						"@/infrastructure/logger",
						"react-i18next",
					])
					builder.onResolve({ filter: /.*/ }, (args) => {
						if (
							boundaryModules.has(args.path) ||
							(args.importer.includes("/iframe-api/") &&
								/(^|\/)magicBaseApi$|(^|\/)iframeApi$/.test(args.path))
						)
							return { path: resolve(fixtureRoot, "host-dependencies.ts") }
						return null
					})
					builder.onResolve({ filter: /\?raw$/ }, (args) => {
						const base = resolve(args.resolveDir, args.path.slice(0, -4))
						return {
							path: [base, base + ".ts", base + ".js"].find(existsSync) || base,
							namespace: "fixture-raw",
						}
					})
					builder.onLoad({ filter: /.*/, namespace: "fixture-raw" }, async (args) => ({
						contents: await readFile(args.path, "utf8"),
						loader: "text",
					}))
					// Only application/backend dependencies are replaced; HTML generators,
					// virtual storage, runtime, APIs and proxy implementations stay real.
					const stubs: Record<string, string> = {
						"virtual:magic-api": preludeModule,
						"virtual:magic-iframe-runtime": `export default ${JSON.stringify(iframeRuntime.scripts)}`,
						"@/models/config":
							'export const configStore = { i18n: { language: "en_US" } }',
						"@/models/config/utils": "export const languageHelper = {}",
						"@/utils/env":
							'export const env = key => key === "MAGIC_CDNHOST" ? window.location.origin : "";',
						"@/pages/superMagic/utils/api":
							'export const getTemporaryDownloadUrl = () => { throw Error("Unexpected backend access") }; export const getFileContentById = getTemporaryDownloadUrl; export const downloadFileContent = getTemporaryDownloadUrl;',
					}
					builder.onResolve({ filter: /.*/ }, (args) =>
						args.path in stubs
							? { path: args.path, namespace: "fixture-boundary" }
							: null,
					)
					builder.onLoad({ filter: /.*/, namespace: "fixture-boundary" }, (args) => ({
						contents: stubs[args.path],
						loader: "js",
					}))
				},
			},
		],
	})
	await cp(resolve(fixtureRoot, "fixtures"), resolve(outputRoot, "fixtures"), { recursive: true })
	await cp(resolve(fixtureRoot, "index.html"), resolve(outputRoot, "index.html"))
	const assets = resolve(outputRoot, "resolved-assets")
	await mkdir(assets, { recursive: true })
	await writeFile(resolve(assets, "resource.json"), JSON.stringify({ message: "real resource" }))
	await writeFile(resolve(assets, "resource.js"), "window.dynamicResourceLoaded = true")
	await writeFile(resolve(assets, "resource.css"), "#resource-target { color: rgb(1, 2, 3) }")
	await writeFile(
		resolve(assets, "resource.svg"),
		'<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="red"/></svg>',
	)
}
