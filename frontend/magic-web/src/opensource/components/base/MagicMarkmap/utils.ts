import { ensureMarkmapInitialized, transformer } from "./markmap"

export async function exportMarkmapToPng(
	data: string,
	width: number = 3840,
	height: number = 2160,
) {
	await ensureMarkmapInitialized()
	const { Markmap } = await import("markmap-view")

	return new Promise<Blob>((resolve, reject) => {
		// Use IIFE to handle async operations
		;(async () => {
			try {
				const tempContainer = document.createElement("div")
				tempContainer.style.cssText = `
					position: fixed;
					top: -9999px;
					left: -9999px;
					width: ${width}px;
					height: ${height}px;
					visibility: hidden;
					background: #fff;
				`
				document.body.appendChild(tempContainer)

				// 克隆SVG到临时容器
				const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")

				// 清空克隆的SVG内容
				while (tempSvg.firstChild) {
					tempSvg.removeChild(tempSvg.firstChild)
				}

				tempSvg.setAttribute("width", `${width}px`)
				tempSvg.setAttribute("height", `${height}px`)
				tempSvg.style.width = `${width}px`
				tempSvg.style.height = `${height}px`
				tempContainer.appendChild(tempSvg)

				// 创建新的 Markmap 实例并设置数据
				const mm = Markmap.create(tempSvg, {
					autoFit: true,
					pan: false,
					zoom: false,
				})
				const { root } = transformer.transform(data)
				// setData is async in markmap-view 0.18.0+, must await it
				await mm.setData(root)

				// 等待渲染完成
				setTimeout(() => {
					// 克隆处理后的SVG以处理样式
					const clonedSvg = tempSvg.cloneNode(true) as SVGElement
					clonedSvg.setAttribute("width", `${width}px`)
					clonedSvg.setAttribute("height", `${height}px`)

					// 内联样式
					const styless = document.getElementsByTagName("style")
					const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
					Array.from(styless).forEach((style) => {
						defs.appendChild(style.cloneNode(true))
					})
					clonedSvg.insertBefore(defs, clonedSvg.firstChild)

					// 获取SVG数据并添加XML声明
					const svgData = new XMLSerializer().serializeToString(clonedSvg)
					const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
						${svgData}`

					// 使用 base64 编码
					const svgBase64 = `data:image/svg+xml;base64,${btoa(
						unescape(encodeURIComponent(svgContent)),
					)}`

					// 创建Image对象
					const img = new Image()
					img.crossOrigin = "anonymous"
					img.onload = () => {
						// 创建canvas，确保尺寸为4K
						const canvas = document.createElement("canvas")
						canvas.width = width // 4K宽度
						canvas.height = height // 4K高度

						const ctx = canvas.getContext("2d", { alpha: false })
						if (!ctx) {
							reject(new Error("Failed to get 2d context"))
							document.body.removeChild(tempContainer)
							mm.destroy()
							return
						}
						ctx.imageSmoothingEnabled = true
						ctx.imageSmoothingQuality = "high"

						// 先填充白色背景
						ctx.fillStyle = "#ffffff"
						ctx.fillRect(0, 0, canvas.width, canvas.height)

						// 然后绘制图片
						ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

						// 转换为PNG并下载
						canvas.toBlob(
							(blob) => {
								if (blob) {
									resolve(blob)
								}
								// 清理临时DOM
								document.body.removeChild(tempContainer)
								mm.destroy()
							},
							"image/png",
							1.0,
						)
					}

					img.src = svgBase64
				}, 1000)
			} catch (error) {
				reject(error)
			}
		})()
	})
}
