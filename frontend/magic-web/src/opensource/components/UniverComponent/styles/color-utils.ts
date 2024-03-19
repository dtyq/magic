/**
 * 颜色处理工具模块
 * 处理Excel颜色索引、RGB转换、主题色等
 */

// Excel扩展颜色调色板 - 支持传统56色 + 扩展颜色索引
// 基于Microsoft Excel的官方调色板标准及现代Excel扩展
export const EXCEL_INDEXED_COLORS: Record<number, string> = {
	// 0-7: 标准颜色 (Standard Colors)
	0: "#000000", // Black
	1: "#FFFFFF", // White
	2: "#FF0000", // Red
	3: "#00FF00", // Green
	4: "#0000FF", // Blue
	5: "#FFFF00", // Yellow
	6: "#FF00FF", // Magenta
	7: "#00FFFF", // Cyan

	// 8-15: 深色变体
	8: "#800000", // Dark Red
	9: "#008000", // Dark Green
	10: "#000080", // Dark Blue
	11: "#808000", // Dark Yellow/Olive
	12: "#800080", // Dark Magenta/Purple
	13: "#008080", // Dark Cyan/Teal
	14: "#C0C0C0", // Light Gray
	15: "#808080", // Gray

	// 16-23: 图表填充颜色 (Chart Fill Colors)
	16: "#9999FF", // Light Blue
	17: "#993366", // Brown
	18: "#FFFFCC", // Light Yellow
	19: "#CCFFFF", // Light Cyan
	20: "#660066", // Dark Purple
	21: "#FF8080", // Light Red
	22: "#0066CC", // Medium Blue
	23: "#CCCCFF", // Very Light Blue

	// 24-31: 图表线条颜色 (Chart Line Colors)
	24: "#000080", // Navy Blue
	25: "#FF00FF", // Bright Magenta
	26: "#FFFF00", // Bright Yellow
	27: "#00FFFF", // Bright Cyan
	28: "#800080", // Purple
	29: "#800000", // Maroon
	30: "#008080", // Teal
	31: "#0000FF", // Blue

	// 32-47: 扩展颜色 (Extended Colors)
	32: "#00CCFF", // Sky Blue
	33: "#CCFFFF", // Light Cyan
	34: "#CCFFCC", // Light Green
	35: "#FFFF99", // Light Yellow
	36: "#99CCFF", // Light Blue
	37: "#FF99CC", // Light Pink
	38: "#CC99FF", // Light Purple
	39: "#FFCC99", // Light Orange
	40: "#3366FF", // Medium Blue
	41: "#33CCCC", // Medium Cyan
	42: "#99CC00", // Lime Green
	43: "#FFCC00", // Orange
	44: "#FF9900", // Dark Orange
	45: "#FF6600", // Red Orange
	46: "#666699", // Slate Blue
	47: "#969696", // Medium Gray

	// 48-55: 深色系列 (Dark Series)
	48: "#003366", // Dark Blue
	49: "#339966", // Medium Green
	50: "#003300", // Dark Green
	51: "#333300", // Dark Olive
	52: "#993300", // Dark Orange
	53: "#993366", // Dark Pink
	54: "#333399", // Dark Blue
	55: "#333333", // Dark Gray
	56: "#333333", // Dark Gray

	// 57-63: Excel 2007+ 扩展颜色（灰色渐变）
	57: "#F2F2F2", // Very Light Gray
	58: "#E6E6E6", // Light Gray
	59: "#D9D9D9", // Medium Light Gray
	60: "#CCCCCC", // Medium Gray
	61: "#BFBFBF", // Medium Dark Gray
	62: "#B3B3B3", // Dark Gray
	63: "#A6A6A6", // Very Dark Gray

	// 64-79: 主题颜色扩展 (Theme Color Extensions)
	64: "#E6E6FA", // Lavender
	65: "#DDA0DD", // Plum
	66: "#DA70D6", // Orchid
	67: "#FF69B4", // Hot Pink
	68: "#FFB6C1", // Light Pink
	69: "#FFC0CB", // Pink
	70: "#FFE4E1", // Misty Rose
	71: "#F0F8FF", // Alice Blue
	72: "#E0E6FF", // Light Blue
	73: "#B0C4DE", // Light Steel Blue
	74: "#87CEEB", // Sky Blue
	75: "#87CEFA", // Light Sky Blue
	76: "#00BFFF", // Deep Sky Blue
	77: "#1E90FF", // Dodger Blue
	78: "#4169E1", // Royal Blue
	79: "#0000CD", // Medium Blue

	// 80-95: 绿色系扩展 (Green Series Extension)
	80: "#F0FFF0", // Honeydew
	81: "#98FB98", // Pale Green
	82: "#90EE90", // Light Green
	83: "#00FF7F", // Spring Green
	84: "#00FA9A", // Medium Spring Green
	85: "#00FF00", // Lime
	86: "#32CD32", // Lime Green
	87: "#228B22", // Forest Green
	88: "#006400", // Dark Green
	89: "#8FBC8F", // Dark Sea Green
	90: "#9ACD32", // Yellow Green
	91: "#ADFF2F", // Green Yellow
	92: "#7CFC00", // Lawn Green
	93: "#7FFF00", // Chartreuse
	94: "#00FF32", // Electric Green
	95: "#00FA54", // Bright Green

	// 96-111: 红色系扩展 (Red Series Extension)
	96: "#FFF0F0", // Light Pink
	97: "#FFE4E1", // Misty Rose
	98: "#FFA07A", // Light Salmon
	99: "#FA8072", // Salmon
	100: "#FF6347", // Tomato
	101: "#FF4500", // Orange Red
	102: "#DC143C", // Crimson
	103: "#B22222", // Fire Brick
	104: "#8B0000", // Dark Red
	105: "#CD5C5C", // Indian Red
	106: "#F08080", // Light Coral
	107: "#E9967A", // Dark Salmon
	108: "#FF7F50", // Coral
	109: "#FF69B4", // Hot Pink
	110: "#FF1493", // Deep Pink
	111: "#C71585", // Medium Violet Red

	// 112-127: 黄色/橙色系扩展 (Yellow/Orange Series Extension)
	112: "#FFFACD", // Lemon Chiffon
	113: "#FFEFD5", // Papaya Whip
	114: "#FFE4B5", // Moccasin
	115: "#FFDAB9", // Peach Puff
	116: "#F4A460", // Sandy Brown
	117: "#DAA520", // Goldenrod
	118: "#FF8C00", // Dark Orange
	119: "#FF7F00", // Orange
	120: "#FFA500", // Orange
	121: "#FFD700", // Gold
	122: "#FFFF00", // Yellow
	123: "#FFFFE0", // Light Yellow
	124: "#FFFFF0", // Ivory
	125: "#F0E68C", // Khaki
	126: "#BDB76B", // Dark Khaki
	127: "#EEE8AA", // Pale Goldenrod
}

