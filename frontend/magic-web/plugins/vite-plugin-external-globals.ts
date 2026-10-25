import type { Plugin } from "vite"

type ExternalGlobal = "React" | "ReactDOM" | "_"

function getExternalGlobal(specifier: string): ExternalGlobal | null {
	if (specifier === "lodash-es") return "_"
	if (/^react-dom(?:\/|$)/.test(specifier)) return "ReactDOM"
	if (/^react(?:\/|$)/.test(specifier)) return "React"
	return null
}

function renderImportClause(clause: string, globalName: ExternalGlobal): string {
	const trimmedClause = clause.trim()
	const statements: string[] = []

	const addNamedImports = (namedClause: string) => {
		const namedBindings = namedClause
			.replace(/^\{|\}$/g, "")
			.split(",")
			.map((binding) => binding.trim())
			.filter(Boolean)

		for (const binding of namedBindings) {
			const [importedName, localName] = binding.split(/\s+as\s+/)
			const local = (localName || importedName).trim()
			statements.push(`const ${local} = window.${globalName}.${importedName.trim()}`)
		}
	}

	if (trimmedClause.startsWith("*")) {
		const namespaceMatch = trimmedClause.match(/^\*\s+as\s+([\w$]+)/)
		if (namespaceMatch) statements.push(`const ${namespaceMatch[1]} = window.${globalName}`)
		return statements.join("\n")
	}

	if (trimmedClause.startsWith("{")) {
		addNamedImports(trimmedClause)
		return statements.join("\n")
	}

	const defaultMatch = trimmedClause.match(/^([\w$]+)/)
	if (defaultMatch) statements.push(`const ${defaultMatch[1]} = window.${globalName}`)

	const remainder = trimmedClause.slice(defaultMatch?.[0].length || 0).replace(/^\s*,\s*/, "")
	if (remainder.startsWith("*")) {
		const namespaceMatch = remainder.match(/^\*\s+as\s+([\w$]+)/)
		if (namespaceMatch) statements.push(`const ${namespaceMatch[1]} = window.${globalName}`)
	} else if (remainder.startsWith("{")) {
		addNamedImports(remainder)
	}

	return statements.join("\n")
}

/**
 * Rolldown can re-introduce external imports while composing dependency and
 * virtual chunks. Rewrite those final static imports so browser ESM never
 * attempts to resolve an npm package name such as `react` at runtime.
 */
export function externalGlobalsPlugin(): Plugin {
	return {
		name: "magic-external-globals",
		enforce: "post",
		renderChunk(code) {
			const rewritten = code.replace(
				/import\s+([\s\S]*?)\s+from\s*(["'])([^"']+)\2\s*;?/g,
				(fullImport, clause: string, _quote: string, specifier: string) => {
					const globalName = getExternalGlobal(specifier)
					return globalName ? renderImportClause(clause, globalName) : fullImport
				},
			)

			return rewritten === code ? null : { code: rewritten, map: null }
		},
	}
}
