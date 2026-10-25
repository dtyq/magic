import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import type { Plugin } from "vite"

export const LUCIDE_DYNAMIC_MODULE_ID = "virtual:lucide-react/dynamic"
const RESOLVED_LUCIDE_DYNAMIC_MODULE_ID = `\0${LUCIDE_DYNAMIC_MODULE_ID}`
const LUCIDE_DYNAMIC_QUERY = "lucide-dynamic"

interface LucideDynamicImport {
	name: string
	iconPath: string
}

interface LucideDynamicAggregateOptions {
	packageRoot?: string
}

/**
 * Replaces lucide-react/dynamic only for production builds. The generated
 * module uses static imports for every icon node, so Rolldown has no per-icon
 * import() boundary from which to emit facade chunks.
 */
export function lucideDynamicAggregatePlugin(options: LucideDynamicAggregateOptions = {}): Plugin {
	let isBuild = false
	let moduleSource = ""

	return {
		name: "lucide-dynamic-aggregate",
		enforce: "pre",
		configResolved(config) {
			isBuild = config.command === "build"
		},
		buildStart() {
			if (!isBuild) return

			const packageRoot = options.packageRoot ?? resolveLucidePackageRoot()
			moduleSource = createLucideDynamicModuleSource(packageRoot)
		},
		resolveId(id) {
			if (isBuild && (id === "lucide-react/dynamic" || id === LUCIDE_DYNAMIC_MODULE_ID)) {
				return RESOLVED_LUCIDE_DYNAMIC_MODULE_ID
			}
			return null
		},
		load(id) {
			if (isBuild && id === RESOLVED_LUCIDE_DYNAMIC_MODULE_ID) {
				return moduleSource
			}
			return null
		},
	}
}

export function resolveLucidePackageRoot(): string {
	const require = createRequire(import.meta.url)
	return dirname(require.resolve("lucide-react/package.json"))
}

export function parseLucideDynamicImports(source: string): LucideDynamicImport[] {
	const imports: LucideDynamicImport[] = []
	const seenNames = new Set<string>()
	const pattern =
		/(?:["']([^"']+)["']|([A-Za-z0-9_-]+))\s*:\s*\(\)\s*=>\s*import\(\s*["'](\.\/icons\/[^"']+)["']\s*\)/g

	for (const match of source.matchAll(pattern)) {
		const name = match[1] ?? match[2]
		const iconPath = match[3]
		if (!name || !iconPath || seenNames.has(name)) continue
		seenNames.add(name)
		imports.push({ name, iconPath })
	}

	return imports
}

export function createLucideDynamicModuleSource(packageRoot: string): string {
	const dynamicImportsPath = resolve(packageRoot, "dist/esm/dynamicIconImports.js")
	const dynamicImports = parseLucideDynamicImports(readFileSync(dynamicImportsPath, "utf8"))
	if (dynamicImports.length < 1900) {
		throw new Error(`Unexpected Lucide dynamic icon count: ${dynamicImports.length}`)
	}

	const uniqueIconPaths = [...new Set(dynamicImports.map((item) => item.iconPath))]
	const imports = uniqueIconPaths.map((iconPath, index) => {
		const variable = `iconNode${index}`
		return `import { __iconNode as ${variable} } from ${JSON.stringify(
			`${resolve(packageRoot, "dist/esm", iconPath.slice(2))}?${LUCIDE_DYNAMIC_QUERY}`,
		)}`
	})
	const variableByPath = new Map(
		uniqueIconPaths.map((iconPath, index) => [iconPath, `iconNode${index}`]),
	)
	const entries = dynamicImports.map(
		({ name, iconPath }) => `${JSON.stringify(name)}: ${variableByPath.get(iconPath)}`,
	)

	return `${imports.join("\n")}
import { forwardRef, createElement } from "react"
import Icon from ${JSON.stringify(`${resolve(packageRoot, "dist/esm/Icon.js")}?${LUCIDE_DYNAMIC_QUERY}`)}

const iconNodes = {\n\t${entries.join(",\n\t")}\n}
const iconNames = Object.keys(iconNodes)
const DynamicIcon = forwardRef(({ name, fallback: Fallback, ...props }, ref) => {
	const iconNode = iconNodes[name]
	if (!iconNode) return Fallback ? createElement(Fallback) : null
	return createElement(Icon, { ref, ...props, iconNode })
})

export { DynamicIcon, iconNames, iconNodes }
export default DynamicIcon
`
}
