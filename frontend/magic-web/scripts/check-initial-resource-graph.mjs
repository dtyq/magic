import { readFileSync, readdirSync, existsSync } from "node:fs"
import { resolve, dirname, relative } from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { init, parse } = require(
	require.resolve("es-module-lexer", {
		paths: [require.resolve("vite")],
	}),
)
await init
const root = resolve(process.argv[2] || "dist")
const visited = new Set()
const missing = new Set()

function visit(file) {
	if (visited.has(file)) return
	if (!existsSync(file)) {
		missing.add(relative(root, file))
		return
	}
	visited.add(file)
	if (!file.endsWith(".js")) return
	const code = readFileSync(file, "utf8")
	const [imports] = parse(code)
	for (const entry of imports) {
		// Follow static imports only: dynamic imports are expected for optional features.
		if (entry.d !== -1) continue
		const specifier = code.slice(entry.s, entry.e)
		if (specifier.startsWith(".")) visit(resolve(dirname(file), specifier))
		else if (specifier.startsWith("/")) visit(resolve(root, specifier.slice(1)))
	}
}

const htmlFiles = readdirSync(root).filter((file) => file.endsWith(".html"))
const fontReferences = []
for (const html of htmlFiles) {
	const code = readFileSync(resolve(root, html), "utf8")
	if (/Noto_Sans_SC_woff2\.css/.test(code)) fontReferences.push(html)
	for (const tag of code.matchAll(/<(?:script|link)\b[^>]*>/g)) {
		if (!/(?:type=["']module["']|rel=["']modulepreload["'])/.test(tag[0])) continue
		const path = /(?:src|href)=["']([^"']+)["']/.exec(tag[0])?.[1]
		if (path && !/^(?:https?:)?\/\//.test(path)) visit(resolve(root, path.replace(/^\//, "")))
	}
}
const forbidden = [...visited].filter((file) =>
	/(?:simple-editor|volcengine)-[^/]+\.js$/.test(file),
)
const report = {
	htmlEntries: htmlFiles,
	staticModuleCount: visited.size,
	forbiddenInitialChunks: forbidden.map((file) => relative(root, file)),
	fullNotoStylesheetsInHtml: fontReferences,
	missingStaticImports: [...missing],
}
console.log(JSON.stringify(report, null, 2))
if (!htmlFiles.length || forbidden.length || fontReferences.length || missing.size)
	process.exitCode = 1
