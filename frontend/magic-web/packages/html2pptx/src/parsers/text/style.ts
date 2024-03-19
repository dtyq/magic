import type { ElementNode, PPTTextGradient, PPTShadow } from "../../types/index"
import {
	colorToHex,
	getTransparency,
	getEffectiveOpacity,
	parseGradient,
	mergeGradientStopsWithElementOpacity,
} from "../../utils/color"
import { parseShadow } from "../parseShadow"
import { PX_TO_PT_RATIO } from "../../utils/constants"
import {
	mapFontFamily,
	parseBold,
	parseLetterSpacing,
	parseLineSpacing,
} from "../../utils/text"
import { pxToPt } from "../../utils/unit"

/** 从元素计算样式中提取的文本样式 */
export interface TextStyle {
	fontSize: number
	fontFace: string
	color: string | PPTTextGradient
	bold: boolean
	italic: boolean
	underline: boolean
	/** 删除线 (text-decoration: line-through) */
	strike?: boolean
	align?: "left" | "center" | "right" | "justify"
	valign?: "top" | "middle" | "bottom"
	transparency?: number
	charSpacing?: number // 字间距 (pt)
	lineSpacing?: number // 行间距 (倍数)
	shadow?: PPTShadow | null
	margin: [number, number, number, number] // 外边距 (pt)
	outline?: {
		color: string
		size: number
		transparency?: number
	}
}

export function resolveTextStyle(node: ElementNode, scale: number): TextStyle {
	const { style, tagName } = node

	const fontSize = Math.max(1, Math.floor(style.fontSize * scale * PX_TO_PT_RATIO))
	const isBold = parseBold(style.fontWeight, tagName)
	const isItalic = style.fontStyle === "italic"
	const isUnderline = style.textDecoration.includes("underline")
	const isStrike = style.textDecoration.includes("line-through")
	const charSpacing = parseLetterSpacing(style.letterSpacing, style.fontSize, scale)
	const lineSpacing = parseLineSpacing(style.lineHeight, style.fontSize)

	let color: string | PPTTextGradient = colorToHex(style.color)
	let colorTransparency = getTransparency(style.color)
	let shouldApplyNodeTransparency = true
	const elementOpacity = getEffectiveOpacity(node.element)

	if (
		style.backgroundImage &&
		style.backgroundImage.includes("gradient") &&
		style.backgroundClip === "text"
	) {
		const gradient = parseGradient(style.backgroundImage)
		if (gradient) {
			color = mergeGradientStopsWithElementOpacity(gradient, elementOpacity)
			colorTransparency = 0
			shouldApplyNodeTransparency = false
		}
	}

	let transparency = colorTransparency

	if (shouldApplyNodeTransparency && transparency === 0 && elementOpacity < 1) {
		transparency = Math.round((1 - elementOpacity) * 100)
	}

	const shadow = parseShadow(style.textShadow)

	let outline = undefined
	const strokeWidth = style.webkitTextStrokeWidth
	const strokeColor = style.webkitTextStrokeColor
	const strokeComposite = style.webkitTextStroke

	let sizePx = 0
	let colorStr = ""

	if (strokeWidth && strokeWidth !== "0px") {
		sizePx = parseFloat(strokeWidth)
		colorStr = strokeColor || "currentcolor"
	} else if (strokeComposite && strokeComposite !== "0px" && strokeComposite !== "none") {
		const parts = strokeComposite.match(/^([\d.]+)px\s+(.+)$/)
		if (parts) {
			sizePx = parseFloat(parts[1])
			colorStr = parts[2]
		}
	}

	if (sizePx > 0 && colorStr) {
		const finalColor = colorToHex(colorStr)
		let outlineTransparency = getTransparency(colorStr)
		if (outlineTransparency === 0 && elementOpacity < 1) {
			outlineTransparency = Math.round((1 - elementOpacity) * 100)
		}
		outline = {
			color: finalColor,
			size: pxToPt(sizePx * scale),
			transparency: outlineTransparency,
		}
	}

	return {
		fontSize,
		fontFace: mapFontFamily(style.fontFamily),
		color,
		bold: isBold,
		italic: isItalic,
		underline: isUnderline,
		strike: isStrike,
		transparency,
		charSpacing,
		lineSpacing,
		shadow,
		margin: [0, 0, 0, 0],
		outline,
	}
}
