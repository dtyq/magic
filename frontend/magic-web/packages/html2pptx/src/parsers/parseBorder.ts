import type { ElementNode, PPTNodeBase, SlideConfig, PPTBorderLineNode } from "../types/index"
import { log, LogLevel } from "../logger"
import { colorToHex, getTransparency } from "../utils/color"
import { hasUniformBorder } from "../utils/element"
import { pxToInch } from "../utils/unit"

/**
 * 映射边框样式
 */
export function mapBorderStyle(cssStyle: string): "solid" | "dashed" | "dotted" {
	if (cssStyle === "dashed") return "dashed"
	if (cssStyle === "dotted") return "dotted"
	return "solid"
}

/**
 * 解析单边边框（用线条模拟）
 * 只处理非一致的单边边框，四边一致的由 parseShape 处理
 * 返回最多 4 条线（对应 top/right/bottom/left）
 */
export function parseBorderLines(
	node: ElementNode,
	base: PPTNodeBase,
	config: SlideConfig,
): PPTBorderLineNode[] {
	const { style } = node

	if (hasUniformBorder(style)) {
		log(LogLevel.L1, "Uniform border detected, skipping (handled by parseShape)")
		return []
	}

	const lines: PPTBorderLineNode[] = []

	// 检查每条边的边框
	const borders = [
		{ side: "top" as const, width: style.borderTopWidth, color: style.borderTopColor, style: style.borderTopStyle },
		{ side: "right" as const, width: style.borderRightWidth, color: style.borderRightColor, style: style.borderRightStyle },
		{ side: "bottom" as const, width: style.borderBottomWidth, color: style.borderBottomColor, style: style.borderBottomStyle },
		{ side: "left" as const, width: style.borderLeftWidth, color: style.borderLeftColor, style: style.borderLeftStyle },
	]

	for (const border of borders) {
		const widthPx = parseFloat(border.width) || 0
		if (widthPx <= 0 || border.style === "none" || !border.color || border.color === "transparent") {
			continue
		}

		// 检查颜色是否可见
		const rgbaMatch = border.color.match(/rgba?\([\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)\)/)
		if (rgbaMatch && parseFloat(rgbaMatch[1]) <= 0) {
			continue
		}

		const borderTransparency = getTransparency(border.color)
		const borderLine = {
			...base,
			type: "borderLine" as const,
			side: border.side,
			line: {
				color: colorToHex(border.color),
				width: pxToInch(widthPx, config),
				style: mapBorderStyle(border.style),
				transparency: borderTransparency,
			},
		}
		lines.push(borderLine)
	}

	return lines
}
