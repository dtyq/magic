import type { ElementNode, ComputedStyleInfo } from "../types/index"
import { hasVisibleBackground, isGradientBackground } from "./color"
import { splitByTopLevelComma } from "./string"

/** 表格内部元素（由 TABLE 元素统一处理） */
const TABLE_CHILD_TAGS = ["THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "COLGROUP", "COL", "CAPTION"]

/**
 * 判断 parseShape 是否可能产出节点
 * 条件：有背景色、或渐变背景、或四边一致边框（任一满足即可）
 */
export function hasShapeContent(node: ElementNode): boolean {
	const { style } = node
	const bgImage = style.backgroundImage
	// 排除 url() 背景图（由 parseImage 处理）
	if (bgImage && bgImage !== "none" && bgImage.includes("url(") && !bgImage.includes("gradient")) {
		return false
	}
	const isTextClip = style.backgroundClip === "text"
	const hasFill = hasVisibleBackground(style.backgroundColor)
	const hasGradient = !isTextClip && isGradientBackground(bgImage)
	const hasBorder = hasUniformBorder(style)
	return hasFill || hasGradient || hasBorder
}

/**
 * 判断元素是否有直接文本子节点（直属 Text Node）
 * 直接检查 DOM 结构，与 parseTextNodes 的遍历逻辑一致
 */
export function hasDirectTextChild(node: ElementNode): boolean {
	return Array.from(node.element.childNodes).some((child) => child.nodeType === Node.TEXT_NODE)
}


/**
 * 四边边框是否完全一致
 */
export function hasUniformBorder(style: ComputedStyleInfo): boolean {
	const topWidth = parseFloat(style.borderTopWidth) || 0
	const rightWidth = parseFloat(style.borderRightWidth) || 0
	const bottomWidth = parseFloat(style.borderBottomWidth) || 0
	const leftWidth = parseFloat(style.borderLeftWidth) || 0

	if (topWidth !== rightWidth || rightWidth !== bottomWidth || bottomWidth !== leftWidth) return false
	if (topWidth <= 0) return false

	if (
		style.borderTopStyle !== style.borderRightStyle ||
		style.borderRightStyle !== style.borderBottomStyle ||
		style.borderBottomStyle !== style.borderLeftStyle
	) {
		return false
	}
	if (style.borderTopStyle === "none") return false

	if (
		style.borderTopColor !== style.borderRightColor ||
		style.borderRightColor !== style.borderBottomColor ||
		style.borderBottomColor !== style.borderLeftColor
	) {
		return false
	}
	if (!style.borderTopColor || style.borderTopColor === "transparent") return false

	const rgbaMatch = style.borderTopColor.match(/rgba?\([\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)\)/)
	if (rgbaMatch && parseFloat(rgbaMatch[1]) <= 0) return false

	return true
}

/**
 * 判断背景是否包含多个渐变值（逗号分隔的顶层渐变函数）
 * 例如：两个 linear-gradient 叠加实现网格线效果
 * 这类背景无法用 PPT 原生渐变还原，需要截图降级
 */
export function hasMultipleGradientBackgrounds(bgImage: string): boolean {
	if (!bgImage || bgImage === "none") return false
	if (!bgImage.includes("gradient")) return false

	const parts = splitByTopLevelComma(bgImage)
	const gradientCount = parts.filter((p) => p.includes("gradient")).length
	return gradientCount > 1
}

/**
 * 判断是否有背景图 (排除渐变，渐变由 parseShape 处理)
 */
export function hasBackgroundImage(node: ElementNode): boolean {
	const bgImage = node.style.backgroundImage
	if (!bgImage || bgImage === "none") return false

	// 排除渐变背景（linear-gradient, radial-gradient 等）
	// 渐变由 parseShape 处理
	if (bgImage.includes("gradient")) return false

	// 只处理 url() 形式的背景图
	return bgImage.includes("url(")
}

/**
 * 判断是否是图片元素
 */
export function isImageElement(node: ElementNode): boolean {
	return node.tagName === "IMG"
}

/**
 * 判断是否是表格元素
 */
export function isTableElement(node: ElementNode): boolean {
	return node.tagName === "TABLE"
}

/**
 * 判断是否是媒体元素
 */
export function isMediaElement(node: ElementNode): boolean {
	return node.tagName === "VIDEO" || node.tagName === "AUDIO"
}

/**
 * 判断是否是需要截图的元素（Canvas、SVG）
 */
export function isCanvasOrSvgElement(node: ElementNode): boolean {
	const tag = node.tagName.toUpperCase()
	return tag === "CANVAS" || tag === "SVG"
}


/**
 * 判断是否是表格内部元素（由 TABLE 统一处理）
 */
export function isTableChildElement(node: ElementNode): boolean {
	return TABLE_CHILD_TAGS.includes(node.tagName)
}

/**
 * 判断元素是否可见
 */
export function isVisible(node: ElementNode): boolean {
	const { style, rect } = node

	// 尺寸为 0
	if (rect.w <= 0 || rect.h <= 0) return false

	// display: none
	if (style.display === "none") return false

	// visibility: hidden
	if (style.visibility === "hidden") return false

	// 完全透明
	if (parseFloat(style.opacity) === 0) return false

	return true
}
