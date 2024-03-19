import {
	SMALL_THUMBNAIL_MAX_SIZE,
	TOOLTIP_THUMBNAIL_MIN_SIZE,
	COMPRESSED_WEBP_QUALITY,
	COMPRESSED_JPEG_QUALITY,
	getCompressedQuality,
} from "./imageThumbnailConstants"

export { SMALL_THUMBNAIL_MAX_SIZE, TOOLTIP_THUMBNAIL_MIN_SIZE } from "./imageThumbnailConstants"

/** WebP 支持缓存（一次性检测） */
let webpSupported: boolean | null = null

/**
 * 在空闲时调度任务，避免占用主进程
 */
export function scheduleIdleTask<T>(fn: () => Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		const run = () => Promise.resolve(fn()).then(resolve, reject)
		if (typeof requestIdleCallback !== "undefined") {
			requestIdleCallback(() => run(), { timeout: 2000 })
		} else {
			setTimeout(() => run(), 0)
		}
	})
}

/**
 * 检测 WebP 是否支持
 */
export function checkWebpSupport(): boolean {
	if (webpSupported !== null) {
		return webpSupported
	}
	try {
		const canvas = document.createElement("canvas")
		canvas.width = canvas.height = 1
		const ctx = canvas.getContext("2d")
		if (!ctx) return false
		ctx.fillStyle = "transparent"
		ctx.fillRect(0, 0, 1, 1)
		const dataUrl = canvas.toDataURL("image/webp")
		webpSupported = dataUrl.startsWith("data:image/webp")
	} catch {
		webpSupported = false
	}
	return webpSupported
}

/**
 * 将 blob 直接转为 base64 data URL（保留原始格式，无重编码）
 * 用于原图尺寸已小于目标时跳过压缩
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = reject
		reader.readAsDataURL(blob)
	})
}

/**
 * 将 bitmap 转为 base64（WebP 优先，降级 JPEG）
 */
export async function bitmapToDataUrl(bitmap: ImageBitmap, quality: number): Promise<string> {
	const w = bitmap.width
	const h = bitmap.height
	const canvas =
		typeof OffscreenCanvas !== "undefined"
			? new OffscreenCanvas(w, h)
			: document.createElement("canvas")
	canvas.width = w
	canvas.height = h
	const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null
	if (!ctx) return Promise.resolve("")
	ctx.drawImage(bitmap, 0, 0)
	bitmap.close()

	const canvasToDataUrl = (mimeType: "image/webp" | "image/jpeg", q: number): Promise<string> => {
		if (canvas instanceof OffscreenCanvas) {
			return canvas.convertToBlob({ type: mimeType, quality: q }).then(
				(b) =>
					new Promise<string>((res, rej) => {
						const r = new FileReader()
						r.onload = () => res(r.result as string)
						r.onerror = rej
						r.readAsDataURL(b)
					}),
			)
		}
		const dataUrl = (canvas as HTMLCanvasElement).toDataURL(mimeType, q)
		return Promise.resolve(dataUrl || "")
	}

	const preferWebp = checkWebpSupport()
	if (preferWebp) {
		try {
			const dataUrl = await canvasToDataUrl("image/webp", quality)
			if (dataUrl && dataUrl.startsWith("data:image/webp")) return dataUrl
		} catch {
			// WebP 失败，降级 JPEG
		}
	}
	return canvasToDataUrl("image/jpeg", quality)
}

/**
 * 从 blob 生成指定尺寸的 base64 小图（在空闲时执行）
 */
export async function generateSmallFromBlob(blob: Blob): Promise<string> {
	return scheduleIdleTask(async () => {
		const bitmap = await createImageBitmap(blob, {
			resizeWidth: SMALL_THUMBNAIL_MAX_SIZE,
			resizeQuality: "high",
		})
		return await bitmapToDataUrl(bitmap, 0.9)
	})
}

/**
 * 从 blob 生成 tooltip/popover 缩略图（按宽度等比缩放，与 small 一致）
 */
export async function generateTooltipFromBlob(blob: Blob): Promise<string> {
	return scheduleIdleTask(async () => {
		const bitmap = await createImageBitmap(blob, {
			resizeWidth: TOOLTIP_THUMBNAIL_MIN_SIZE,
			resizeQuality: "high",
		})
		return await bitmapToDataUrl(bitmap, 0.95)
	})
}

/**
 * 从 blob 生成压缩图（保持原图尺寸，优先 WebP，降级 JPEG，质量按原图大小动态设定）
 * @returns { dataUrl, width, height }
 */
export async function generateCompressedFromBlob(
	blob: Blob,
): Promise<{ dataUrl: string; width: number; height: number }> {
	return scheduleIdleTask(async () => {
		const bitmap = await createImageBitmap(blob)
		const width = bitmap.width
		const height = bitmap.height
		const pixelCount = width * height
		const fileSize = blob.size
		const useWebp = checkWebpSupport()
		const quality = getCompressedQuality(
			pixelCount,
			fileSize,
			useWebp ? COMPRESSED_WEBP_QUALITY : COMPRESSED_JPEG_QUALITY,
		)
		const dataUrl = await bitmapToDataUrl(bitmap, quality)
		return { dataUrl, width, height }
	})
}
