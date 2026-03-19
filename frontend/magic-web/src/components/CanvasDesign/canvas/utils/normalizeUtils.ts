import type { Rect } from "./utils"

/**
 * 规范化选项
 */
export interface NormalizeOptions {
	/**
	 * 精度：'integer' 表示整数，数字表示保留的小数位数
	 * @default 'integer'
	 */
	precision?: "integer" | number
	/**
	 * 是否保持宽高比
	 * @default false
	 */
	keepAspectRatio?: boolean
	/**
	 * 宽高比（width / height），如果指定，优先使用此值
	 * 当 keepAspectRatio 为 true 时，此值必须提供
	 */
	aspectRatio?: number
}

/**
 * 规范化单个数值
 * @param value - 要规范化的值
 * @param precision - 精度：'integer' 表示整数，数字表示保留的小数位数
 * @returns 规范化后的值
 */
function normalizeValue(value: number, precision: "integer" | number = "integer"): number {
	if (precision === "integer") {
		return Math.round(value)
	}
	const multiplier = Math.pow(10, precision)
	return Math.round(value * multiplier) / multiplier
}

/**
 * 规范化位置坐标
 * @param x - X 坐标
 * @param y - Y 坐标
 * @param options - 规范化选项
 * @returns 规范化后的位置坐标
 */
export function normalizePosition(
	x: number,
	y: number,
	options: NormalizeOptions = {},
): { x: number; y: number } {
	const { precision = "integer" } = options
	return {
		x: normalizeValue(x, precision),
		y: normalizeValue(y, precision),
	}
}

/**
 * 规范化尺寸（支持保持宽高比）
 * @param width - 宽度
 * @param height - 高度
 * @param options - 规范化选项
 * @returns 规范化后的尺寸
 */
export function normalizeSize(
	width: number,
	height: number,
	options: NormalizeOptions = {},
): { width: number; height: number } {
	const { precision = "integer", keepAspectRatio = false, aspectRatio } = options

	// 如果不需要保持宽高比，直接规范化两个维度
	if (!keepAspectRatio || !aspectRatio) {
		return {
			width: normalizeValue(width, precision),
			height: normalizeValue(height, precision),
		}
	}

	// 保持宽高比：先规范化一个维度，另一个维度按比例计算
	// 选择变化更大的维度作为基准，以保持更好的精度
	// 计算如果以宽度为基准，高度应该是多少
	const heightFromWidth = width / aspectRatio
	const widthFromHeight = height * aspectRatio

	// 计算两种方案的误差
	const errorIfWidthBase = Math.abs(height - heightFromWidth)
	const errorIfHeightBase = Math.abs(width - widthFromHeight)

	// 选择误差更小的方案
	if (errorIfWidthBase <= errorIfHeightBase) {
		// 以宽度为基准
		const normalizedWidth = normalizeValue(width, precision)
		const normalizedHeight = normalizeValue(normalizedWidth / aspectRatio, precision)
		return { width: normalizedWidth, height: normalizedHeight }
	} else {
		// 以高度为基准
		const normalizedHeight = normalizeValue(height, precision)
		const normalizedWidth = normalizeValue(normalizedHeight * aspectRatio, precision)
		return { width: normalizedWidth, height: normalizedHeight }
	}
}

/**
 * 规范化整个矩形
 * @param rect - 矩形对象
 * @param options - 规范化选项
 * @returns 规范化后的矩形
 */
export function normalizeRect(rect: Rect, options: NormalizeOptions = {}): Rect {
	const { precision = "integer", keepAspectRatio = false, aspectRatio } = options

	// 规范化位置
	const normalizedPos = normalizePosition(rect.x, rect.y, { precision })

	// 规范化尺寸
	const normalizedSize = normalizeSize(rect.width, rect.height, {
		precision,
		keepAspectRatio,
		aspectRatio,
	})

	return {
		x: normalizedPos.x,
		y: normalizedPos.y,
		width: normalizedSize.width,
		height: normalizedSize.height,
	}
}
