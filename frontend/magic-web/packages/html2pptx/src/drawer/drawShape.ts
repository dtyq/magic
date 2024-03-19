import type { PPTShapeNode, Slide } from "../types/index"
import { mapDashType } from "../utils/line"
import { inchToPt } from "../utils/unit"

/**
 * 绘制形状到幻灯片
 */
export function drawShape(slide: Slide, node: PPTShapeNode): void {
	const options: Record<string, unknown> = {
		x: node.x,
		y: node.y,
		w: node.w,
		h: node.h,
	}

	// 填充
	if (node.fill) {
		if (node.fill.type === "solid") {
			const fillOptions: Record<string, unknown> = { color: node.fill.color }
			if (node.fill.transparency !== undefined) {
				fillOptions.transparency = node.fill.transparency
			}
			options.fill = fillOptions
		} else if (node.fill.type === "gradient") {
			const stops = node.fill.stops.map((stop) => {
				const stopConfig: Record<string, unknown> = {
					position: Math.round(stop.position * 100),
					color: stop.color,
				}
				if (stop.transparency !== undefined) {
					stopConfig.transparency = stop.transparency
				}
				return stopConfig
			})

			if (node.fill.gradientType === "radial") {
				options.fill = {
					type: "radialGradient",
					style: node.fill.style || "ellipse",
					stops,
					rotWithShape: node.fill.rotWithShape ?? true,
					flip: node.fill.flip ?? "none",
					tileRect: node.fill.tileRect,
				}
			} else {
				options.fill = {
					type: "linearGradient",
					stops,
					angle: node.fill.angle ?? 0,
					scaled: node.fill.scaled ?? false,
					rotWithShape: node.fill.rotWithShape ?? false,
					flip: node.fill.flip ?? "none",
					tileRect: node.fill.tileRect,
				}
			}
		}
	} else {
		// 无填充时设置透明
		options.fill = { type: "none" }
	}

	// 边框
	if (node.line) {
		const lineOptions: Record<string, unknown> = {
			color: node.line.color,
			width: inchToPt(node.line.width),
			dashType: mapDashType(node.line.style),
		}
		if (node.line.transparency !== undefined) {
			lineOptions.transparency = node.line.transparency
		}
		options.line = lineOptions
	} else {
		// 无边框
		options.line = { type: "none" }
	}

	// 阴影
	if (node.shadow) {
		options.shadow = {
			type: node.shadow.type,
			color: node.shadow.color,
			blur: node.shadow.blur,
			offset: node.shadow.offset,
			angle: node.shadow.angle,
			opacity: node.shadow.opacity,
		}
	}

	// 圆角 - rectRadius 只对 roundRect 有效
	// pptxgenjs 源码：adj = (rectRadius * EMU * 100000) / min(cx, cy)
	// 这说明 rectRadius 应该是以英寸为单位的绝对值，pptxgenjs 内部会自动计算比例
	// 所以直接传入圆角半径（英寸）即可
	if (node.shapeType === "roundRect" && node.radius && node.radius > 0) {
		const minDimension = Math.min(node.w, node.h)
		if (minDimension > 0) {
			// 限制圆角不超过短边的一半（最大圆角）
			const maxRadius = minDimension / 2
			options.rectRadius = Math.min(node.radius, maxRadius)
		}
	}

	// custGeom 路径点
	if (node.shapeType === "custGeom" && node.points) {
		options.points = node.points
		options.line = options.line ?? { type: "none" }
	}

	// 柔化边缘 (模拟 CSS blur 效果)
	if (node.softEdge && node.softEdge > 0) {
		options.softEdge = { radius: node.softEdge }
	}

	// 旋转角度
	if (node.rotate) {
		options.rotate = node.rotate
	}
		
	const shapeName = (node.shapeType || "rect") as Parameters<typeof slide.addShape>[0]
	slide.addShape(shapeName, options)
}

