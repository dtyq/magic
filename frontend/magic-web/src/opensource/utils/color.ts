/**
 * Add alpha channel to hex color
 * @param hex - Hex color string (e.g., "#FF7D00")
 * @param alpha - Opacity value (0-1), e.g., 0.05 means 5%
 * @returns Hex color with alpha channel (e.g., "#FF7D000D")
 * @example
 * const hexColor = "#FF7D00"
 * const alpha = 0.05 // 5% opacity
 * const hexWithAlpha = addAlphaToHex(hexColor, alpha)
 * console.log(hexWithAlpha) // Output: #FF7D000D
 */
export function addAlphaToHex(hex: string, alpha = 1): string {
	if (!hex) return "transparent"

	// Remove '#' symbol
	const cleanHex = hex.replace("#", "")

	// Validate hex format (3 or 6 characters)
	const hexMatch = cleanHex.match(/^([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/)
	if (!hexMatch) return "transparent"

	const hexValue = hexMatch[1]

	// Expand 3-digit hex to 6-digit
	const expandedHex =
		hexValue.length === 3
			? hexValue
					.split("")
					.map((char) => char + char)
					.join("")
			: hexValue

	// Ensure alpha is between 0 and 1, convert to 0-255 range
	const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)

	// Return hex color with alpha channel as 2-digit hex
	return `#${expandedHex}${a.toString(16).padStart(2, "0")}`
}
