import { processSvgContent } from "./svgProcessor"

export interface SvgToPngOptions {
	maxWidth?: number
	maxHeight?: number
	maxPixels?: number
}

interface SvgDimensions {
	width: number
	height: number
}

function removeUnpairedSurrogates(value: string): string {
	let result = ""

	for (let i = 0; i < value.length; i += 1) {
		const current = value.charCodeAt(i)

		if (current >= 0xd800 && current <= 0xdbff) {
			const next = value.charCodeAt(i + 1)
			if (next >= 0xdc00 && next <= 0xdfff) {
				result += value[i] + value[i + 1]
				i += 1
			}
			continue
		}

		if (current >= 0xdc00 && current <= 0xdfff) {
			continue
		}

		result += value[i]
	}

	return result
}

function normalizeSvgSource(svg: string): string {
	const processedSvg = processSvgContent(svg)
	const normalizedSvg = processedSvg.isValid ? processedSvg.content : svg

	return removeUnpairedSurrogates(normalizedSvg).replaceAll(String.fromCharCode(0), "")
}

async function resolveSvgSource(svgSource: string): Promise<string> {
	if (!svgSource) {
		throw new Error("SVG内容为空")
	}

	if (svgSource.trim().startsWith("<svg") || svgSource.startsWith("data:image/svg+xml")) {
		return normalizeSvgSource(svgSource)
	}

	try {
		const response = await fetch(svgSource)
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`)
		}

		return normalizeSvgSource(await response.text())
	} catch (error) {
		throw new Error(`SVG内容加载失败: ${error}`)
	}
}

function getSvgDimensions(
	svg: string,
	fallbackWidth: number,
	fallbackHeight: number,
): SvgDimensions {
	const parser = new DOMParser()
	const svgDoc = parser.parseFromString(svg, "image/svg+xml")
	const svgElement = svgDoc.documentElement

	let width = 0
	let height = 0

	if (svgElement.hasAttribute("width") && svgElement.hasAttribute("height")) {
		width = parseFloat(svgElement.getAttribute("width") || "0")
		height = parseFloat(svgElement.getAttribute("height") || "0")
	} else if (svgElement.hasAttribute("viewBox")) {
		const viewBox = svgElement.getAttribute("viewBox")?.split(/\s+/)
		if (viewBox && viewBox.length >= 4) {
			width = parseFloat(viewBox[2])
			height = parseFloat(viewBox[3])
		}
	}

	if (width > 0 && height > 0) {
		return { width, height }
	}

	return {
		width: fallbackWidth > 0 ? fallbackWidth : 1,
		height: fallbackHeight > 0 ? fallbackHeight : Math.max(1, Math.round(fallbackWidth * 0.75)),
	}
}

function constrainSvgSize(size: SvgDimensions, options: SvgToPngOptions = {}): SvgDimensions {
	const { maxWidth, maxHeight, maxPixels } = options

	let { width, height } = size

	if (maxWidth && width > maxWidth) {
		const ratio = maxWidth / width
		width = maxWidth
		height = Math.max(1, Math.round(height * ratio))
	}

	if (maxHeight && height > maxHeight) {
		const ratio = maxHeight / height
		height = maxHeight
		width = Math.max(1, Math.round(width * ratio))
	}

	if (maxPixels && width * height > maxPixels) {
		const ratio = Math.sqrt(maxPixels / (width * height))
		width = Math.max(1, Math.floor(width * ratio))
		height = Math.max(1, Math.floor(height * ratio))
	}

	return { width, height }
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()

		reader.onloadend = () => {
			if (typeof reader.result !== "string") {
				reject(new Error("PNG结果读取失败"))
				return
			}

			resolve(reader.result)
		}

		reader.onerror = () => {
			reject(reader.error ?? new Error("PNG结果读取失败"))
		}

		reader.readAsDataURL(blob)
	})
}

function renderSvgWithNativeImage(
	svgUrl: string,
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const image = new Image()

		image.onload = () => {
			ctx.drawImage(image, 0, 0, width, height)
			resolve()
		}

		image.onerror = () => {
			reject(new Error("浏览器原生SVG渲染失败"))
		}

		image.src = svgUrl
	})
}

/**
 * 将svg转换为png
 * @param svg - svg字符串
 * @param width - 宽度
 * @param height - 高度，可选参数。当提供时，会在保持比例的前提下限制最大高度
 * @param options - 可选的导出尺寸限制
 * @returns Promise<string> 返回图片base64字符串，失败时抛出错误
 */
export async function convertSvgToPngBlob(
	svgSource: string,
	width: number = 600,
	height?: number,
	options: SvgToPngOptions = {},
): Promise<Blob> {
	const normalizedSvg = await resolveSvgSource(svgSource)
	const canvas = document.createElement("canvas")
	const ctx = canvas.getContext("2d")

	if (!ctx) {
		throw new Error("无法获取canvas上下文")
	}

	const svgBlob = new Blob([normalizedSvg], { type: "image/svg+xml;charset=utf-8" })
	const svgUrl = URL.createObjectURL(svgBlob)

	const cleanup = () => {
		URL.revokeObjectURL(svgUrl)
		canvas.width = 0
		canvas.height = 0
	}

	try {
		const originalSize = getSvgDimensions(normalizedSvg, width, 0)
		const aspectRatio = originalSize.height / originalSize.width

		const targetWidth = width
		let targetHeight = Math.round(width * aspectRatio)

		if (typeof height === "number" && height > 0 && targetHeight > height) {
			targetHeight = height
		}

		const constrainedSize = constrainSvgSize(
			{
				width: Math.max(1, Math.round(targetWidth)),
				height: Math.max(1, Math.round(targetHeight)),
			},
			options,
		)

		canvas.width = constrainedSize.width
		canvas.height = constrainedSize.height

		await renderSvgWithNativeImage(svgUrl, ctx, constrainedSize.width, constrainedSize.height)

		return await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob((result) => {
				if (!result) {
					reject(new Error("PNG转换失败: 输出为空"))
					return
				}

				resolve(result)
			}, "image/png")
		})
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === "无法获取canvas上下文") {
				throw error
			}
		}

		throw new Error(`PNG转换失败: ${error}`)
	} finally {
		cleanup()
	}
}

/**
 * 将svg转换为png data url
 * @param svgSource - svg字符串、data url 或 svg 文件地址
 * @param width - 宽度
 * @param height - 高度，可选参数
 * @param options - 可选的导出尺寸限制
 * @returns Promise<string> 返回图片base64字符串
 */
export async function convertSvgToPng(
	svgSource: string,
	width: number = 600,
	height?: number,
	options: SvgToPngOptions = {},
): Promise<string> {
	const blob = await convertSvgToPngBlob(svgSource, width, height, options)

	return readBlobAsDataUrl(blob)
}
