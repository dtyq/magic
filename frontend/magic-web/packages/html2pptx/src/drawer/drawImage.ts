import type { PPTImageNode, Slide } from "../types/index"
import { log, LogLevel } from "../logger"
import { snapdom } from "@zumer/snapdom"
import { imageToBase64, isGifSource } from "../parsers/parseImage"
import { withAbort } from "../renderer/abort"

const imageBase64Cache = new Map<string, Promise<string>>()

/**
 * 绘制图片到幻灯片
 */
export async function drawImage(
	slide: Slide,
	node: PPTImageNode,
	signal?: AbortSignal,
): Promise<void> {
	const { x, y, w, h, sizing, radius, transparency, rotate } = node
	const src = await resolveImageSource(node, signal)
	if (!src) return

	// 构建图片选项
	const options: Record<string, unknown> = {
		x,
		y,
		w,
		h,
	}

	// 图片统一转为 base64
	options.data = src

	// 旋转角度
	if (rotate !== undefined) {
		options.rotate = rotate
	}

	// 透明度
	if (transparency !== undefined) {
		options.transparency = transparency
	}

	// 设置缩放模式
	if (sizing === "cover" || sizing === "contain") {
		options.sizing = {
			type: sizing,
			w,
			h,
		}
	} else if (sizing === "crop") {
		options.sizing = {
			type: "crop",
			w,
			h,
			x: 0,
			y: 0,
		}
	}

	// 圆角处理（GIF 跳过 Canvas 裁剪以保留动画帧）
	if (radius && radius > 0 && !isGifSource(node.src)) {
		const roundedData = await withAbort({
			task: applyImageRounding(src, radius, w, h, sizing),
			signal,
		})
		if (roundedData) {
			options.data = roundedData
		}
	}
	
	try {
		slide.addImage(options)
	} catch (error) {
		log(LogLevel.L3, "Failed to add image", { src: String(src).slice(0, 80), error: String(error) })
	}
}

/**
 * 使用 Canvas 对图片进行圆角裁剪
 * @param src 图片 Base64 或 URL
 * @param radiusInch 圆角半径（英寸）
 * @param widthInch 图片显示宽度（英寸）
 * @param heightInch 图片显示高度（英寸）
 * @param sizing 缩放模式
 */
async function applyImageRounding(
	src: string,
	radiusInch: number,
	widthInch: number,
	heightInch: number,
	sizing: "cover" | "contain" | "crop" | "stretch" = "cover",
): Promise<string | null> {
	return new Promise((resolve) => {
		const img = new Image()
		img.crossOrigin = "anonymous"
		img.onload = () => {
			const canvas = document.createElement("canvas")
			// 增加分辨率以保证清晰度 (96 DPI * 2)
			const dpiScale = 2
			const w = widthInch * 96 * dpiScale
			const h = heightInch * 96 * dpiScale
			const r = radiusInch * 96 * dpiScale

			canvas.width = w
			canvas.height = h
			const ctx = canvas.getContext("2d")
			if (!ctx) {
				resolve(null)
				return
			}

			// 绘制圆角路径 (使用 arcTo 获得更平滑的圆角)
			ctx.beginPath()
			ctx.moveTo(r, 0)
			ctx.arcTo(w, 0, w, h, r)
			ctx.arcTo(w, h, 0, h, r)
			ctx.arcTo(0, h, 0, 0, r)
			ctx.arcTo(0, 0, w, 0, r)
			ctx.closePath()
			ctx.clip()

			// 计算绘制参数 (模拟 object-fit: cover)
			let dx = 0
			let dy = 0
			let dw = w
			let dh = h

			if (sizing === "cover" || sizing === "contain") {
				const imgRatio = img.width / img.height
				const canvasRatio = w / h

				if (sizing === "cover") {
					if (imgRatio > canvasRatio) {
						// 图片更宽，裁剪两边
						dh = h
						dw = h * imgRatio
						dx = (w - dw) / 2
					} else {
						// 图片更高，裁剪上下
						dw = w
						dh = w / imgRatio
						dy = (h - dh) / 2
					}
				} else {
					// contain
					if (imgRatio > canvasRatio) {
						// 图片更宽，上下留白
						dw = w
						dh = w / imgRatio
						dy = (h - dh) / 2
					} else {
						// 图片更高，左右留白
						dh = h
						dw = h * imgRatio
						dx = (w - dw) / 2
					}
				}
			}

			// 绘制图片
			ctx.drawImage(img, dx, dy, dw, dh)

			resolve(canvas.toDataURL("image/png"))
		}
		img.onerror = () => resolve(null)
		img.src = src
	})
}

