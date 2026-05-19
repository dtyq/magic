import type { PluginOption } from "vite"
import {
	createSourceFile,
	isImportDeclaration,
	isNamedImports,
	isStringLiteral,
	ScriptKind,
	ScriptTarget,
} from "typescript"

type TargetPath =
	| string
	| {
			base: string
			subDirectory?: string
			componentNameFormatter?: (componentName: string) => string
	  }

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
 *
 * Optional componentNameFormatter can rewrite the target segment:
 *   import { CircleCheckIcon } from "lucide-react"
 * To:
 *   import CircleCheckIcon from "lucide-react/dist/esm/icons/circle-check.js"
 */
export default function vitePluginTransformBaseImports(
	options: TransformBaseImportsOptions = {},
): PluginOption {
	const targetPaths = normalizeTargetPaths(options.paths)

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

			const sourceFile = createSourceFile(
				id,
				code,
				ScriptTarget.Latest,
				true,
				getScriptKindFromId(id),
			)

			let hasChanges = false
			const replacements: Array<{ start: number; end: number; text: string }> = []

			for (const statement of sourceFile.statements) {
				if (!isImportDeclaration(statement)) continue
				if (!statement.importClause || statement.importClause.isTypeOnly) continue
				if (!isStringLiteral(statement.moduleSpecifier)) continue

				const importPath = statement.moduleSpecifier.text
				const target = targetPaths.find((item) => item.base === importPath)
				if (!target) continue

				const namedBindings = statement.importClause.namedBindings
				if (!namedBindings || !isNamedImports(namedBindings)) continue

				const valueSpecifiers = namedBindings.elements.filter((element) => !element.isTypeOnly)
				const typeSpecifiers = namedBindings.elements.filter((element) => element.isTypeOnly)
				if (valueSpecifiers.length === 0) continue

				hasChanges = true

				const nextImports: string[] = []
				if (statement.importClause.name) {
					nextImports.push(`import ${statement.importClause.name.text} from "${importPath}"`)
				}

				if (typeSpecifiers.length > 0) {
					nextImports.push(
						`import type { ${typeSpecifiers
							.map((specifier) => formatSpecifierText(specifier))
							.join(", ")} } from "${importPath}"`,
					)
				}

				for (const specifier of valueSpecifiers) {
					const importedName = specifier.propertyName?.text ?? specifier.name.text
					const localName = specifier.name.text

					nextImports.push(
						`import ${localName} from "${buildImportPath({
							base: importPath,
							subDirectory: target.subDirectory,
							componentName: target.componentNameFormatter
								? target.componentNameFormatter(importedName)
								: importedName,
						})}"`,
					)
				}

				replacements.push({
					start: statement.getStart(sourceFile),
					end: statement.getEnd(),
					text: nextImports.join("\n"),
				})
			}

			if (!hasChanges) {
				return null
			}

			return {
				code: applyReplacements(code, replacements),
				map: null, // Source map can be generated if needed
			}
		},
	}
}

function normalizeTargetPaths(paths?: TransformBaseImportsOptions["paths"]) {
	if (!paths || paths.length === 0) {
		return [{ base: "@/components/base", subDirectory: "" }]
	}

	return paths.map((path) => {
		if (typeof path === "string") {
			return { base: path, subDirectory: "" }
		}
		return {
			base: path.base,
			subDirectory: path.subDirectory || "",
			componentNameFormatter: path.componentNameFormatter,
		}
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

function getScriptKindFromId(id: string): ScriptKind {
	if (id.endsWith(".tsx")) return ScriptKind.TSX
	if (id.endsWith(".jsx")) return ScriptKind.JSX
	if (id.endsWith(".js")) return ScriptKind.JS
	return ScriptKind.TS
}

function formatSpecifierText(specifier: {
	propertyName?: { text: string }
	name: { text: string }
}): string {
	const importedName = specifier.propertyName?.text ?? specifier.name.text
	if (importedName === specifier.name.text) return importedName

	return `${importedName} as ${specifier.name.text}`
}

function applyReplacements(
	code: string,
	replacements: Array<{ start: number; end: number; text: string }>,
): string {
	return replacements
		.sort((a, b) => b.start - a.start)
		.reduce(
			(currentCode, replacement) =>
				`${currentCode.slice(0, replacement.start)}${replacement.text}${currentCode.slice(replacement.end)}`,
			code,
		)
}
