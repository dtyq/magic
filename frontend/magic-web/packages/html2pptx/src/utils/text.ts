import { PX_TO_PT_RATIO, FONT_MAPPING } from "./constants"

/**
 * 解析 line-height 并转换为 PPT 的 lineSpacing (倍数)
 * PPT 默认单倍行距是 1.0，CSS normal 约为 1.2
 */
export function parseLineSpacing(lineHeight: string, fontSizePx: number): number | undefined {
	if (!lineHeight || lineHeight === "normal") return undefined // 使用默认值

	// 尝试解析纯数字倍数
	const unitless = Number(lineHeight)
	if (!Number.isNaN(unitless)) {
		// PPT 的行距倍数 = CSS 倍数 / 1.2 (大致)
		// 或者直接使用点数设置？pptxgenjs 支持 lineSpacing: 18 (pt) 或 lineSpacingMultiple: 1.5
		// 这里我们统一转换为倍数
		return parseFloat(unitless.toFixed(2))
	}

	const match = lineHeight.match(/([\d.]+)(px|em|rem|%)/)
	if (!match) return undefined

	const value = parseFloat(match[1])
	const unit = match[2]

	let lineHeightPx = value
	if (unit === "em" || unit === "rem") {
		lineHeightPx = value * fontSizePx
	} else if (unit === "%") {
		lineHeightPx = (value / 100) * fontSizePx
	}

	// 转换为倍数: 行高像素 / 字号像素
	if (fontSizePx <= 0) return undefined
	const multiple = lineHeightPx / fontSizePx
	return parseFloat(multiple.toFixed(2))
}

/**
 * 解析 letter-spacing 并转换为 PPT 的 charSpacing (pt)
 * PPT charSpacing 单位是 points
 */
export function parseLetterSpacing(
	letterSpacing: string,
	fontSizePx: number,
	scale: number,
): number | undefined {
	if (!letterSpacing || letterSpacing === "normal") return undefined

	// letter-spacing 可能是 "0.5em", "2px" 等
	let pxValue = 0

	if (letterSpacing.endsWith("em")) {
		pxValue = parseFloat(letterSpacing) * fontSizePx
	} else if (letterSpacing.endsWith("rem")) {
		// 简单起见，假设 root font size 为 16px
		pxValue = parseFloat(letterSpacing) * 16
	} else {
		// 默认为 px
		pxValue = parseFloat(letterSpacing)
	}

	if (Number.isNaN(pxValue) || pxValue === 0) return undefined

	// 转换为 pt (1px = 0.75pt) 并应用缩放
	// 注意：PPT 的 charSpacing 似乎对缩放非常敏感，可能需要调整系数
	return Math.round(pxValue * scale * PX_TO_PT_RATIO)
}

/**
 * 解析是否粗体
 */
export function parseBold(fontWeight: string, tagName: string): boolean {
	// 标题和语义化粗体标签默认粗体
	if (["H1", "H2", "H3", "H4", "H5", "H6", "STRONG", "B"].includes(tagName)) return true

	if (fontWeight === "bold" || fontWeight === "bolder") return true

	const weight = parseInt(fontWeight)
	return weight >= 600
}

/**
 * 字体映射 (Web 字体 → 系统字体)
 */
export function mapFontFamily(fontFamily: string): string {
	const normalized = fontFamily.replace(/['"]/g, "").trim()
	return FONT_MAPPING[normalized] || normalized || "Arial"
}

export function parseLineHeightPx(lineHeight: string, fontSize: number): number {
	if (!lineHeight || lineHeight === "normal") return fontSize * 1.2

	const unitless = Number(lineHeight)
	if (!Number.isNaN(unitless)) return unitless * fontSize

	const match = lineHeight.match(/([\d.]+)(px|em|rem)?/)
	if (!match) return fontSize * 1.2

	const value = parseFloat(match[1])
	const unit = match[2] || "px"
	if (unit === "px") return value
	if (unit === "em" || unit === "rem") return value * fontSize
	return fontSize * 1.2
}

/**
 * 根据 text-transform 属性转换文本
 */
export function transformText(text: string, textTransform: string): string {
	if (!text) return text

	if (textTransform === "uppercase") {
		return text.toUpperCase()
	}
	if (textTransform === "lowercase") {
		return text.toLowerCase()
	}
	if (textTransform === "capitalize") {
		return text.replace(/\b\w/g, (c) => c.toUpperCase())
	}

	return text
}

export function normalizeTextByWhiteSpace(input: {
	text: string
	whiteSpace: string
}): string {
	const { text, whiteSpace } = input
	const mode = whiteSpace.toLowerCase()

	if (mode === "pre" || mode === "pre-wrap" || mode === "break-spaces")
		return text
	if (mode === "pre-line")
		return text.replace(/[ \t\f\v]+/g, " ").trim()
	return text.replace(/\s+/g, " ").trim()
}

export function hasRenderableText(input: {
	text: string
	whiteSpace: string
}): boolean {
	const { text, whiteSpace } = input
	const mode = whiteSpace.toLowerCase()
	if (mode === "pre" || mode === "pre-wrap" || mode === "break-spaces")
		return text.length > 0
	return text.trim().length > 0
}
