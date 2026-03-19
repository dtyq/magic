/**
 * 将svg转换为png
 * @param svg - svg字符串
 * @param width - 宽度
 * @param height - 高度，可选参数。当提供时，会在保持比例的前提下限制最大高度
 * @returns Promise<string> 返回图片base64字符串，失败时抛出错误
 */
export const convertSvgToPng = (
	svg: string,
	width: number = 600,
	height?: number,
): Promise<string> => {
	return new Promise((resolve, reject) => {
		try {
			const canvas = document.createElement("canvas")
			const ctx = canvas.getContext("2d")
			if (!ctx) {
				throw new Error("无法获取canvas上下文")
			}

			const img = new Image()
			// 处理加载错误
			img.onerror = () => reject(new Error("SVG图片加载失败"))

			// 在图片加载完成后进行转换
			img.onload = () => {
				try {
					// 获取SVG原始尺寸信息
					const parser = new DOMParser()
					const svgDoc = parser.parseFromString(svg, "image/svg+xml")
					const svgElement = svgDoc.documentElement

					// 尝试从SVG中获取宽高信息
					let originalWidth
					let originalHeight

					if (svgElement.hasAttribute("width") && svgElement.hasAttribute("height")) {
						originalWidth = parseFloat(svgElement.getAttribute("width") || "0")
						originalHeight = parseFloat(svgElement.getAttribute("height") || "0")
					} else if (svgElement.hasAttribute("viewBox")) {
						const viewBox = svgElement.getAttribute("viewBox")?.split(/\s+/)
						if (viewBox && viewBox.length >= 4) {
							originalWidth = parseFloat(viewBox[2])
							originalHeight = parseFloat(viewBox[3])
						}
					}

					// 如果无法从SVG获取尺寸，使用图像的天然尺寸
					if (
						!originalWidth ||
						!originalHeight ||
						originalWidth <= 0 ||
						originalHeight <= 0
					) {
						originalWidth = img.naturalWidth || width
						originalHeight = img.naturalHeight || width * 0.75 // 默认4:3比例
					}

					// 计算宽高比
					const aspectRatio = originalHeight / originalWidth

					// 计算目标尺寸，始终以width为基准
					const targetWidth = width
					let targetHeight = Math.round(width * aspectRatio)

					// 仅当传入height参数时才限制高度
					if (typeof height === "number" && height > 0) {
						if (targetHeight > height) {
							targetHeight = height
						}
					}

					// 设置画布尺寸
					canvas.width = targetWidth
					canvas.height = targetHeight

					// 绘制图像
					ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

					// 转换为PNG
					const pngUrl = canvas.toDataURL("image/png")
					resolve(pngUrl)
				} catch (err) {
					reject(new Error(`PNG转换失败: ${err}`))
				}
			}

			// 将SVG转换为base64并设置图片源
			const svgBase64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
			img.src = svgBase64
		} catch (err) {
			reject(new Error(`SVG处理失败: ${err}`))
		}
	})
}
