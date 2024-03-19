/**
 * ImageSource 工具模块
 * 统一 HTMLImageElement 与 ImageBitmap 的抽象，优先使用 ImageBitmap（更省内存、可 transferable）
 * 在不支持的环境中自动降级为 HTMLImageElement
 */

/** 可绘制图片源：Canvas drawImage / Konva 均支持 */
export type ImageSource = HTMLImageElement | ImageBitmap

/** 获取图片源尺寸（统一 naturalWidth/naturalHeight 与 width/height） */
export function getImageSourceDimensions(src: ImageSource): { width: number; height: number } {
	if ("naturalWidth" in src && typeof src.naturalWidth === "number") {
		return { width: src.naturalWidth, height: src.naturalHeight }
	}
	return { width: src.width, height: src.height }
}

/** 释放 ImageBitmap 资源，HTMLImageElement 无需显式释放 */
export function closeImageSource(src: ImageSource): void {
	if (isImageBitmap(src)) {
		src.close()
	}
}

/** 类型守卫 */
export function isImageBitmap(src: ImageSource): src is ImageBitmap {
	return typeof (src as ImageBitmap).close === "function"
}

/**
 * 从 Blob 创建可绘制图片源
 * 优先尝试 ImageBitmap（现代浏览器、零拷贝、省内存），失败则降级为 HTMLImageElement
 */
export async function createImageSourceFromBlob(blob: Blob): Promise<ImageSource | null> {
	// 1. 优先 ImageBitmap（Safari 15+、Chrome 50+、Firefox 42+）
	if (typeof createImageBitmap === "function") {
		try {
			const bitmap = await createImageBitmap(blob)
			return bitmap
		} catch {
			// 解码失败（损坏图片、不支持格式等）时降级
		}
	}

	// 2. 降级：HTMLImageElement + blob URL
	const blobUrl = URL.createObjectURL(blob)
	try {
		const img = await new Promise<HTMLImageElement | null>((resolve) => {
			const image = new Image()
			image.crossOrigin = "anonymous"
			image.onload = () => resolve(image)
			image.onerror = () => resolve(null)
			image.src = blobUrl
		})
		return img
	} finally {
		URL.revokeObjectURL(blobUrl)
	}
}
