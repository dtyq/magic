import type { ElementNode, PPTNode, PPTNodeBase, SlideConfig } from "../types/index"
import { pxToInch } from "../utils/unit"
import {
	hasBackgroundImage,
	hasMultipleGradientBackgrounds,
	isImageElement,
	isTableElement,
	isMediaElement,
	isCanvasOrSvgElement,
	hasShapeContent,
} from "../utils/element"
import { calculateZOrder } from "../filter/sortByZOrder"
import {
	parseShape,
	parseFragmentedShapeNodes,
	parseBorderLines,
	parseImage,
	parseTextNodes,
	parseTable,
	parseMedia,
} from "../parsers"

/**
 * 将 ElementNode 转换为 PPTNode 数组
 * 一个 DOM 元素可能产生多个绘制节点（如背景图 + 背景色 + 文本）
 */
export function elementToNode(
	node: ElementNode,
	config: SlideConfig,
	iWindow: Window,
): PPTNode[] {
	const nodes: PPTNode[] = []
	const { rect, element } = node

	const base: PPTNodeBase = {
		type: "",
		x: pxToInch(rect.x, config),
		y: pxToInch(rect.y, config),
		w: pxToInch(rect.w, config),
		h: pxToInch(rect.h, config),
		zOrder: calculateZOrder(node),
	}

	// 1. 处理 IMG 标签
	if (isImageElement(node)) {
		const imageNode = parseImage(node, base, config, iWindow)
		if (imageNode) nodes.push(imageNode)
	}

	// 1.5 处理 TABLE 标签
	if (isTableElement(node)) {
		const tableNode = parseTable(node, base, config, iWindow)
		if (tableNode) nodes.push(tableNode)
	}

	// 1.6 处理媒体元素 (VIDEO, AUDIO)
	if (isMediaElement(node)) {
		const mediaNode = parseMedia(node, base, config, iWindow)
		if (mediaNode) nodes.push(mediaNode)
	}

	// 1.7 处理 Canvas/SVG 元素 - 使用截图方式
	if (isCanvasOrSvgElement(node)) {
		nodes.push({
			...base,
			type: "image",
			src: "",
			sizing: "stretch",
			capture: "snapdom",
			captureElement: element,
		})
	}

	// 2. 处理背景图 (优先级最高，在底层)
	const isMultiGradientBg = hasMultipleGradientBackgrounds(node.style.backgroundImage)

	if (isMultiGradientBg) {
		// 多值渐变背景（如网格线叠加效果）无法用 PPT 原生渐变还原
		// 降级：仅截取元素 CSS 背景（不含子元素），保留视觉效果
		nodes.push({
			...base,
			zOrder: base.zOrder - 1,
			type: "image",
			src: "",
			sizing: "stretch",
			capture: "snapdom",
			captureElement: element,
			captureBackgroundOnly: true,
		})
	} else if (hasBackgroundImage(node)) {
		const bgImageNode = parseImage(node, { ...base, zOrder: base.zOrder - 1 }, config, iWindow)
		if (bgImageNode) nodes.push(bgImageNode)
	}

	// 3. 处理形状 (背景色、边框、圆角)
	if (hasShapeContent(node)) {
		const shapeBase = isImageElement(node) ? { ...base, zOrder: base.zOrder - 1 } : base
		const fragmentedShapeNodes = isMultiGradientBg ? [] : parseFragmentedShapeNodes(node, shapeBase, config)
		if (fragmentedShapeNodes.length > 0) {
			nodes.push(...fragmentedShapeNodes)
		} else {
			const shapeNode = parseShape(node, shapeBase, config, { skipGradient: isMultiGradientBg })
			if (shapeNode) nodes.push(shapeNode)
		}
	}

	// 3.05 处理单边边框（用线条模拟）
	const borderLines = parseBorderLines(node, base, config)
	if (borderLines.length > 0) nodes.push(...borderLines)

	// 4. 处理文本：每个直接文本节点生成一个独立文本框
	const textNodes = parseTextNodes(node, { ...base, zOrder: base.zOrder + 1 }, config)
	if (textNodes.length > 0) nodes.push(...textNodes)

	return nodes
}

/**
 * 批量转换元素
 */
export function transformElements(
	elements: ElementNode[],
	config: SlideConfig,
	iWindow: Window,
): PPTNode[] {
	const allNodes: PPTNode[] = []

	for (const el of elements) {
		const nodes = elementToNode(el, config, iWindow)
		allNodes.push(...nodes)
	}

	return allNodes.sort((a, b) => a.zOrder - b.zOrder)
}
