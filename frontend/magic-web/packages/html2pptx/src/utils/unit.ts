import type { SlideConfig, ElementNode } from "../types/index"
import { log, LogLevel } from "../logger"


/** 标准 DPI: 1英寸 = 96像素 */
const PX_PER_INCH = 96

/** 默认配置 */
export const DEFAULT_CONFIG: SlideConfig = {
	htmlWidth: 1920,
	htmlHeight: 1080,
	slideWidth: 1920 / PX_PER_INCH,  // 20 英寸
	slideHeight: 1080 / PX_PER_INCH, // 11.25 英寸
}

/**
 * 像素转英寸 - 直接按 96 DPI 转换
 * HTML 多大像素，PPT 就多大英寸（1:1 等比例）
 * 
 * 例如：96px → 1 英寸，192px → 2 英寸
 */
export function pxToInch(px: number, _config?: SlideConfig): number {
	return px / PX_PER_INCH
}

/**
 * 英寸转像素
 */
export function inchToPx(inch: number, _config?: SlideConfig): number {
	return inch * PX_PER_INCH
}

/**
 * 解析 CSS 尺寸值，支持 px、%、em、rem、vw、vh 等单位
 */
export function parseCSSSize(
	value: string,
	containerSize: number,
	viewportWidth: number = 1920,
	viewportHeight: number = 1080,
): number {
	if (!value || value === "auto") return 0

	const match = value.match(/([\d.]+)(px|%|em|rem|vw|vh|vmin|vmax)?/)
	if (!match) return 0

	const num = parseFloat(match[1])
	const unit = match[2] || "px"

	switch (unit) {
		case "px":
			return num
		case "%":
			return (containerSize * num) / 100
		case "em":
		case "rem":
			return num * 16 // 假设基准字号 16px
		case "vw":
			return (viewportWidth * num) / 100
		case "vh":
			return (viewportHeight * num) / 100
		case "vmin":
			return (Math.min(viewportWidth, viewportHeight) * num) / 100
		case "vmax":
			return (Math.max(viewportWidth, viewportHeight) * num) / 100
		default:
			return num
	}
}

/**
 * 解析 border-radius，返回像素值
 * 对于多值的情况，返回其中最小的非零值，以避免巨大的圆角
 */
export function parseBorderRadius(
	value: string,
	width: number,
	height: number,
): number {
	if (!value || value === "0px") return 0

	// 匹配所有数值部分 (支持 255px 15px ... 或 255px / 15px ...)
	const matches = value.match(/([\d.]+)(px|%|em|rem)?/g)
	if (!matches) return 0

	let minRadius = Number.MAX_VALUE
	let found = false

	for (const match of matches) {
		const m = match.match(/([\d.]+)(px|%|em|rem)?/)
		if (!m) continue

		const num = parseFloat(m[1])
		const unit = m[2] || "px"
		let px = 0

		if (unit === "%") {
			// 百分比相对于较小边
			px = (Math.min(width, height) * num) / 100
		} else if (unit === "em" || unit === "rem") {
			px = num * 16
		} else {
			px = num
		}

		if (px > 0) {
			minRadius = Math.min(minRadius, px)
			found = true
		}
	}

	return found ? minRadius : 0
}

/**
 * 解析元素的有效圆角半径（像素）
 * 优先使用自身 border-radius；若为 0，则继承父级 overflow:hidden + border-radius 的裁剪效果
 * 用于图片等子元素在父容器裁剪场景下获得正确圆角（如头像容器）
 */
export function resolveEffectiveRadius(node: {
	style: { borderRadius: string; overflow?: string }
	rect: { w: number; h: number }
	parent?: { style: { borderRadius: string; overflow?: string }; rect: { w: number; h: number } } | null
}): number {
	let radiusPx = parseBorderRadius(node.style.borderRadius, node.rect.w, node.rect.h)
	if (radiusPx === 0 && node.parent) {
		const parent = node.parent
		const overflow = parent.style.overflow
		if ((overflow === "hidden" || overflow === "clip") && parent.style.borderRadius) {
			const parentRadius = parseBorderRadius(
				parent.style.borderRadius,
				parent.rect.w,
				parent.rect.h,
			)
			if (parentRadius > 0) {
				radiusPx = Math.min(parentRadius, Math.min(node.rect.w, node.rect.h) / 2)
			}
		}
	}
	return radiusPx
}

/**
 * 判断是否应该使用椭圆形状
 * 只有当元素接近正方形且 border-radius >= 50% 时才使用椭圆
 * 长条形元素即使有大圆角也应该使用 roundRect（胶囊形）
 */
export function isFullyRounded(
	borderRadius: string,
	width: number,
	height: number,
): boolean {
	if (!borderRadius || borderRadius === "0px") return false

	// 检查宽高比，只有接近正方形才考虑椭圆
	// 允许一定的误差范围（比例在 0.7 ~ 1.43 之间）
	const aspectRatio = width / height
	const isSquareish = aspectRatio >= 0.7 && aspectRatio <= 1.43

	if (!isSquareish) return false

	const match = borderRadius.match(/([\d.]+)(px|%|em|rem)?/)
	if (!match) return false

	const num = parseFloat(match[1])
	const unit = match[2] || "px"

	if (unit === "%") {
		// 50% 或更大表示完全圆角
		return num >= 50
	}

	// 对于 px 值，检查是否 >= 短边的一半
	const minHalf = Math.min(width, height) / 2
	let radiusPx = num
	if (unit === "em" || unit === "rem") {
		radiusPx = num * 16
	}

	return radiusPx >= minHalf
}

/**
 * 英寸转磅 (pt)
 */
export function inchToPt(inch: number): number {
	return inch * 72
}

/**
 * 磅转英寸
 */
export function ptToInch(pt: number): number {
	return pt / 72
}

/**
 * 像素转磅
 * 1 inch = 96 px = 72 pt，所以 pt = px * 0.75
 */
export function pxToPt(px: number): number {
	return px * 0.75
}

/**
 * 递归获取元素的累积变换 (旋转角度和缩放比例)
 * @param node 元素节点
 */
export function getGlobalTransform(
	node: ElementNode,
): { rotation: number; scaleX: number; scaleY: number } {
	let rotation = 0
	let scaleX = 1
	let scaleY = 1
	let current: ElementNode | null = node

	while (current) {
		const style = current.style ?? (current.element && (current.element as HTMLElement).style)
		const transform = style?.transform

		if (transform && transform !== "none") {
			try {
				const m = new DOMMatrix(transform)
				const angle = Math.round(Math.atan2(m.b, m.a) * (180 / Math.PI))
				rotation += angle
				const sx = Math.sqrt(m.a * m.a + m.b * m.b)
				const sy = Math.sqrt(m.c * m.c + m.d * m.d)
				scaleX *= sx
				scaleY *= sy
			} catch (e) {
				log(LogLevel.L3, "Invalid transform matrix", { error: String(e) })
			}
		}
		current = current.parent
	}

	return { rotation, scaleX, scaleY }
}
