/**
 * 基于头像地址, 使用 canvas 绘制正方形群头像，支持多列多行, 返回 base64 图片
 * @param urls 头像地址
 * @param options 配置
 * @param options.size 头像大小 默认 300
 * @param options.gap 头像间距 默认 10
 * @param options.borderRadius 每个头像的圆角 默认 10
 * @param options.col 列数 默认 2
 * @returns base64 图片
 */
export function drawGroupAvatar(
	urls: string[],
	options: { size: number; gap: number; borderRadius: number; col: 2 | 3 },
	c?: HTMLCanvasElement,
) {
	const { size = 340, gap = 10, col = 3 } = options

	const canvas = c || document.createElement("canvas")
	canvas.width = size * col + gap * (col - 1)
	canvas.height = size * col + gap * (col - 1)

	const ctx = canvas.getContext("2d")
	if (!ctx) return ""

	// 创建一个 Promise 数组来处理所有图片加载
	const loadImages = urls.slice(0, col * col + 1).map((url, index) => {
		return new Promise<void>((resolve) => {
			const image = new Image()
			image.crossOrigin = "anonymous"

			image.onload = () => {
				// 保存当前的绘图状态
				ctx.save()

				const x = (index % col) * (size + gap)
				const y = Math.floor(index / col) * (size + gap)

				// // 左上角圆角
				// ctx.beginPath()
				// ctx.arc(x + borderRadius, y + borderRadius, borderRadius, 0, Math.PI / 2)
				// ctx.clip()

				// // 右上角圆角
				// ctx.beginPath()
				// ctx.arc(x + size - borderRadius, y + borderRadius, borderRadius, Math.PI / 2, Math.PI)
				// ctx.clip()

				// // 左下角圆角
				// ctx.beginPath()
				// ctx.arc(x + borderRadius, y + size - borderRadius, borderRadius, Math.PI, Math.PI * 3 / 2)
				// ctx.clip()

				// // 右下角圆角
				// ctx.beginPath()
				// ctx.arc(x + size - borderRadius, y + size - borderRadius, borderRadius, 0, Math.PI / 2)
				// ctx.clip()

				// 计算图片缩放和位置以保持比例
				let drawWidth = size
				let drawHeight = size
				let offsetX = 0
				let offsetY = 0

				const ratio = image.width / image.height
				if (ratio > 1) {
					// 图片更宽
					drawWidth = size * ratio
					offsetX = -(drawWidth - size) / 2
				} else if (ratio < 1) {
					// 图片更高
					drawHeight = size / ratio
					offsetY = -(drawHeight - size) / 2
				}

				// 绘制图片
				ctx.drawImage(image, x + offsetX, y + offsetY, drawWidth, drawHeight)

				// 恢复绘图状态
				ctx.restore()
				resolve()
			}

			image.onerror = () => {
				// 图片加载失败时也要resolve，以免阻塞其他图片
				resolve()
			}

			image.src = url
		})
	})

	// 等待所有图片加载完成后返回结果
	return new Promise<string>((resolve) => {
		Promise.all(loadImages).then(() => {
			resolve(canvas?.toDataURL())
		})
	})
}
