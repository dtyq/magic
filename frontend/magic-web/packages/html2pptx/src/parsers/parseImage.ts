import type { ElementNode, PPTImageNode, PPTNodeBase, SlideConfig } from "../types/index"
import { log, LogLevel } from "../logger"
import { getEffectiveOpacity } from "../utils/color"
import { pxToInch, resolveEffectiveRadius, getGlobalTransform } from "../utils/unit"

/**
 * 解析图片 (IMG 标签或 background-image)
 */
export function parseImage(
	node: ElementNode,
	base: PPTNodeBase,
	config: SlideConfig,
	iWindow: Window,
): PPTImageNode | null {
	const { tagName, style, element, rect } = node

	// 计算累积透明度
	const opacity = getEffectiveOpacity(element)
	const transparency = opacity < 1 ? Math.round((1 - opacity) * 100) : undefined

	const radiusPx = resolveEffectiveRadius(node)
	const radius = radiusPx > 0 ? pxToInch(radiusPx, config) : undefined

	// 处理变换修正 (旋转 + 缩放)
	const { rotation, scaleX, scaleY } = getGlobalTransform(node)
	
	let finalRect = { ...base }
	let rotate = rotation !== 0 ? rotation : undefined

	// 只要有旋转或显著缩放，就进行修正
	if (rotate || Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
		// 使用 layout (原始尺寸) * 累积缩放比例
		const realW = node.layout.offsetWidth * scaleX
		const realH = node.layout.offsetHeight * scaleY

		// 计算当前外接矩形的中心点
		const cx = rect.x + rect.w / 2
		const cy = rect.y + rect.h / 2

		// 倒推变换前的左上角
		const x = cx - realW / 2
		const y = cy - realH / 2

		finalRect.x = pxToInch(x, config)
		finalRect.y = pxToInch(y, config)
		finalRect.w = pxToInch(realW, config)
		finalRect.h = pxToInch(realH, config)
	}

	// 处理 IMG 标签
	if (tagName === "IMG") {
		const imgElement = element as HTMLImageElement
		const src = imgElement.src || imgElement.getAttribute("src")

		if (!src) return null

		// 按 CSS object-fit 映射缩放模式，避免默认 cover 导致裁切
		const objectFit = (style.objectFit || "").trim().toLowerCase()
		let sizing: "cover" | "contain" | "stretch" = "stretch"
		if (objectFit === "cover") sizing = "cover"
		else if (objectFit === "contain" || objectFit === "scale-down" || objectFit === "none") sizing = "contain"
		else if (objectFit === "fill" || !objectFit) sizing = "stretch"

		return {
			...finalRect,
			type: "image",
			src,
			sizing,
			transparency,
			radius, // 应用圆角
			rotate, // 应用旋转
		}
	}

	// 处理 background-image
	const bgImage = style.backgroundImage
	if (!bgImage || bgImage === "none") return null

	// 跳过渐变背景（由 parseShape 处理）
	if (bgImage.includes("gradient")) return null

	// 提取 url() 中的图片地址
	const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/)
	if (!urlMatch || !urlMatch[1]) return null

	const src = urlMatch[1]

	// 解析 background-size 确定缩放模式
	const bgSize = style.backgroundSize
	let sizing: "cover" | "contain" | "stretch" = "cover"
	if (bgSize === "contain") sizing = "contain"
	else if (bgSize === "100% 100%" || bgSize === "stretch") sizing = "stretch"

	return {
		...finalRect,
		type: "image",
		src,
		sizing,
		transparency,
		radius, // 应用圆角
		rotate, // 应用旋转
	}
}

/**
 * 加载图片并获取尺寸
 */
export function loadImageSize(src: string): Promise<{ w: number; h: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.crossOrigin = "anonymous"

		img.onload = () => {
			resolve({ w: img.width, h: img.height })
		}

		img.onerror = () => {
			reject(new Error(`Failed to load image: ${src}`))
		}

		img.src = src
	})
}

/**
 * 判断图片源是否为 GIF 格式
 */
export function isGifSource(src: string): boolean {
	if (src.startsWith("data:image/gif")) return true
	try {
		const pathname = new URL(src, window.location.href).pathname
		return pathname.toLowerCase().endsWith(".gif")
	} catch {
		return src.toLowerCase().includes(".gif")
	}
}

/**
 * 将图片转换为 base64
 * GIF 走 fetch 原始字节以保留动画帧，其余走 Canvas 转 PNG
 */
export async function imageToBase64(src: string): Promise<string> {
	if (isGifSource(src)) return fetchAsBase64(src, "image/gif")

	return new Promise((resolve, reject) => {
		const img = new Image()
		img.crossOrigin = "anonymous"

		img.onload = () => {
			const canvas = document.createElement("canvas")
			canvas.width = img.width
			canvas.height = img.height

			const ctx = canvas.getContext("2d")
			if (!ctx) {
				reject(new Error("Failed to get canvas context"))
				return
			}

			ctx.drawImage(img, 0, 0)
			resolve(canvas.toDataURL("image/png"))
		}

		img.onerror = () => {
			reject(new Error(`Failed to convert image to base64: ${src}`))
		}

		img.src = src
	})
}

/**
 * 通过 fetch 获取图片原始字节并转为 base64 data URL，保留完整二进制内容（如 GIF 动画帧）
 */
async function fetchAsBase64(src: string, mimeType: string): Promise<string> {
	const response = await fetch(src)
	if (!response.ok) throw new Error(`Failed to fetch image: ${src} (${response.status})`)

	const blob = await response.blob()
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onloadend = () => {
			if (typeof reader.result === "string") resolve(reader.result)
			else reject(new Error("FileReader did not return a string"))
		}
		reader.onerror = () => reject(new Error(`Failed to read blob for: ${src}`))
		reader.readAsDataURL(new Blob([blob], { type: mimeType }))
	})
}
