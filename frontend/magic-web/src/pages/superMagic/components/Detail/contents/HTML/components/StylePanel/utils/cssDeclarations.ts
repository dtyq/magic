export interface CSSDeclarationsResult {
	styles: Record<string, string>
	error?: string
}

const PROPERTY_PATTERN = /^(?:--[a-zA-Z0-9_-]+|-?[a-zA-Z][a-zA-Z0-9-]*)$/

function splitDeclarations(source: string): string[] {
	const declarations: string[] = []
	let start = 0
	let depth = 0
	let quote: '"' | "'" | null = null
	let escaped = false

	for (let index = 0; index < source.length; index += 1) {
		const character = source[index]
		if (escaped) {
			escaped = false
			continue
		}
		if (character === "\\" && quote) {
			escaped = true
			continue
		}
		if (quote) {
			if (character === quote) quote = null
			continue
		}
		if (character === '"' || character === "'") {
			quote = character
			continue
		}
		if (character === "(") depth += 1
		if (character === ")") depth = Math.max(0, depth - 1)
		if (character === ";" && depth === 0) {
			declarations.push(source.slice(start, index).trim())
			start = index + 1
		}
	}

	declarations.push(source.slice(start).trim())
	return declarations.filter(Boolean)
}

/**
 * Parse CSS declarations without accepting selectors or style tags.
 * The returned keys are kept in CSS kebab-case because the iframe bridge
 * normalizes both kebab-case and camelCase properties before writing them.
 */
export function parseCSSDeclarations(input: string): CSSDeclarationsResult {
	const styles: Record<string, string> = {}
	const source = input.replace(/\/\*[\s\S]*?\*\//g, "").trim()

	if (!source) return { styles }
	if (/[{}]/.test(source) || /<\/?\s*style\b/i.test(source)) {
		return {
			styles: {},
			error: "Only CSS declarations are supported, not selectors or style tags.",
		}
	}

	const declarations = splitDeclarations(source)

	for (const declaration of declarations) {
		const separatorIndex = declaration.indexOf(":")
		if (separatorIndex <= 0) {
			return { styles: {}, error: `Invalid declaration: ${declaration}` }
		}

		const property = declaration.slice(0, separatorIndex).trim()
		const value = declaration.slice(separatorIndex + 1).trim()
		if (!PROPERTY_PATTERN.test(property) || !value) {
			return { styles: {}, error: `Invalid declaration: ${declaration}` }
		}

		if (!isValidCSSValue(property, value)) {
			return { styles: {}, error: `Invalid CSS value: ${property}` }
		}

		styles[property] = value
	}

	return { styles }
}

/**
 * Validate a declaration with the browser CSS parser instead of maintaining a
 * fixed allow-list. This keeps custom properties and newer CSS properties
 * available to the code editor.
 */
function isValidCSSValue(property: string, value: string): boolean {
	if (property.startsWith("--")) return true
	if (typeof document === "undefined") return true

	const probe = document.createElement("div").style
	const importantMatch = value.match(/^(.*?)(?:\s*!important\s*)$/i)
	const cssValue = importantMatch ? importantMatch[1].trim() : value
	const priority = importantMatch ? "important" : ""
	if (!cssValue) return false
	if (globalThis.CSS?.supports) return globalThis.CSS.supports(property, cssValue)

	probe.setProperty(property, cssValue, priority)
	return probe.getPropertyValue(property).trim() !== ""
}

export function serializeCSSDeclarations(styles: Record<string, string>): string {
	return Object.entries(styles)
		.map(([property, value]) => `${property}: ${value};`)
		.join("\n")
}
