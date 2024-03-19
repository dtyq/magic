import type { ComputedStyleInfo } from "../types/index"

/**
 * 解析 background-size 和 background-position
 * 返回相对于元素自身的像素坐标和尺寸 (x, y, w, h)
 */
export function parseBackgroundLayout(
	style: ComputedStyleInfo,
	elemW: number,
	elemH: number
): { x: number; y: number; w: number; h: number } | null {
	const { backgroundSize, backgroundPosition } = style
	if ((!backgroundSize || backgroundSize === "auto") && (!backgroundPosition || backgroundPosition === "0% 0%")) {
		return null
	}

	let w = elemW
	let h = elemH
	let x = 0
	let y = 0

	// 1. 解析 background-size
	// 支持: "100% 40%", "50px 50px", "cover", "contain", "auto"
	if (backgroundSize && backgroundSize !== "auto") {
		const parts = backgroundSize.split(" ")
		const wStr = parts[0]
		const hStr = parts[1] || "auto"

		if (wStr === "cover" || wStr === "contain") {
			// 暂不处理 cover/contain，保持原样
		} else {
			// 解析宽度
			if (wStr.endsWith("%")) {
				w = (parseFloat(wStr) / 100) * elemW
			} else if (wStr.endsWith("px")) {
				w = parseFloat(wStr)
			}
			
			// 解析高度
			if (hStr === "auto") {
				// 保持比例? 暂时简单处理为 elemH (如果 W 是 100%?)
				// 如果只给一个值，第二个默认 auto。通常图片会保持比例，但对于渐变/形状，auto 行为未定义很好
				// 用户案例是 "100% 40%"，所以主要关注这个
				h = elemH 
			} else if (hStr.endsWith("%")) {
				h = (parseFloat(hStr) / 100) * elemH
			} else if (hStr.endsWith("px")) {
				h = parseFloat(hStr)
			}
		}
	}

	// 2. 解析 background-position
	// 支持: "0 85%", "10px 20px", "center center"
	// 默认 "0% 0%"
	if (backgroundPosition) {
		const parts = backgroundPosition.split(" ")
		const xStr = parts[0] || "0%"
		const yStr = parts[1] || "50%" // 如果只有一个值，第二个默认 center (50%)

		// 解析 X
		if (xStr.endsWith("%")) {
			const percent = parseFloat(xStr) / 100
			x = (elemW - w) * percent
		} else if (xStr.endsWith("px")) {
			x = parseFloat(xStr)
		} else if (xStr === "left") {
			x = 0
		} else if (xStr === "right") {
			x = elemW - w
		} else if (xStr === "center") {
			x = (elemW - w) / 2
		}

		// 解析 Y
		if (yStr.endsWith("%")) {
			const percent = parseFloat(yStr) / 100
			y = (elemH - h) * percent
		} else if (yStr.endsWith("px")) {
			y = parseFloat(yStr)
		} else if (yStr === "top") {
			y = 0
		} else if (yStr === "bottom") {
			y = elemH - h
		} else if (yStr === "center") {
			y = (elemH - h) / 2
		}
	}

	// 如果解析结果与原尺寸一致，返回 null 表示无需特殊处理
	if (Math.abs(w - elemW) < 0.1 && Math.abs(h - elemH) < 0.1 && Math.abs(x) < 0.1 && Math.abs(y) < 0.1) {
		return null
	}

	return { x, y, w, h }
}
