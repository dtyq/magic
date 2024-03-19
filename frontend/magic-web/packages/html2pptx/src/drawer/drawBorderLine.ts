import type { PPTBorderLineNode, Slide } from "../types/index"
import { log, LogLevel } from "../logger"
import { mapDashType } from "../utils/line"
import { inchToPt } from "../utils/unit"

/**
 * 绘制单边边框（用线条模拟）
 */
export function drawBorderLine(
	slide: Slide,
	node: PPTBorderLineNode,
): void {
	const { x, y, w, h, side, line } = node

	// 根据边框位置计算线条的起点和终点
	let x1: number, y1: number, x2: number, y2: number

	switch (side) {
		case "top":
			// 顶部边框：从左上到右上
			x1 = x
			y1 = y
			x2 = x + w
			y2 = y
			break
		case "right":
			// 右边框：从右上到右下
			x1 = x + w
			y1 = y
			x2 = x + w
			y2 = y + h
			break
		case "bottom":
			// 底部边框：从左下到右下
			x1 = x
			y1 = y + h
			x2 = x + w
			y2 = y + h
			break
		case "left":
			// 左边框：从左上到左下
			x1 = x
			y1 = y
			x2 = x
			y2 = y + h
			break
	}

	// 计算线条的宽度和高度
	const lineW = x2 - x1
	const lineH = y2 - y1
	
	// 对于水平线或垂直线，确保至少有一个维度不为 0
	// 如果两个维度都是 0，则是一个点，不需要绘制
	if (lineW === 0 && lineH === 0) {
		log(LogLevel.L3, "Skipping zero-length line")
		return
	}

	// 绘制线条
	const lineOptions: Record<string, unknown> = {
		x: x1,
		y: y1,
		w: Math.abs(lineW),
		h: Math.abs(lineH),
		line: {
			color: line.color,
			width: inchToPt(line.width),
			dashType: mapDashType(line.style),
		},
	}
	if (line.transparency !== undefined) {
		;(lineOptions.line as Record<string, unknown>).transparency = line.transparency
	}
	slide.addShape("line", lineOptions)
}

