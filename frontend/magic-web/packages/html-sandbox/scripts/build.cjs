#!/usr/bin/env node

/**
 * Build html-sandbox project output: dist/index.html.
 *
 * The shell HTML stays self-contained. The runtime entry is bundled to an IIFE
 * string, encoded as inert data, then decoded by the shell bootstrap at runtime.
 */

const fs = require("node:fs")
const path = require("node:path")

const pkgRoot = path.join(__dirname, "..")
const projectRoot = path.join(pkgRoot, "..", "..")
const distDir = path.join(pkgRoot, "dist")
const indexHtmlSrc = path.join(pkgRoot, "index.html")
const defaultRuntimeEntry = path.join(pkgRoot, "src", "auto-start.ts")
const defaultOutFile = path.join(distDir, "index.html")
const rebuildDebounceMs = 120
const runtimePlaceholder = "__MAGIC_IFRAME_RUNTIME_INLINE_PLACEHOLDER__"
const runtimeCommentPlaceholder = `/*${runtimePlaceholder}*/`

function parseArgs(argv) {
	const result = {}
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i]
		if (arg === "--runtime-entry") {
			result.runtimeEntry = argv[i + 1]
			i += 1
			continue
		}
		if (arg.startsWith("--runtime-entry=")) {
			result.runtimeEntry = arg.slice("--runtime-entry=".length)
			continue
		}
		if (arg === "--out-file") {
			result.outFile = argv[i + 1]
			i += 1
			continue
		}
		if (arg.startsWith("--out-file=")) {
			result.outFile = arg.slice("--out-file=".length)
			continue
		}
		if (arg === "--runtime-out-file") {
			result.runtimeOutFile = argv[i + 1]
			i += 1
			continue
		}
		if (arg.startsWith("--runtime-out-file=")) {
			result.runtimeOutFile = arg.slice("--runtime-out-file=".length)
			continue
		}
		if (arg === "--watch") {
			result.watch = true
		}
	}
	return result
}

function resolveEsbuild() {
	try {
		return require(
			require.resolve("esbuild", {
				paths: [pkgRoot, projectRoot],
			}),
		)
	} catch (directError) {
		try {
			const vitePackagePath = require.resolve("vite/package.json", {
				paths: [pkgRoot, projectRoot],
			})
			const viteDir = path.dirname(vitePackagePath)
			return require(path.join(viteDir, "..", "esbuild"))
		} catch {
			throw directError
		}
	}
}

const { build, transformSync } = resolveEsbuild()

function resolveOutputFile(cliOutFile) {
	if (!cliOutFile) return defaultOutFile
	if (path.isAbsolute(cliOutFile)) return cliOutFile
	return path.resolve(pkgRoot, cliOutFile)
}

function resolveRuntimeEntry(cliRuntimeEntry) {
	const configuredEntry =
		cliRuntimeEntry ||
		process.env.HTML_SANDBOX_RUNTIME_ENTRY ||
		process.env.MAGIC_HTML_SANDBOX_RUNTIME_ENTRY ||
		""

	if (!configuredEntry) return defaultRuntimeEntry
	if (path.isAbsolute(configuredEntry)) return configuredEntry
	return path.resolve(pkgRoot, configuredEntry)
}

function normalizePath(filePath) {
	return filePath.replace(/\\/g, "/")
}

function createHtmlSandboxAliasPlugin() {
	return {
		name: "html-sandbox-workspace-alias",
		setup(buildContext) {
			buildContext.onResolve({ filter: /^@\// }, (args) => ({
				path: path.resolve(projectRoot, "src", args.path.slice(2)),
			}))

		},
	}
}

function toAbsoluteInputPath(inputPath) {
	if (path.isAbsolute(inputPath)) return inputPath
	return path.resolve(pkgRoot, inputPath)
}

function encodeInlineRuntimeContent(content) {
	return Buffer.from(content, "utf8").toString("base64")
}

