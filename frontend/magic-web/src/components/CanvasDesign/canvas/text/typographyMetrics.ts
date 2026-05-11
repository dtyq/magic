/**
 * 字号、字距、段间距等排版数值统一使用的小数位数。
 * Transformer 缩放与工具栏（如 RichTextFontSize）输入展示共用此配置。
 */
export const TYPOGRAPHY_DECIMAL_PLACES = 1

export function roundTypographyMetric(
	value: number,
	places: number = TYPOGRAPHY_DECIMAL_PLACES,
): number {
	if (!Number.isFinite(value)) {
		return value
	}
	return Number(value.toFixed(places))
}

/**
 * 用于输入框展示：按配置四舍五入后去掉无意义的尾随 0（如 16.0 → "16"）。
 */
export function formatTypographyMetricForInput(
	value: number,
	places: number = TYPOGRAPHY_DECIMAL_PLACES,
): string {
	const rounded = roundTypographyMetric(value, places)
	if (places <= 0) {
		return String(Math.round(rounded))
	}
	const fixed = rounded.toFixed(places)
	return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed
}

/**
 * 字号输入草稿：仅保留数字与至多一个小数点，小数位不超过 `maxDecimalDigits`。
 */
export function sanitizeTypographyDecimalInput(
	raw: string,
	maxDecimalDigits: number = TYPOGRAPHY_DECIMAL_PLACES,
): string {
	const cleaned = raw.replace(/[^\d.]/g, "")
	let out = ""
	let seenDot = false
	let decimals = 0
	for (const ch of cleaned) {
		if (ch === ".") {
			if (!seenDot) {
				seenDot = true
				out += "."
			}
			continue
		}
		if (seenDot) {
			if (decimals >= maxDecimalDigits) {
				continue
			}
			decimals++
		}
		out += ch
	}
	return out
}