/**
 * 获取Excel索引颜色对应的RGB值
 * @param colorIndex 颜色索引 (0-127)
 * @returns 对应的RGB十六进制颜色值
 */
export function getExcelIndexedColor(colorIndex: number): string {
	// 确保索引在有效范围内
	const index = Math.max(0, Math.min(127, colorIndex))
	return EXCEL_INDEXED_COLORS[index] || "#000000"
}

/**
 * 标准化颜色值为十六进制格式
 * @param color 颜色值 (rgb, rgba, hex, named color)
 * @returns 标准化的十六进制颜色值
 */
export function normalizeColor(color: string): string | null {
	if (!color) return null

	// 清理颜色字符串
	color = color.trim().toLowerCase()

	// 十六进制颜色
	if (color.startsWith("#")) {
		// 确保是6位十六进制
		if (color.length === 4) {
			// #rgb -> #rrggbb
			return "#" + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
		} else if (color.length === 7) {
			return color.toUpperCase()
		}
	}

	// RGB/RGBA 颜色
	const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/)
	if (rgbMatch) {
		const r = parseInt(rgbMatch[1], 10)
		const g = parseInt(rgbMatch[2], 10)
		const b = parseInt(rgbMatch[3], 10)

		// 转换为十六进制
		const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase()
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`
	}

	// 命名颜色映射 (基本颜色)
	const namedColors: Record<string, string> = {
		black: "#000000",
		white: "#FFFFFF",
		red: "#FF0000",
		green: "#008000",
		blue: "#0000FF",
		yellow: "#FFFF00",
		cyan: "#00FFFF",
		magenta: "#FF00FF",
		gray: "#808080",
		grey: "#808080",
		silver: "#C0C0C0",
		maroon: "#800000",
		olive: "#808000",
		lime: "#00FF00",
		aqua: "#00FFFF",
		teal: "#008080",
		navy: "#000080",
		fuchsia: "#FF00FF",
		purple: "#800080",
		orange: "#FFA500",
	}

	return namedColors[color] || null
}

/**
 * 增强的颜色处理函数，支持主题色、RGB、索引色等
 * @param colorObj Excel颜色对象
 * @param defaultColor 默认颜色
 * @returns 处理后的RGB颜色值
 */
export function processExcelColor(colorObj: unknown, defaultColor: string = "#000000"): string {
	if (!colorObj || typeof colorObj !== "object") return defaultColor

	const color = colorObj as Record<string, unknown>

	// RGB颜色
	if (color.rgb && typeof color.rgb === "string") {
		let rgb = color.rgb
		if (rgb.length === 8) {
			rgb = rgb.substring(2) // 移除ARGB中的Alpha通道
		}
		return `#${rgb}`
	}

	// 索引颜色
	if (color.indexed !== undefined && typeof color.indexed === "number") {
		return getExcelIndexedColor(color.indexed)
	}

	// 主题颜色
	if (color.theme !== undefined && typeof color.theme === "number") {
		const themeColors = [
			"#FFFFFF",
			"#000000",
			"#EEECE1",
			"#1F497D",
			"#4F81BD",
			"#C0504D",
			"#9BBB59",
			"#8064A2",
			"#4BACC6",
			"#F79646",
			"#0000FF",
			"#800080",
		]
		let themeColor = themeColors[color.theme] || defaultColor

		// 处理色调变化(tint)
		if (color.tint !== undefined && typeof color.tint === "number" && color.tint !== 0) {
			// 简化的色调处理：根据tint值调整亮度
			const tint = color.tint
			if (tint > 0) {
				// 变浅：向白色混合
				themeColor = adjustColorBrightness(themeColor, 1 + tint * 0.5)
			} else {
				// 变深：向黑色混合
				themeColor = adjustColorBrightness(themeColor, 1 + tint * 0.5)
			}
		}
		return themeColor
	}

	// 自动颜色
	if (color.auto) {
		return defaultColor
	}

	return defaultColor
}

/**
 * 调整颜色亮度的辅助函数
 * @param color 十六进制颜色值
 * @param factor 亮度因子 (0-2, 1为不变)
 * @returns 调整后的颜色
 */
export function adjustColorBrightness(color: string, factor: number): string {
	const hex = color.replace("#", "")
	const r = Math.min(255, Math.max(0, Math.round(parseInt(hex.substring(0, 2), 16) * factor)))
	const g = Math.min(255, Math.max(0, Math.round(parseInt(hex.substring(2, 4), 16) * factor)))
	const b = Math.min(255, Math.max(0, Math.round(parseInt(hex.substring(4, 6), 16) * factor)))

	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
		.toString(16)
		.padStart(2, "0")}`
}
