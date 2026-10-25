interface DimensionSource {
	inlineStyles?: Record<string, string>
	computedStyles?: {
		width?: string
		height?: string
	}
}

export interface DimensionField {
	value: string
	fromInline: boolean
}

function parseDimensionUnit(value: string): string {
	if (!value || value === "auto") return "auto"
	const match = value.trim().match(/^(-?[\d.]+)(.*)$/)
	if (!match) return "px"
	return match[2] || "px"
}

function isExplicitNonPxUnit(unit: string): boolean {
	return Boolean(unit) && unit !== "px" && unit !== "auto"
}

/**
 * Keep a typed %/em/rem value when a later refresh only has computed px.
 * Inline px writes, such as a resize handle, must still replace the field.
 */
export function shouldKeepAuthoredDimension(
	authoredUnit: string,
	incomingValue: string,
	incomingFromInline = false,
): boolean {
	if (incomingFromInline) return false
	return isExplicitNonPxUnit(authoredUnit) && parseDimensionUnit(incomingValue) === "px"
}

/**
 * Read a used-pixel number from a computed style like "508px".
 */
export function parseUsedPixelValue(value: string | undefined): number | null {
	if (!value) return null
	const trimmed = value.trim()
	if (!trimmed || trimmed === "auto") return null
	if (!/^(-?[\d.]+)(px)?$/i.test(trimmed)) return null
	const parsed = Number.parseFloat(trimmed)
	return Number.isFinite(parsed) ? parsed : null
}

/** Round used px for inspector labels; keep other units as authored. */
export function formatUsedSizeLabel(value: string | undefined): string {
	const usedPixels = parseUsedPixelValue(value)
	if (usedPixels !== null) return `${Math.round(usedPixels)}px`
	const trimmed = value?.trim()
	return trimmed && trimmed !== "auto" ? trimmed : "auto"
}

/**
 * Start scrubbing from used px when the field still shows a non-px unit.
 */
export function resolveScrubStartValue(displayValue: string, pixelValue?: string): number | null {
	const displayUnit = parseDimensionUnit(displayValue)
	if (isExplicitNonPxUnit(displayUnit)) {
		const usedPixels = parseUsedPixelValue(pixelValue)
		if (usedPixels !== null) return usedPixels
	}

	const parsedDisplay = Number.parseFloat(displayValue)
	return Number.isFinite(parsedDisplay) ? parsedDisplay : null
}

/**
 * Prefer the authored unit so computed px values do not hide %/em/rem.
 */
export function getDimensionField(
	element: DimensionSource | null | undefined,
	property: "width" | "height",
): DimensionField {
	const inlineValue = element?.inlineStyles?.[property]?.trim()
	if (inlineValue) return { value: inlineValue, fromInline: true }
	return {
		value: element?.computedStyles?.[property] || "auto",
		fromInline: false,
	}
}

export function getDeclaredDimension(
	element: DimensionSource | null | undefined,
	property: "width" | "height",
): string {
	return getDimensionField(element, property).value
}