async function resolveImageSource(
	node: PPTImageNode,
	signal?: AbortSignal,
): Promise<string | null> {
	if (node.capture === "snapdom" && node.captureElement) {
		if (node.captureBackgroundOnly) {
			return withAbort({
				task: captureBackgroundToDataUrl(node.captureElement, node.w, node.h),
				signal,
			})
		}
		return withAbort({
			task: captureElementToDataUrl(node.captureElement),
			signal,
		})
	}
	if (node.src.startsWith("data:")) return node.src
	try {
		return await withAbort({
			task: getCachedBase64(node.src),
			signal,
		})
	} catch (error) {
		log(LogLevel.L3, "base64 convert failed", { src: node.src.slice(0, 80), error: String(error) })
		return null
	}
}

function getCachedBase64(src: string): Promise<string> {
	const cached = imageBase64Cache.get(src)
	if (cached) return cached

	const task = imageToBase64(src).catch((error) => {
		// 转换失败时移除缓存，允许后续重试
		imageBase64Cache.delete(src)
		throw error
	})
	imageBase64Cache.set(src, task)
	return task
}

/**
 * 仅截取元素的 CSS 背景（不含子元素内容）
 * 通过创建一个仅有背景样式的临时 div 来实现隔离截图
 * 用于处理多值渐变背景（如网格线效果）的降级导出
 */
async function captureBackgroundToDataUrl(
	element: Element,
	widthInch: number,
	heightInch: number,
): Promise<string | null> {
	const doc = element.ownerDocument
	const win = doc?.defaultView
	if (!doc || !win) return null

	const computedStyle = win.getComputedStyle(element)
	const rect = element.getBoundingClientRect()

	// 创建仅含背景样式的临时 div，附加在 body 末尾（屏幕外不可见）
	const tempDiv = doc.createElement("div")
	tempDiv.style.cssText = `
		position: fixed;
		left: -99999px;
		top: -99999px;
		width: ${rect.width}px;
		height: ${rect.height}px;
		background-image: ${computedStyle.backgroundImage};
		background-size: ${computedStyle.backgroundSize};
		background-position: ${computedStyle.backgroundPosition};
		background-repeat: ${computedStyle.backgroundRepeat};
		background-color: ${computedStyle.backgroundColor};
		border-radius: ${computedStyle.borderRadius};
		opacity: ${computedStyle.opacity};
		pointer-events: none;
	`
	doc.body.appendChild(tempDiv)

	try {
		const result = await snapdom(tempDiv, { embedFonts: false, cache: "auto" })
		const canvas = await result.toCanvas()
		return canvas.toDataURL("image/png")
	} catch (error) {
		log(LogLevel.L3, "background-only capture failed, fallback to null", { error: String(error) })
		return null
	} finally {
		if (tempDiv.parentNode) tempDiv.parentNode.removeChild(tempDiv)
	}
}

async function captureElementToDataUrl(
	element: Element,
): Promise<string | null> {
	try {
		// 确保元素仍在 DOM 中
		if (!element.isConnected) {
			log(LogLevel.L3, "Element is not connected to DOM")
			return null
		}

		// 使用 snapdom 捕获元素（作为回退方案）
		const result = await snapdom(element, {
			embedFonts: true,
			cache: "auto",
		})

		const canvas = await result.toCanvas()
		return canvas.toDataURL("image/png")
	} catch (error) {
		log(LogLevel.L3, "snapdom capture failed", { error: String(error) })
		return null
	}
}

