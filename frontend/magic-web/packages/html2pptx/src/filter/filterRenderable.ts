import type { ElementNode } from "../types/index"
import { hasVisibleBackground, hasVisibleBorder } from "../utils/color"
import {
	hasDirectTextChild,
	isVisible,
	isTableChildElement,
} from "../utils/element"


/**
 * 判断元素是否有可绘制内容
 *
 */
function hasRenderableContent(node: ElementNode): boolean {
	const { style, tagName } = node
	if (tagName === "IMG") return true
	if (tagName === "I") return true
	if (tagName === "SVG") return true
	if (tagName === "TABLE") return true
	if (tagName === "VIDEO") return true
	if (tagName === "AUDIO") return true
	if (tagName === "CANVAS") return true

	if (style.backgroundImage && style.backgroundImage !== "none") return true
	if (hasVisibleBackground(style.backgroundColor)) return true
	if (hasVisibleBorder(style.borderStyle, style.borderWidth, style.borderColor)) return true
	if (hasDirectTextChild(node)) return true
	if (style.boxShadow && style.boxShadow !== "none") return true

	return false
}


/**
 * 过滤出需要绘制的元素
 *
 * 新方案下每个元素独立处理：
 * - 内联文本元素（SPAN, STRONG 等）不再被父元素"代理"，而是自行生成文本框
 * - 仅表格内部元素仍由 TABLE 统一处理
 */
export function filterRenderable(nodes: ElementNode[]): ElementNode[] {
	return nodes.filter((node) => {
		if (isTableChildElement(node)) return false
		return isVisible(node) && hasRenderableContent(node)
	})
}
