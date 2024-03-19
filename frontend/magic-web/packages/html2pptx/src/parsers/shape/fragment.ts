import type { ElementNode, PPTFill } from "../../types/index"
import {
	colorToHex,
	getTransparency,
	hasVisibleBackground,
	isGradientBackground,
	parseGradient,
} from "../../utils/color"
import { hasUniformBorder } from "../../utils/element"

export function canUseFragmentedBackground(node: ElementNode): boolean {
	const { style } = node
	// 边框/阴影/滤镜/变换仍使用整块几何，避免分片后样式失真
	if (hasUniformBorder(style)) return false
	if (style.boxShadow && style.boxShadow !== "none") return false
	if (style.filter && style.filter !== "none") return false
	if (style.transform && style.transform !== "none") return false

	return true
}

export function resolveFragmentFill(style: ElementNode["style"]): PPTFill | null {
	const bgImage = style.backgroundImage
	const isTextClip = style.backgroundClip === "text"
	const hasGradient = !isTextClip && isGradientBackground(bgImage)
	const hasFill = hasVisibleBackground(style.backgroundColor)

	let fill: PPTFill | null = null
	if (hasGradient) {
		const gradient = parseGradient(bgImage)
		if (gradient) fill = gradient
	}

	if (!fill && hasFill) {
		let transparency = getTransparency(style.backgroundColor)
		if (transparency === 0) {
			const opacity = parseFloat(style.opacity)
			if (opacity < 1) transparency = Math.round((1 - opacity) * 100)
		}

		fill = {
			type: "solid" as const,
			color: colorToHex(style.backgroundColor),
			transparency,
		}
	}

	return fill
}
