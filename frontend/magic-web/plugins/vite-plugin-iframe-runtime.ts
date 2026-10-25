import path from "node:path"
import type { Plugin } from "vite"

const moduleId = "virtual:magic-iframe-runtime"
const resolvedId = `\0${moduleId}`
const runtimeDirectory = "src/pages/superMagic/components/Detail/contents/HTML/iframe-runtime"
const entries = [
	"touch-pinch",
	"telemetry",
	"content-metrics",
	"service-worker",
	"legacy-cookie",
	"legacy-storage",
	"legacy-indexed-db",
	"navigation",
] as const

/** Compile isolated installers, never host code or a runtime string replacement. */
export async function compileIframeRuntime(projectRoot: string) {
	const { build } = await import("esbuild")
	const result = await build({
		absWorkingDir: projectRoot,
		entryPoints: entries.map((entry) => path.join(runtimeDirectory, `${entry}.ts`)),
		outdir: "iframe-runtime",
		write: false,
		bundle: true,
		format: "iife",
		globalName: "MagicIframeInstaller",
		platform: "browser",
		target: "es2018",
		minify: true,
		metafile: true,
		legalComments: "none",
	})
	const scripts: Record<string, string> = {}
	for (const output of result.outputFiles) {
		const name = path.basename(output.path, ".js")
		// The installer namespace is local to each invocation: documents may be
		// rewritten repeatedly and unrelated installers cannot overwrite it.
		scripts[name] =
			`(function(options){${output.text}\nMagicIframeInstaller.default(options);})`.replace(
				/<\/script/gi,
				"<\\/script",
			)
	}
	return {
		scripts,
		dependencies: Object.keys(result.metafile.inputs).map((file) =>
			path.resolve(projectRoot, file),
		),
	}
}

export default function vitePluginIframeRuntime({ projectRoot }: { projectRoot: string }): Plugin {
	let cached: ReturnType<typeof compileIframeRuntime> | undefined
	let dependencies = new Set<string>()
	const invalidate = () => {
		cached = undefined
	}
	return {
		name: "vite-plugin-iframe-runtime",
		enforce: "pre",
		resolveId(id) {
			if (id === moduleId) return resolvedId
		},
		async load(id) {
			if (id !== resolvedId) return
			cached ??= compileIframeRuntime(projectRoot).catch((error: unknown) => {
				invalidate()
				throw error
			})
			const result = await cached
			dependencies = new Set(result.dependencies)
			for (const dependency of dependencies) this.addWatchFile(dependency)
			return `export default ${JSON.stringify(result.scripts)}`
		},
		buildStart: invalidate,
		watchChange(file) {
			if (dependencies.has(path.resolve(file))) invalidate()
		},
		handleHotUpdate(context) {
			if (!dependencies.has(path.resolve(context.file))) return
			invalidate()
			const virtualModule = context.server.moduleGraph.getModuleById(resolvedId)
			if (virtualModule) {
				context.server.moduleGraph.invalidateModule(virtualModule)
				return [...context.modules, virtualModule]
			}
		},
	}
}
