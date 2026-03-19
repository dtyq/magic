/**
 * Box Shadow Parser and Builder
 * Handles parsing and building CSS box-shadow strings
 */

export interface BoxShadowValue {
	/** X offset in pixels */
	offsetX: number
	/** Y offset in pixels */
	offsetY: number
	/** Blur radius in pixels */
	blur: number
	/** Spread radius in pixels */
	spread: number
	/** Shadow color */
	color: string
	/** Whether it's an inset shadow */
	inset: boolean
}

/**
 * Default box shadow value
 */
export const DEFAULT_BOX_SHADOW: BoxShadowValue = {
	offsetX: 0,
	offsetY: 4,
	blur: 6,
	spread: 0,
	color: "rgba(0, 0, 0, 0.1)",
	inset: false,
}

/**
 * Parse a CSS box-shadow string into structured data
 * Supports formats like:
 * - "2px 4px 10px 0px rgba(0,0,0,0.25)"
 * - "0 0 10px #000"
 * - "inset 2px 4px 6px rgba(0,0,0,0.1)"
 */
export function parseBoxShadow(shadowString: string): BoxShadowValue {
	if (!shadowString || shadowString === "none") {
		return { ...DEFAULT_BOX_SHADOW }
	}

	const trimmed = shadowString.trim()

	// Check for inset
	const inset = trimmed.startsWith("inset")
	const valueString = inset ? trimmed.replace(/^inset\s+/, "") : trimmed

	// Regular expression to match shadow values
	// Matches: offsetX offsetY blur? spread? color
	const regex =
		/^(-?\d+(?:\.\d+)?(?:px)?)\s+(-?\d+(?:\.\d+)?(?:px)?)\s+(-?\d+(?:\.\d+)?(?:px)?)?\s*(-?\d+(?:\.\d+)?(?:px)?)?\s*(.+)?$/

	const match = valueString.match(regex)

	if (!match) {
		return { ...DEFAULT_BOX_SHADOW }
	}

	const [, offsetX, offsetY, blur = "0", spread = "0", color = "rgba(0, 0, 0, 0.1)"] = match

	return {
		offsetX: parseFloat(offsetX),
		offsetY: parseFloat(offsetY),
		blur: parseFloat(blur),
		spread: parseFloat(spread),
		color: color.trim() || "rgba(0, 0, 0, 0.1)",
		inset,
	}
}

/**
 * Build a CSS box-shadow string from structured data
 */
export function buildBoxShadow(shadow: BoxShadowValue): string {
	const { offsetX, offsetY, blur, spread, color, inset } = shadow

	const values = [`${offsetX}px`, `${offsetY}px`, `${blur}px`, `${spread}px`, color].join(" ")

	return inset ? `inset ${values}` : values
}

/**
 * Convert hex color to rgba
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
	// Remove # if present
	hex = hex.replace(/^#/, "")

	// Parse hex values
	let r: number, g: number, b: number

	if (hex.length === 3) {
		r = parseInt(hex[0] + hex[0], 16)
		g = parseInt(hex[1] + hex[1], 16)
		b = parseInt(hex[2] + hex[2], 16)
	} else if (hex.length === 6) {
		r = parseInt(hex.substring(0, 2), 16)
		g = parseInt(hex.substring(2, 4), 16)
		b = parseInt(hex.substring(4, 6), 16)
	} else {
		return `rgba(0, 0, 0, ${alpha})`
	}

	return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Extract hex color from rgba/rgb/hex color string
 */
export function extractHexColor(color: string): string {
	// If already hex, return it
	if (color.startsWith("#")) {
		return color.length === 7 ? color : "#000000"
	}

	// Parse rgb/rgba
	const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
	if (rgbaMatch) {
		const [, r, g, b] = rgbaMatch
		const toHex = (n: string) => parseInt(n).toString(16).padStart(2, "0")
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`
	}

	return "#000000"
}
