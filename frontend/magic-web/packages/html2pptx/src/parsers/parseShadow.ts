/**
 * 阴影解析器
 * 将 CSS box-shadow 转换为 PPT 阴影格式
 */

import type { PPTShadow } from "../types/index"
import { colorToHex, getShadowOpacity } from "../utils/color"
import { pxToPt } from "../utils/unit"
import { splitByTopLevelComma } from "../utils/string"

/** CSS 阴影解析结果 (兼容 box-shadow 和 text-shadow) */
interface CSSShadow {
	inset: boolean
	offsetX: number // px
	offsetY: number // px
	blur: number // px
	spread: number // px (text-shadow 始终为 0)
	color: string
}

/**
 * 解析 CSS box-shadow 为 PPT 阴影格式
 * 统一处理 box-shadow 和 text-shadow
 * 注意：PPT 不支持 inner 阴影，inset 会被忽略（或当作 outer 处理）
 */
export function parseShadow(value: string): PPTShadow | null {
	if (!value || value === "none") return null

	// 解析 CSS box-shadow / text-shadow
	const cssShadow = parseCSSShadow(value)
	if (!cssShadow) return null

	// 笛卡尔坐标 → 极坐标
	const { angle, distance } = cartesianToPolar(cssShadow.offsetX, cssShadow.offsetY)

const opacity = getShadowOpacity(cssShadow.color)

	return {
		type: "outer", // 强制为 outer，因为 PPT 实际上不支持 inner
		angle,
		blur: pxToPt(cssShadow.blur),
		offset: pxToPt(distance),
		color: colorToHex(cssShadow.color),
		opacity,
	}
}
/**
 * 解析 CSS 阴影字符串
 * 支持格式：
 * - "10px 10px 5px rgba(0,0,0,0.5)"
 * - "inset 2px 2px 4px 0px #000"
 * - "5px 5px 10px 2px red"
 */
function parseCSSShadow(value: string): CSSShadow | null {
	const trimmed = value.trim()
	if (!trimmed || trimmed === "none") return null

	// 检查是否有多个阴影
	// 遍历所有阴影，找到第一个可见的阴影（非全透明且有模糊或偏移）
	const shadows = splitByTopLevelComma(trimmed)
	let targetShadow = shadows[0]

	for (const shadow of shadows) {
		const { color } = extractColor(shadow)
		const opacity = getShadowOpacity(color)
		// 如果阴影完全透明 (opacity === 0)，则跳过
		if (opacity > 0) {
			targetShadow = shadow
			break
		}
	}

	if (!targetShadow) return null

	// 检查 inset
	const inset = targetShadow.includes("inset")
	const withoutInset = targetShadow.replace(/\binset\b/gi, "").trim()

	// 提取颜色（可能在开头或结尾）
	const { color, remaining } = extractColor(withoutInset)

	// 解析数值部分
	const numbers = remaining.match(/-?[\d.]+px/g)
	if (!numbers || numbers.length < 2) return null

	const values = numbers.map((n) => parseFloat(n))

	return {
		inset,
		offsetX: values[0] || 0,
		offsetY: values[1] || 0,
		blur: values[2] || 0,
		spread: values[3] || 0,
		color: color || "rgba(0,0,0,0.5)",
	}
}


/**
 * 从字符串中提取颜色
 */
function extractColor(str: string): { color: string; remaining: string } {
	// 匹配 rgb/rgba
	const rgbMatch = str.match(/rgba?\([^)]+\)/i)
	if (rgbMatch) {
		return {
			color: rgbMatch[0],
			remaining: str.replace(rgbMatch[0], "").trim(),
		}
	}

	// 匹配 HEX
	const hexMatch = str.match(/#[0-9a-fA-F]{3,8}\b/)
	if (hexMatch) {
		return {
			color: hexMatch[0],
			remaining: str.replace(hexMatch[0], "").trim(),
		}
	}

	// 匹配命名颜色（在数值之后）
	const parts = str.split(/\s+/)
	const numericParts: string[] = []
	let colorPart = ""

	for (const part of parts) {
		if (/^-?[\d.]+px$/.test(part)) {
			numericParts.push(part)
		} else if (!colorPart && /^[a-zA-Z]+$/.test(part)) {
			colorPart = part
		}
	}

	return {
		color: colorPart || "black",
		remaining: numericParts.join(" "),
	}
}

/**
 * 笛卡尔坐标转极坐标
 * @param x - 水平偏移 (正值向右)
 * @param y - 垂直偏移 (正值向下)
 * @returns { angle, distance }
 */
function cartesianToPolar(x: number, y: number): { angle: number; distance: number } {
	// 计算距离
	const distance = Math.sqrt(x * x + y * y)

	// 计算角度 (atan2 返回弧度，-π 到 π)
	// CSS: x正向右，y正向下
	// PPT: 0度向右，顺时针
	let angle = Math.atan2(y, x) * (180 / Math.PI)

	// 转换为 0-360 度
	if (angle < 0) angle += 360

	return {
		angle: Math.round(angle),
		distance: Math.round(distance * 100) / 100,
	}
}
