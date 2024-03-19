/**
 * 颜色工具函数
 */

import type { PPTTextGradient } from "../types/index"
import { splitByTopLevelComma } from "./string"

const effectiveOpacityCache = new WeakMap<Element, number>()

/**
 * 解析 RGBA/RGB 颜色为 HEX 格式 (不含 #)
 */
export function colorToHex(color: string): string {
	if (!color) return "000000"

	// 2. 已经是 HEX 格式
	if (color.startsWith("#")) {
		const hex = color.slice(1)
		// 处理 3 位 HEX
		if (hex.length === 3) {
			return hex
				.split("")
				.map((c) => c + c)
				.join("")
				.toUpperCase()
		}
		return hex.toUpperCase().slice(0, 6)
	}

	// RGB/RGBA 格式
	const rgbaMatch = color.match(/rgba?\(([\d\s,\.]+)\)/)
	if (rgbaMatch) {
		const parts = rgbaMatch[1].split(",").map((s) => parseFloat(s.trim()))
		const [r, g, b] = parts
		return [r, g, b]
			.map((v) =>
				Math.round(Math.max(0, Math.min(255, v)))
					.toString(16)
					.padStart(2, "0"),
			)
			.join("")
			.toUpperCase()
	}

	// 命名颜色映射 (常用)
	const namedColors: Record<string, string> = {
		transparent: "000000", // 默认视为白色，由透明度控制可见性
		black: "000000",
		white: "FFFFFF",
		red: "FF0000",
		green: "008000",
		blue: "0000FF",
		yellow: "FFFF00",
		cyan: "00FFFF",
		magenta: "FF00FF",
		gray: "808080",
		grey: "808080",
	}

	const lower = color.toLowerCase()
	if (namedColors[lower]) return namedColors[lower]

	return "000000"
}

/**
 * 从颜色字符串提取透明度 (0-100)
 * 0 = 完全不透明, 100 = 完全透明
 */
export function getTransparency(color: string): number {
	if (!color || color === "transparent") return 100

	const rgbaMatch = color.match(/rgba\([\d\s,]+,\s*([\d.]+)\)/)
	if (rgbaMatch) {
		const alpha = parseFloat(rgbaMatch[1])
		// CSS 中 alpha 0 是全透明，1 是不透明
		// PPT 中 transparency 0 是不透明，100 是全透明
		// 所以公式是：(1 - alpha) * 100
		return Math.round((1 - alpha) * 100)
	}

	return 0
}

/**
 * 从颜色字符串提取不透明度 (0-1) 用于阴影
 * 0.0 = 完全透明, 1.0 = 完全不透明
 * 这与 PPT 其他部分的 transparency (0-100, 100=完全透明) 是相反的
 */
export function getShadowOpacity(color: string): number {
	if (!color || color === "transparent") return 0

	const rgbaMatch = color.match(/rgba\([\d\s,]+,\s*([\d.]+)\)/)
	if (rgbaMatch) {
		const alpha = parseFloat(rgbaMatch[1])
		return Math.max(0, Math.min(1, alpha))
	}

	// 如果是 Hex 或 rgb，默认是不透明的 (1.0)
	return 1
}

/**
 * 判断颜色是否可见 (非透明)
 */
export function isVisibleColor(color: string): boolean {
	if (!color) return false
	if (color === "transparent") return false
	if (color === "rgba(0, 0, 0, 0)") return false

	const transparency = getTransparency(color)
	return transparency < 100
}

/**
 * 判断是否有可见的背景色
 */
export function hasVisibleBackground(backgroundColor: string): boolean {
	return isVisibleColor(backgroundColor)
}

/**
 * 解析 CSS opacity 值，返回 0-1 的数值
 */
export function parseOpacityValue(value: string): number {
	const parsed = parseFloat(value)
	if (Number.isNaN(parsed)) return 1
	return Math.max(0, Math.min(1, parsed))
}

/**
 * 计算元素及其所有祖先的累积透明度
 */
