const map = new Map<string, string>()

export function textToBackgroundColor(name?: string) {
	if (!name) return "#ffffff"

	let hash = 0
	for (let i = 0; i < name.length; i += 1) {
		hash += name.charCodeAt(i)
	}
	const hue = (hash % 360) + 10 // 确保色调在10到360之间
	const saturation = 60 + (hash % 20) // 确保饱和度在60到80之间
	const lightness = 40 + (hash % 20) // 确保亮度在40到60之间

	// 确保生成的颜色柔和舒适
	return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export function textToDisplayName(name?: string) {
	if (!name) return ""
	// 判断是中文名还是英文名
	const isChinese = name.match(/[\u4e00-\u9fa5]/)
	if (isChinese) {
		// 截取中文名的后两个有效的中文字符,不包含标点符号
		return name.replace(/[^\u4e00-\u9fa5]/g, "").slice(-2)
	}
	// 截取英文名的第一个大写字母
	return name[0]?.toUpperCase() ?? ""
}

export function textToTextColor(name?: string) {
	if (!name) return ""
	// 判断是中文名还是英文名
	const isChinese = name.match(/[\u4e00-\u9fa5]/)
	if (isChinese) {
		// 截取中文名的后两个字符
		return name.slice(-2)
	}
	// 截取英文名的第一个大写字母
	return name[0]?.toUpperCase() ?? ""
}

/**
 * 绘制文本头像
 * @param text 文本
 * @returns 头像图片
 */
export const drawTextAvatar = (
	text: string,
	bgColor: string | undefined,
	textColor: string | undefined,
): string | null => {
	// 检查缓存中是否已存在
	const cached = map.get(text)
	if (cached) {
		return cached
	}

	// 创建Canvas元素
	const canvas = document.createElement("canvas")
	const size = 200 // 高分辨率以确保质量
	canvas.width = size
	canvas.height = size
	const ctx = canvas.getContext("2d")

	if (!ctx) {
		return null
	}

	// 设置背景色
	const backgroundColor = bgColor ?? textToBackgroundColor(text)
	ctx.fillStyle = backgroundColor
	ctx.fillRect(0, 0, size, size)

	// 确定显示文本
	const displayText = textToDisplayName(text)

	// 设置文本样式
	ctx.fillStyle = textColor ?? "#FFFFFF" // 文本颜色为白色
	ctx.textAlign = "center"
	ctx.textBaseline = "middle"

	// 根据显示文本长度调整字体大小
	const fontSize = displayText.length > 1 ? size * 0.4 : size * 0.5
	ctx.font = `bold ${fontSize}px Arial, sans-serif`

	// 添加文本阴影以增强可读性
	ctx.shadowColor = "rgba(0, 0, 0, 0.3)"
	ctx.shadowBlur = 4
	ctx.shadowOffsetX = 0
	ctx.shadowOffsetY = 1

	// 绘制文本
	ctx.fillText(displayText, size / 2, size / 2 + 5)

	// 转换为base64
	const base64 = canvas.toDataURL("image/png")

	// 将结果缓存
	map.set(text, base64)

	return base64
}
