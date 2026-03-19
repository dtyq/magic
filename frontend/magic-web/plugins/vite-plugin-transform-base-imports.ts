import type { PluginOption } from "vite"

type TargetPath = string | { base: string; subDirectory?: string }

interface TransformBaseImportsOptions {
	paths?: TargetPath[]
}

/**
 * Vite plugin to transform named imports from configurable base paths
 * to default imports from individual component paths, with optional subdirectory
 * support per base path.
 *
 * Transforms:
 *   import { FlexBox } from "<configured-path>"
 *   import { FlexBox, MagicButton } from "<configured-path>"
 *   import { FlexBox as FB } from "<configured-path>"
 * To:
 *   import FlexBox from "<configured-path>/FlexBox"
 *   import FlexBox from "<configured-path>/FlexBox"
 *   import MagicButton from "<configured-path>/MagicButton"
 *   import FB from "<configured-path>/FlexBox"
 */
export default function vitePluginTransformBaseImports(
	options: TransformBaseImportsOptions = {},
): PluginOption {
	const targetPaths = normalizeTargetPaths(options.paths)

	const escapedPaths = targetPaths.map((target) => escapeRegex(target.base)).join("|")
	const importPattern = new RegExp(
		`^(\\s*)import\\s+\\{([^}]+)\\}\\s+from\\s+["'](${escapedPaths})["'](?:\\s*;)?\\s*$`,
	)

	return {
		name: "vite-plugin-transform-base-imports",
		enforce: "pre",
		transform(code, id) {
			// Only process TypeScript/JavaScript files
			if (!/\.(ts|tsx|js|jsx)$/.test(id)) {
				return null
			}

			// Skip node_modules
			if (id.includes("node_modules")) {
				return null
			}

			// Match import statements from @/components/base
			// Match complete import statements on a single line or multiple lines
			// Pattern: import { ... } from "@/components/base"
			const lines = code.split("\n")
			const transformedLines: string[] = []
			let hasChanges = false

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i]

				// Check if this line contains the target import pattern
				const importMatch = line.match(importPattern)

				if (importMatch) {
					const [, indent, namedImports, importPath] = importMatch
					const target = targetPaths.find((item) => item.base === importPath)
					if (!target) {
						transformedLines.push(line)
						continue
					}

					// Parse named imports
					const imports = namedImports
						.split(",")
						.map((imp: string) => imp.trim())
						.filter((imp: string) => imp.length > 0)

					if (imports.length > 0) {
						hasChanges = true

						// Transform each named import to a default import
						const transformedImports = imports.map((imp: string) => {
							// Handle aliased imports: import { FlexBox as FB } from "..."
							// Match pattern: "ComponentName" or "ComponentName as Alias"
							const aliasMatch = imp.match(/^(\w+)(?:\s+as\s+(\w+))?$/)
							if (aliasMatch) {
								const [, componentName, alias] = aliasMatch
								const importName = alias || componentName
								return `${indent}import ${importName} from "${buildImportPath({
									base: importPath,
									subDirectory: target.subDirectory,
									componentName,
								})}"`
							}
							// Fallback: treat the whole string as component name
							return `${indent}import ${imp} from "${buildImportPath({
								base: importPath,
								subDirectory: target.subDirectory,
								componentName: imp,
							})}"`
						})

						transformedLines.push(...transformedImports)
						continue
					}
				}

				transformedLines.push(line)
			}

			if (!hasChanges) {
				return null
			}

			return {
				code: transformedLines.join("\n"),
				map: null, // Source map can be generated if needed
			}
		},
	}
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeTargetPaths(paths?: TransformBaseImportsOptions["paths"]) {
	if (!paths || paths.length === 0) {
		return [{ base: "@/components/base", subDirectory: "" }]
	}

	return paths.map((path) => {
		if (typeof path === "string") {
			return { base: path, subDirectory: "" }
		}
		return { base: path.base, subDirectory: path.subDirectory || "" }
	})
}

function buildImportPath({
	base,
	subDirectory,
	componentName,
}: {
	base: string
	subDirectory?: string
	componentName: string
}): string {
	const prefix = subDirectory ? `${subDirectory.replace(/\/$/, "")}/` : ""
	return `${base}/${prefix}${componentName}`
}