function minifyJavaScript(source) {
	if (!source || !source.trim()) return source

	try {
		const result = transformSync(source, {
			loader: "js",
			minify: true,
			legalComments: "none",
			target: "es2018",
		})
		return result.code.trim()
	} catch (error) {
		console.warn("[html-sandbox build] JS minify skipped:", error.message)
		return source
	}
}

function minifyInlineScripts(html) {
	return html.replace(
		/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
		(fullMatch, attrs = "", content = "") => {
			const normalizedAttrs = String(attrs)
			const normalizedContent = String(content)

			if (/\bsrc\s*=/.test(normalizedAttrs)) return fullMatch
			if (
				/\bid\s*=\s*["']magic-iframe-runtime-inline["']/.test(normalizedAttrs) ||
				/\bdata-runtime\s*=\s*["']true["']/.test(normalizedAttrs)
			) {
				return fullMatch
			}
			if (!normalizedContent.trim()) return `<script${normalizedAttrs}></script>`

			return `<script${normalizedAttrs}>${minifyJavaScript(normalizedContent)}</script>`
		},
	)
}

function minifyHtmlShell(html) {
	const preservedBlocks = []
	const htmlWithMinifiedScripts = minifyInlineScripts(html)
	const placeholderHtml = htmlWithMinifiedScripts.replace(
		/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
		(block) => {
			const token = `__MAGIC_HTML_SANDBOX_BLOCK_${preservedBlocks.length}__`
			preservedBlocks.push(block)
			return token
		},
	)

	const minifiedHtml = placeholderHtml
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/>\s+</g, "><")
		.replace(/\s{2,}/g, " ")
		.trim()

	return preservedBlocks.reduce((result, block, index) => {
		const token = `__MAGIC_HTML_SANDBOX_BLOCK_${index}__`
		return result.replace(token, block)
	}, minifiedHtml)
}

async function bundleRuntimeSource(runtimeEntry) {
	if (!fs.existsSync(runtimeEntry)) {
		throw new Error(`runtime entry not found: ${runtimeEntry}`)
	}

	const result = await build({
		entryPoints: [runtimeEntry],
		bundle: true,
		write: false,
		format: "iife",
		globalName: "MagicHtmlSandboxRuntime",
		target: "es2018",
		platform: "browser",
		minify: true,
		sourcemap: false,
		metafile: true,
		conditions: ["magic-web-source"],
		legalComments: "none",
		plugins: [createHtmlSandboxAliasPlugin()],
		banner: {
			js: "/* html-sandbox runtime - bundled into index.html */",
		},
	})

	const outputFile = result.outputFiles && result.outputFiles[0]
	if (!outputFile) {
		throw new Error("runtime bundle produced no output")
	}

	const inputPaths = Object.keys(result.metafile?.inputs || {}).map(toAbsoluteInputPath)
	return { source: outputFile.text, inputPaths }
}

function buildIndexHtml(runtimeSource) {
	const indexHtml = fs.readFileSync(indexHtmlSrc, "utf-8")
	if (!indexHtml.includes(runtimePlaceholder)) {
		throw new Error(`runtime placeholder not found in ${normalizePath(indexHtmlSrc)}`)
	}

	const encodedRuntimeSource = encodeInlineRuntimeContent(runtimeSource)
	const runtimePlaceholderToReplace = indexHtml.includes(runtimeCommentPlaceholder)
		? runtimeCommentPlaceholder
		: runtimePlaceholder
	const withRuntime = indexHtml
		.replace(runtimePlaceholderToReplace, () => encodedRuntimeSource)
		.replaceAll(JSON.stringify(runtimePlaceholder), '""')
	return minifyHtmlShell(withRuntime)
}

function getFileMtimeMs(filePath) {
	try {
		return fs.statSync(filePath).mtimeMs
	} catch {
		return 0
	}
}

async function buildHtml({ runtimeEntry, outFile, runtimeOutFile }) {
	fs.mkdirSync(path.dirname(outFile), { recursive: true })

	const runtimeBundle = await bundleRuntimeSource(runtimeEntry)
	const builtIndexHtml = buildIndexHtml(runtimeBundle.source)

	fs.writeFileSync(outFile, builtIndexHtml)
	if (runtimeOutFile) {
		fs.mkdirSync(path.dirname(runtimeOutFile), { recursive: true })
		fs.writeFileSync(runtimeOutFile, runtimeBundle.source)
	}

	console.log("[html-sandbox build] index.html created successfully.", {
		runtimeEntry: normalizePath(path.relative(projectRoot, runtimeEntry)),
		outFile: normalizePath(path.relative(projectRoot, outFile)),
		...(runtimeOutFile
			? { runtimeOutFile: normalizePath(path.relative(projectRoot, runtimeOutFile)) }
			: {}),
	})

	return runtimeBundle.inputPaths
}

async function watchHtml({ runtimeEntry, outFile, runtimeOutFile }) {
	let rebuildTimer = null
	let pollTimer = null
	let isBuilding = false
	let pendingRebuild = false
	let watchedPaths = []
	let watchedMtimes = new Map()

	const scheduleRebuild = (changedFile, eventType) => {
		if (process.env.HTML_SANDBOX_WATCH_DEBUG === "true") {
			console.log("[html-sandbox build] watch event:", {
				file: changedFile ? normalizePath(path.relative(projectRoot, changedFile)) : "",
				eventType,
			})
		}

		if (rebuildTimer) clearTimeout(rebuildTimer)
		rebuildTimer = setTimeout(() => {
			void runBuildAndRefreshWatchers()
		}, rebuildDebounceMs)
	}

	const refreshWatchedPaths = (nextWatchPaths) => {
		watchedPaths = nextWatchPaths.filter((watchPath) => fs.existsSync(watchPath))
		watchedMtimes = new Map(
			watchedPaths.map((watchPath) => [watchPath, getFileMtimeMs(watchPath)]),
		)
	}

	const pollWatchedFiles = () => {
		if (isBuilding || watchedPaths.length === 0) return

		for (const watchPath of watchedPaths) {
			const previousMtime = watchedMtimes.get(watchPath) || 0
			const nextMtime = getFileMtimeMs(watchPath)
			if (nextMtime !== previousMtime) {
				watchedMtimes.set(watchPath, nextMtime)
				scheduleRebuild(watchPath, "mtime")
				return
			}
		}
	}

	const runBuildAndRefreshWatchers = async () => {
		if (isBuilding) {
			pendingRebuild = true
			return
		}

		isBuilding = true
		try {
			const inputPaths = await buildHtml({ runtimeEntry, outFile, runtimeOutFile })
			const nextWatchPaths = Array.from(new Set([indexHtmlSrc, ...inputPaths]))

			refreshWatchedPaths(nextWatchPaths)
			if (!pollTimer) {
				pollTimer = setInterval(pollWatchedFiles, 500)
			}
			console.log("[html-sandbox build] watching files:", watchedPaths.length)
		} catch (error) {
			console.error("[html-sandbox build] rebuild failed:", error)
		} finally {
			isBuilding = false
			if (pendingRebuild) {
				pendingRebuild = false
				scheduleRebuild()
			}
		}
	}

	const stopWatching = () => {
		if (rebuildTimer) clearTimeout(rebuildTimer)
		if (pollTimer) clearInterval(pollTimer)
		rebuildTimer = null
		pollTimer = null
	}

	process.on("SIGINT", () => {
		stopWatching()
		process.exit(0)
	})
	process.on("SIGTERM", () => {
		stopWatching()
		process.exit(0)
	})

	await runBuildAndRefreshWatchers()
}

async function main() {
	const args = parseArgs(process.argv.slice(2))
	const runtimeEntry = resolveRuntimeEntry(args.runtimeEntry)
	const outFile = resolveOutputFile(args.outFile)
	const runtimeOutFile = args.runtimeOutFile ? resolveOutputFile(args.runtimeOutFile) : undefined

	if (args.watch) {
		await watchHtml({ runtimeEntry, outFile, runtimeOutFile })
		return
	}

	await buildHtml({ runtimeEntry, outFile, runtimeOutFile })
}

main().catch((error) => {
	console.error("[html-sandbox build] failed:", error)
	process.exit(1)
})