export function getEffectiveOpacity(element: Element): number {
	const doc = element.ownerDocument
	const win = doc?.defaultView
	if (!doc || !win) return 1
	const cached = effectiveOpacityCache.get(element)
	if (cached !== undefined) return cached

	let opacity = 1
	let current: Element | null = element

	while (current && current !== doc.body && current.parentElement) {
		const currentCached = effectiveOpacityCache.get(current)
		if (currentCached !== undefined) {
			opacity *= currentCached
			break
		}
		const style = win.getComputedStyle(current)
		const elOpacity = parseOpacityValue(style.opacity)
		opacity *= elOpacity
		current = current.parentElement
	}

	effectiveOpacityCache.set(element, opacity)
	return opacity
}



/**
 * 判断是否有可见的边框
 */
export function hasVisibleBorder(
	borderStyle: string,
	borderWidth: string,
	borderColor: string,
): boolean {
	if (borderStyle === "none") return false
	const width = parseFloat(borderWidth)
	if (width <= 0) return false
	return isVisibleColor(borderColor)
}

/**
 * 解析带透明度的颜色，返回 HEX 和透明度
 */
export function parseColorWithTransparency(color: string): {
	color: string
	transparency: number
	isValid: boolean
} {
	if (!color || color === "transparent") {
		return { color: "000000", transparency: 100, isValid: false }
	}

	return {
		color: colorToHex(color),
		transparency: getTransparency(color),
		isValid: true,
	}
}

/**
 * 判断是否是渐变背景
 */
export function isGradientBackground(backgroundImage: string): boolean {
	if (!backgroundImage || backgroundImage === "none") return false
	return backgroundImage.includes("gradient")
}

/**
 * 解析 CSS 渐变为 PPT 渐变格式
 */
export function parseGradient(backgroundImage: string): {
	type: "gradient"
	gradientType: "linear" | "radial"
	angle?: number
	style?: "circle" | "ellipse"
	stops: Array<{ position: number; color: string; transparency?: number }>
} | null {
	if (!backgroundImage || backgroundImage === "none") return null

	// 提取渐变内容（支持嵌套括号）
	const linearContent = extractGradientContent(backgroundImage, "linear-gradient")
	if (linearContent) {
		return parseLinearGradient(linearContent)
	}

	const radialContent = extractGradientContent(backgroundImage, "radial-gradient")
	if (radialContent) {
		return parseRadialGradient(radialContent)
	}

	return null
}

/**
 * 提取渐变函数的内容（支持嵌套括号如 rgb(), rgba()）
 */
function extractGradientContent(str: string, funcName: string): string | null {
	const startIndex = str.indexOf(funcName + "(")
	if (startIndex === -1) return null

	const contentStart = startIndex + funcName.length + 1
	let depth = 1
	let i = contentStart

	while (i < str.length && depth > 0) {
		if (str[i] === "(") depth++
		if (str[i] === ")") depth--
		i++
	}

	if (depth === 0) {
		return str.slice(contentStart, i - 1)
	}
	return null
}

/**
 * 解析线性渐变
 */
function parseLinearGradient(content: string): {
	type: "gradient"
	gradientType: "linear"
	angle: number
	stops: Array<{ position: number; color: string; transparency?: number }>
} {
	const parts = splitByTopLevelComma(content)
	let cssAngle = 180
	let colorStops: string[] = []

	// 第一个参数可能是角度或方向
	const firstPart = parts[0]
	if (firstPart) {
		// 角度: 180deg, 45deg
		const degMatch = firstPart.match(/([\d.]+)deg/)
		if (degMatch) {
			cssAngle = parseFloat(degMatch[1])
			colorStops = parts.slice(1)
		}
		// 方向: to right, to bottom
		else if (firstPart.startsWith("to ")) {
			cssAngle = directionToAngle(firstPart)
			colorStops = parts.slice(1)
		}
		// 没有角度，直接是颜色
		else {
			colorStops = parts
		}
	}

	// 解析颜色节点
	const stops = parseColorStops(colorStops)

	return {
		type: "gradient",
		gradientType: "linear",
		angle: cssAngleToPptAngle(cssAngle),
		stops,
	}
}

function cssAngleToPptAngle(cssDeg: number): number {
	// 归一化到 0~359
	const css = ((cssDeg % 360) + 360) % 360
	// CSS: 0=上, 90=右；PPT: 0=右, 90=下
	return (css + 270) % 360 // 等价于 css - 90
}

/**
 * 解析径向渐变
 */
