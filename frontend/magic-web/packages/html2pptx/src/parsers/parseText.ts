import type { ElementNode, PPTTextNode, PPTNodeBase, SlideConfig } from "../types/index"
import { log, LogLevel } from "../logger"
import { pxToInch, getGlobalTransform } from "../utils/unit"
import {
	DEFAULT_DPI,
	TEXT_SAFETY_MARGIN_X,
	TEXT_SAFETY_MARGIN_Y,
} from "../utils/constants"
import {
	transformText,
	normalizeTextByWhiteSpace,
	hasRenderableText,
} from "../utils/text"
import { splitTextNodeByVisualLines } from "./text/layout"
import {
	resolveTextStyle,
} from "./text/style"
export type { TextStyle } from "./text/style"

/**
 * 解析元素的直接文本节点，每个 DOM Text Node 生成一个独立的 PPT 文本框
 *
 * 设计原则：
 * - 一个 DOM Text Node = 一个 PPT 文本框
 * - 样式继承自文本节点的父元素（即当前 node），CSS 继承机制保证样式正确
 * - 位置通过 Range API 精确测量每个文本节点的实际渲染区域
 */
export function parseTextNodes(
	node: ElementNode,
	base: PPTNodeBase,
	config: SlideConfig,
): PPTTextNode[] {
	const { element, style } = node
	if (!element) return []
	const results: PPTTextNode[] = []
	const doc = element.ownerDocument
	const scale = config.slideWidth / (config.htmlWidth / DEFAULT_DPI)
	const whiteSpace = style.whiteSpace || "normal"

	// 预计算当前元素的文本样式（所有直接文本节点共享同一套样式）
	// 完全依赖 x,y 物理坐标定位
	const textStyle = resolveTextStyle(node, scale)

	// 遍历直接子节点，只处理 Text Node
	for (const childNode of Array.from(element.childNodes)) {
		if (childNode.nodeType !== Node.TEXT_NODE) continue

		// 使用 Range API 精确测量文本节点的渲染位置
		try {
			const visualLines = splitTextNodeByVisualLines({
				doc,
				textNode: childNode as Text,
			})
			if (visualLines.length === 0) continue

			// 获取全局变换 (处理父级旋转/缩放)
			const { rotation, scaleX } = getGlobalTransform(node)
			const transformScale = scaleX
			const rotateAngle = rotation

			// 修正字号
			const finalFontSize =
				transformScale !== 1
					? Math.round(textStyle.fontSize * transformScale)
					: textStyle.fontSize

			for (const line of visualLines) {
				let text = normalizeTextByWhiteSpace({
					text: line.text,
					whiteSpace,
				})
				if (!hasRenderableText({ text, whiteSpace })) continue

				text = transformText(text, style.textTransform)

				// 如果有字间距，需要增加额外的宽度冗余，防止 PPT 渲染时因精度问题导致意外换行
				const spacingBuffer = textStyle.charSpacing
					? textStyle.charSpacing * text.length * 0.5
					: 0

				// 按视觉行拆分后，每个片段都按单行处理，避免 line-height 重复作用
				let x = line.rect.left
				let y = line.rect.top
				let w = Math.max(
					0,
					line.rect.right - line.rect.left + TEXT_SAFETY_MARGIN_X * 2 + spacingBuffer,
				)
				let h = Math.max(
					0,
					line.rect.bottom - line.rect.top + TEXT_SAFETY_MARGIN_Y * 2,
				)

				if (Math.abs(rotateAngle) === 90 || Math.abs(rotateAngle) === 270) {
					const cx = x + w / 2
					const cy = y + h / 2
					const temp = w
					w = h
					h = temp
					x = cx - w / 2
					y = cy - h / 2
				}

				const textBase: PPTNodeBase = {
					...base,
					x: pxToInch(x, config),
					y: pxToInch(y, config),
					w: pxToInch(w, config),
					h: pxToInch(h, config),
				}

				if (textBase.w <= 0 || textBase.h <= 0) continue

				const wrap = false
				results.push({
					...textBase,
					type: "text",
					text,
					...textStyle,
					lineSpacing: undefined,
					fontSize: finalFontSize,
					rotate: rotateAngle !== 0 ? rotateAngle : undefined,
					wrap,
				})
			}
		} catch {
			// Range API 异常时跳过该文本节点
				log(LogLevel.L4, "Range API 异常", { textContent: childNode.textContent })
		}
	}

	return results
}
