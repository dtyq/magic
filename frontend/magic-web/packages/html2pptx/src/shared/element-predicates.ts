import type { ElementNode, ComputedStyleInfo } from "../ir/dom"
import { hasVisibleBackground, isGradientBackground } from "./color"
import { extractCssImageUrls } from "./css-image-url"
import { splitByTopLevelComma } from "./string"

/** Elements inside tables, handled by the TABLE element */
const TABLE_CHILD_TAGS = ["THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "COLGROUP", "COL", "CAPTION"]

/**
 * Determine whether a TABLE is a layout table rather than a data table.
 * Layout tables are common in email HTML and use tables only for positioning, so they should not render as PPT table objects.
 *
 * Heuristic: treat as a layout table if any of the following are true:
 *   1. role="presentation" or role="none"
 *   2. no visible borders and contains nested TABLE descendants
 */
export function isLayoutTable(node: ElementNode): boolean {
	const el = node.element as HTMLTableElement
	if (el.tagName !== "TABLE") return false

	const role = el.getAttribute("role")
	if (role === "presentation" || role === "none") return true

	const style = node.style
	const hasBorder =
		(parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== "none") ||
		(parseFloat(style.borderRightWidth) > 0 && style.borderRightStyle !== "none") ||
		(parseFloat(style.borderBottomWidth) > 0 && style.borderBottomStyle !== "none") ||
		(parseFloat(style.borderLeftWidth) > 0 && style.borderLeftStyle !== "none")

	if (!hasBorder && el.querySelector(":scope > * > tr > td > table, :scope > tbody > tr > td > table, :scope > tr > td > table")) {
		return true
	}

	return false
}

/**
 * Determine whether parseShape may produce a node
 * Condition: background color, gradient background, or uniform borders on all sides; any one is enough
 */
export function hasShapeContent(node: ElementNode): boolean {
	const { style } = node
	const bgImage = style.backgroundImage
	const isTextClip = style.backgroundClip === "text"
	const hasFill = hasVisibleBackground(style.backgroundColor)
	const hasGradient = !isTextClip && isGradientBackground(bgImage)
	const hasBorder = hasUniformBorder(style)
	return hasFill || hasGradient || hasBorder
}

/**
 * Determine whether an element has direct text child nodes
 * Check the DOM structure directly, matching parseTextNodes traversal logic
 */
export function hasDirectTextChild(node: ElementNode): boolean {
	return Array.from(node.element.childNodes).some((child) => child.nodeType === Node.TEXT_NODE)
}


/**
 * Whether all four borders are identical
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
 * Determine whether the background contains multiple gradient values, separated by top-level commas
 * For example, two stacked linear-gradients used to draw grid lines
 * These backgrounds cannot be represented with native PPT gradients and need screenshot fallback
 */
export function hasMultipleGradientBackgrounds(bgImage: string): boolean {
	if (!bgImage || bgImage === "none") return false
	if (!bgImage.includes("gradient")) return false

	const parts = splitByTopLevelComma(bgImage)
	const gradientCount = parts.filter((p) => p.includes("gradient")).length
	return gradientCount > 1
}

/**
 * Determine whether there is a background image, excluding gradients handled by parseShape
 */
export function hasBackgroundImage(node: ElementNode): boolean {
	const bgImage = node.style.backgroundImage
	if (!bgImage || bgImage === "none") return false

	if (bgImage.includes("gradient")) return false

	return extractCssImageUrls(bgImage).length > 0
}

/**
 * Determine whether this is an image element
 */
export function isImageElement(node: ElementNode): boolean {
	return node.tagName === "IMG"
}

/**
 * Determine whether this is a table element
 */
export function isTableElement(node: ElementNode): boolean {
	return node.tagName === "TABLE"
}

/**
 * Determine whether this is a media element
 */
export function isMediaElement(node: ElementNode): boolean {
	return node.tagName === "VIDEO" || node.tagName === "AUDIO"
}

/**
 * Determine whether this element needs screenshot capture, such as Canvas or SVG
 */
export function isCanvasOrSvgElement(node: ElementNode): boolean {
	const tag = node.tagName.toUpperCase()
	return tag === "CANVAS" || tag === "SVG"
}


/**
 * Determine whether this is an element inside a table, handled by TABLE
 */
export function isTableChildElement(node: ElementNode): boolean {
	return TABLE_CHILD_TAGS.includes(node.tagName)
}

/**
 * Determine whether an element is inside a table cell, excluding TD/TH themselves and targeting descendants.
 * Text-like nodes would duplicate parseTable td.textContent if drawn separately;
 * IMG/SVG need separate drawing; see the allow-list logic in filterRenderable.
 */
export function isInsideTableCell(node: ElementNode): boolean {
	if (TABLE_CHILD_TAGS.includes(node.tagName) || node.tagName === "TABLE") return false
	return !!node.element.closest?.("td, th")
}

/**
 * Graphic nodes inside table cells that should be emitted separately by transform; parseTable exports only plain cell text
 */
export function isTableCellStandaloneGraphicElement(node: ElementNode): boolean {
	const t = node.tagName.toUpperCase()
	return t === "IMG" || t === "SVG"
}


/**
 * Determine whether an element is visible
 */
export function isVisible(node: ElementNode): boolean {
	const { style, rect, tagName } = node

	const allowsPartialSize = tagName === "VIDEO"

	if (allowsPartialSize) {
		if (rect.w <= 0 && rect.h <= 0) return false
	} else if (rect.w <= 0 || rect.h <= 0) return false

	if (style.display === "none") return false

	if (style.visibility === "hidden") return false

	if (parseFloat(style.opacity) === 0) return false

	return true
}
