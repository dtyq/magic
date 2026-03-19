/**
 * CSS utility functions
 */

/**
 * Convert camelCase to kebab-case
 */
export function camelToKebab(str: string): string {
	return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

/**
 * Convert kebab-case to camelCase
 */
export function kebabToCamel(str: string): string {
	return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Convert RGB color to HEX format
 * Handles rgb(r, g, b) and rgba(r, g, b, a) formats
 */
export function rgbToHex(rgb: string): string {
	// Return as-is if already in hex format
	if (rgb.startsWith("#")) return rgb

	// Handle rgba/rgb format
	const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/)
	if (!match) return rgb

	const r = parseInt(match[1])
	const g = parseInt(match[2])
	const b = parseInt(match[3])

	const toHex = (n: number) => {
		const hex = n.toString(16)
		return hex.length === 1 ? "0" + hex : hex
	}

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Normalize color value for UI display
 * Converts rgb/rgba to hex format
 */
export function normalizeColor(color: string): string {
	if (!color || color === "transparent" || color === "none") {
		return "#000000"
	}

	// Convert rgb/rgba to hex
	if (color.startsWith("rgb")) {
		return rgbToHex(color)
	}

	return color
}

/**
 * Normalize textAlign value for UI display
 * Maps logical values (start/end) to physical values (left/right)
 */
export function normalizeTextAlign(textAlign: string): string {
	// Map logical values to physical values
	// Note: In LTR contexts, "start" = "left" and "end" = "right"
	// For simplicity, we assume LTR (most common case)
	if (textAlign === "start") return "left"
	if (textAlign === "end") return "right"
	// Pass through standard values
	if (["left", "center", "right", "justify"].includes(textAlign)) {
		return textAlign
	}
	// Default fallback
	return "left"
}

/**
 * Normalize CSS value by removing "normal", "none", "auto" defaults
 * Returns empty string for default values to indicate "not set"
 */
export function normalizeDefaultValue(value: string, property: string): string {
	const defaultValues = ["normal", "none", "auto"]
	if (defaultValues.includes(value)) {
		return ""
	}
	return value
}
