import chatDb from "@/opensource/database/chat"
import AvatarStore from "@/opensource/stores/chatNew/avatar"
import { textToBackgroundColor, textToDisplayName } from "./utils"

class AvatarService {
	constructor() {
		// 初始化文本头像缓存
		chatDb
			.getTextAvatarTable()
			?.toArray()
			.then((res) => {
				AvatarStore.init(res)
			})
	}

	/**
	 * 绘制文本头像
	 * @param text 文本
	 * @returns 头像图片
	 */
	drawTextAvatar(
		text: string,
		bgColor: string | undefined,
		textColor: string | undefined,
	): string | null {
		// 检查缓存中是否已存在
		const cached = AvatarStore.getTextAvatar(text)
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
		AvatarStore.setTextAvatar(text, base64)

		// 保存到数据库
		chatDb.getTextAvatarTable()?.put({ text, base64 })

		return base64
	}
}

export default new AvatarService()