function parseRadialGradient(content: string): {
	type: "gradient"
	gradientType: "radial"
	style: "circle" | "ellipse"
	stops: Array<{ position: number; color: string; transparency?: number }>
} {
	const parts = splitByTopLevelComma(content)
	let colorStops: string[] = []
	let style: "circle" | "ellipse" = "ellipse"

	// 第一个参数可能是形状描述 (circle, ellipse, at center 等)
	const firstPart = parts[0]
	if (firstPart && (firstPart.includes("circle") || firstPart.includes("ellipse") || firstPart.includes("at "))) {
		if (firstPart.includes("circle")) {
			style = "circle"
		}
		colorStops = parts.slice(1)
	} else {
		colorStops = parts
	}

	const stops = parseColorStops(colorStops)

	return {
		type: "gradient",
		gradientType: "radial",
		style,
		stops,
	}
}

/**
 * 方向转角度
 */
function directionToAngle(direction: string): number {
	const dirMap: Record<string, number> = {
		"to top": 0,
		"to right": 90,
		"to bottom": 180,
		"to left": 270,
		"to top right": 45,
		"to right top": 45,
		"to bottom right": 135,
		"to right bottom": 135,
		"to bottom left": 225,
		"to left bottom": 225,
		"to top left": 315,
		"to left top": 315,
	}
	return dirMap[direction] ?? 180
}

/**
 * 解析颜色节点
 */
function parseColorStops(parts: string[]): Array<{ position: number; color: string; transparency?: number }> {
	const stops: Array<{ position: number; color: string; transparency?: number }> = []

	parts.forEach((part, index) => {
		// 匹配颜色和位置: "#fff 0%", "rgb(255,255,255) 50%", "red"
		const trimmed = part.trim()
		if (!trimmed) return

		// 尝试提取位置百分比（末尾的 xx%）
		const posMatch = trimmed.match(/([\d.]+)%\s*$/)
		let position: number

		if (posMatch) {
			position = parseFloat(posMatch[1]) / 100
		} else {
			// 没有位置，根据索引平均分配
			position = parts.length > 1 ? index / (parts.length - 1) : 0
		}

		// 提取颜色部分（去掉末尾的百分比）
		const colorStr = posMatch ? trimmed.replace(/([\d.]+)%\s*$/, "").trim() : trimmed

		const hex = colorToHex(colorStr)
		const transparency = getTransparency(colorStr)

		stops.push({
			position,
			color: hex,
			transparency: transparency > 0 ? transparency : undefined,
		})
	})

	// 确保至少有2个节点
	if (stops.length === 0) {
		return [
			{ position: 0, color: "FFFFFF" },
			{ position: 1, color: "000000" },
		]
	}
	if (stops.length === 1) {
		stops.push({ position: 1, color: stops[0].color })
	}

	return stops
}

/**
 * 解析 CSS filter 中的 blur 值 (像素)
 */
export function parseBlur(filter: string): number | null {
	if (!filter || filter === "none") return null
	const match = filter.match(/blur\(([\d.]+)px\)/)
	return match ? parseFloat(match[1]) : null
}

/**
 * 提取渐变的第一个颜色
 * 如果文字使用了渐变，取第一个颜色作为纯色，并保留其透明度
 */
export function extractFirstColorFromGradient(
	backgroundImage: string,
): { color: string; transparency: number } | null {
	const gradient = parseGradient(backgroundImage)
	if (!gradient || !gradient.stops.length) return null

	const firstStop = gradient.stops[0]

	return {
		color: firstStop.color,
		transparency: firstStop.transparency ?? 0,
	}
}

/**
 * 将元素整体 opacity 合并到渐变 stops 透明度中
 */
export function mergeGradientStopsWithElementOpacity(
	gradient: PPTTextGradient,
	elementOpacity: number,
): PPTTextGradient {
	if (elementOpacity >= 1) return gradient

	const normalizedOpacity = Math.max(0, Math.min(1, elementOpacity))
	const stops = gradient.stops.map((stop) => {
		const stopTransparency = stop.transparency ?? 0
		const stopAlpha = 1 - stopTransparency / 100
		const mergedAlpha = stopAlpha * normalizedOpacity
		const mergedTransparency = Math.round((1 - mergedAlpha) * 100)

		return {
			...stop,
			transparency: mergedTransparency > 0 ? mergedTransparency : undefined,
		}
	})

	return {
		...gradient,
		stops,
	}
}
