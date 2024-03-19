import type { PPTTextNode, Slide } from "../types/index"

/** 下划线样式类型 */
type UnderlineStyle = "sng" | "dbl" | "dash" | "dotted" | "none"

/**
 * 绘制文本到幻灯片
 * 每个 PPTTextNode 对应一个独立的纯文本框
 */
export function drawText(slide: Slide, node: PPTTextNode): void {
	const {
		text,
		x,
		y,
		w,
		h,
		fontSize,
		fontFace,
		color,
		bold,
		italic,
		underline,
		strike,
		transparency,
		charSpacing,
		lineSpacing,
		margin,
		rotate,
		outline,
	} = node

	const options: Record<string, unknown> = {
		x,
		y,
		w,
		h,
		fontSize,
		fontFace,
		bold,
		italic,
		underline: underline ? { style: "sng" as UnderlineStyle } : undefined,
		strike: strike ? true : undefined,
		charSpacing, // 应用字间距
		lineSpacingMultiple: lineSpacing ?? undefined, // 单行文本禁用，避免 line-height 二次生效
		margin: margin ?? [0, 0, 0, 0],
		wrap: node.wrap ?? true,
		rotate: rotate, // 应用旋转角度
		outline, // 应用文本描边
	}

	// 颜色处理
	if (typeof color !== "string" && color.type === "gradient") {
		const stops = color.stops.map((s) => ({
			position: Math.round(s.position * 100),
			color: s.color,
			transparency: s.transparency,
		}))

		if (color.gradientType === "radial") {
			options.color = {
				type: "radialGradient",
				style: color.style || "ellipse",
				stops,
				rotWithShape: color.rotWithShape ?? true,
				flip: color.flip ?? "none",
				tileRect: color.tileRect,
			}
		} else {
			options.color = {
				type: "linearGradient",
				angle: color.angle ?? 0,
				stops,
				scaled: color.scaled ?? false,
				rotWithShape: color.rotWithShape ?? false,
				flip: color.flip ?? "none",
				tileRect: color.tileRect,
			}
		}
	} else {
		options.color = color
	}

	// 透明度
	if (transparency && transparency > 0) {
		options.transparency = transparency
	}
	
	slide.addText(text, options)
}
