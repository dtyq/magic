function formatMetricValue(value: number): string {
	return String(Number(value.toFixed(4)))
}

const LINE_HEIGHT_KEYWORDS = new Set([
	"normal",
	"inherit",
	"initial",
	"unset",
	"revert",
	"revert-layer",
])

export function getAuthoredLineHeight(inlineStyles?: Record<string, string>): string | undefined {
	const value = inlineStyles?.lineHeight?.trim() || inlineStyles?.["line-height"]?.trim()
	if (!value) return undefined
	return value.replace(/\s*!important$/i, "").trim() || undefined
}

/**
 * Show the specified line-height. Used pixels are not a fixed px setting.
 */
export function resolveDisplayLineHeight(computed?: string, authored?: string | null): string {
	const specified = authored?.trim() ?? ""
	if (specified) {
		const token = normalizeLineHeightToken(specified)
		if (!token || LINE_HEIGHT_KEYWORDS.has(token)) return "normal"
		return specified
	}

	const computedValue = (computed ?? "").trim()
	if (!computedValue || LINE_HEIGHT_KEYWORDS.has(normalizeLineHeightToken(computedValue))) {
		return "normal"
	}

	const parsed = splitNumericLineHeight(computedValue)
	if (parsed?.unit.toLowerCase() === "px") return "normal"
	return computedValue
}

export function splitNumericLineHeight(value: string): { number: string; unit: string } | null {
	const match = value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(.*)$/)
	if (!match) return null
	return { number: match[1], unit: match[2] }
}

// Only unitless and pixel values have a deterministic conversion from the
// selected element's font size; preserving other units avoids showing a false value.
export function getEquivalentLineHeight(value: string, fontSize?: string): string | null {
	if (!fontSize) return null

	const parsedLineHeight = splitNumericLineHeight(value)
	const parsedFontSize = splitNumericLineHeight(fontSize)
	if (!parsedLineHeight || !parsedFontSize) return null

	const lineHeightValue = Number.parseFloat(parsedLineHeight.number)
	const fontSizeValue = Number.parseFloat(parsedFontSize.number)
	const lineHeightUnit = parsedLineHeight.unit.toLowerCase()
	const fontSizeUnit = parsedFontSize.unit.toLowerCase()
	if (
		!Number.isFinite(lineHeightValue) ||
		lineHeightValue < 0 ||
		!Number.isFinite(fontSizeValue) ||
		fontSizeValue <= 0 ||
		(fontSizeUnit && fontSizeUnit !== "px")
	) {
		return null
	}

	if (!lineHeightUnit) {
		return `${formatMetricValue(lineHeightValue * fontSizeValue)}px`
	}
	if (lineHeightUnit === "px") {
		return formatMetricValue(lineHeightValue / fontSizeValue)
	}
	return null
}

function normalizeLineHeightToken(value: string): string {
	return value.trim().toLowerCase()
}

function parseLineHeightNumber(value: string): { amount: number; unit: string } | null {
	const parsed = splitNumericLineHeight(value)
	if (!parsed) return null
	const amount = Number.parseFloat(parsed.number)
	if (!Number.isFinite(amount)) return null
	return { amount, unit: parsed.unit.trim().toLowerCase() }
}

function valuesAreClose(left: number, right: number): boolean {
	return (
		Math.abs(left - right) <= Math.max(0.05, Math.max(Math.abs(left), Math.abs(right)) * 0.005)
	)
}

function tokensAreClose(left: string, right: string): boolean {
	if (normalizeLineHeightToken(left) === normalizeLineHeightToken(right)) return true
	const parsedLeft = parseLineHeightNumber(left)
	const parsedRight = parseLineHeightNumber(right)
	if (!parsedLeft || !parsedRight || parsedLeft.unit !== parsedRight.unit) return false
	return valuesAreClose(parsedLeft.amount, parsedRight.amount)
}

/** True when a user-facing line-height still matches the latest computed style. */
export function areLineHeightsEquivalent(
	displayValue: string,
	computedValue: string,
	fontSize?: string,
): boolean {
	const display = normalizeLineHeightToken(displayValue)
	const computed = normalizeLineHeightToken(computedValue)
	if (!display || !computed) return false
	if (tokensAreClose(display, computed)) return true

	const displayEquivalent = getEquivalentLineHeight(display, fontSize)
	if (displayEquivalent && tokensAreClose(displayEquivalent, computed)) return true
	const computedEquivalent = getEquivalentLineHeight(computed, fontSize)
	return Boolean(computedEquivalent && tokensAreClose(computedEquivalent, display))
}
