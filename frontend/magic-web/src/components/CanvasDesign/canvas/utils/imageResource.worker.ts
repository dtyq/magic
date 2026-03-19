import {
	SMALL_THUMBNAIL_MAX_SIZE,
	// TOOLTIP_THUMBNAIL_MIN_SIZE, // 已废弃：tooltip场景直接用ossSrc渲染
	// COMPRESSED_WEBP_QUALITY,
	// COMPRESSED_JPEG_QUALITY,
	// getCompressedQuality,
} from "./imageThumbnailConstants"

export interface ImageResourceWorkerRequest {
	ossSrc: string
	filename?: string
	requestId: string
}

export interface ImageResourceWorkerResponse {
	requestId: string
	/** ImageBitmap（优先，通过 transferable 零拷贝传递） */
	imageSource?: ImageBitmap
	/** Blob（降级方案，当不支持 ImageBitmap 时使用） */
	blob?: Blob
	/** 403/401 时置为 true，主线程需重新换取 ossSrc */
	needsReExchange?: boolean
	/** 文件信息 */
	imageInfo?: {
		naturalWidth: number
		naturalHeight: number
		fileSize: number
		mimeType: string
		filename: string
	}
	/** 缩略图 */
	thumbnails: {
		small: string
	}
	/** 错误信息 */
	error?: string
}

function extractFilenameFromUrl(url: string): string | null {
	try {
		const urlObj = new URL(url)
		const pathname = urlObj.pathname
		const parts = pathname.split("/")
		const filename = parts[parts.length - 1]
		return filename ? decodeURIComponent(filename) : null
	} catch {
		const parts = url.split("/")
		const filename = parts[parts.length - 1]
		const cleanFilename = filename?.split("?")[0]
		return cleanFilename ? decodeURIComponent(cleanFilename) : null
	}
}

function getFileExtensionFromMimeType(mimeType: string): string {
	const mimeTypeToExtension: Record<string, string> = {
		"image/png": "png",
		"image/jpeg": "jpeg",
		"image/jpg": "jpg",
		"image/gif": "gif",
		"image/webp": "webp",
		"image/svg+xml": "svg",
		"image/bmp": "bmp",
		"image/x-icon": "ico",
	}
	if (mimeTypeToExtension[mimeType]) {
		return mimeTypeToExtension[mimeType]
	}
	const parts = mimeType.split("/")
	if (parts.length === 2) {
		const subtype = parts[1]
		const extension = subtype.split("+")[0]
		return extension.replace(/^x-/, "")
	}
	return "png"
}

let webpSupported: boolean | null = null

async function checkWebpSupportInWorker(): Promise<boolean> {
	if (webpSupported !== null) return webpSupported
	try {
		const canvas = new OffscreenCanvas(1, 1)
		const ctx = canvas.getContext("2d")
		if (!ctx) return false
		ctx.fillStyle = "transparent"
		ctx.fillRect(0, 0, 1, 1)
		const blob = await canvas.convertToBlob({ type: "image/webp" })
		const dataUrl = await blobToDataUrl(blob)
		webpSupported = dataUrl.startsWith("data:image/webp")
	} catch {
		webpSupported = false
	}
	return webpSupported
}

async function canvasToDataUrlViaBlob(
	canvas: OffscreenCanvas,
	mimeType: "image/webp" | "image/jpeg",
	quality: number,
): Promise<string> {
	const blob = await canvas.convertToBlob({ type: mimeType, quality })
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = reject
		reader.readAsDataURL(blob)
	})
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = reject
		reader.readAsDataURL(blob)
	})
}

async function bitmapToDataUrl(bitmap: ImageBitmap, quality: number): Promise<string> {
	const w = bitmap.width
	const h = bitmap.height
	const canvas = new OffscreenCanvas(w, h)
	const ctx = canvas.getContext("2d")
	if (!ctx) return ""
	ctx.drawImage(bitmap, 0, 0)
	bitmap.close()

	const useWebp = await checkWebpSupportInWorker()
	if (useWebp) {
		try {
			const dataUrl = await canvasToDataUrlViaBlob(canvas, "image/webp", quality)
			if (dataUrl.startsWith("data:image/webp")) return dataUrl
		} catch {
			// fallback to jpeg
		}
	}
	return canvasToDataUrlViaBlob(canvas, "image/jpeg", quality)
}

/**
 * 检测 Worker 环境是否支持 ImageBitmap
 */
function isImageBitmapSupported(): boolean {
	return typeof createImageBitmap === "function"
}

async function processRequest(
	request: ImageResourceWorkerRequest,
): Promise<ImageResourceWorkerResponse> {
	const { ossSrc, filename: passedFilename, requestId } = request

	try {
		const response = await fetch(ossSrc, { cache: "default" })
		if (!response.ok) {
			const needsReExchange = response.status === 401 || response.status === 403
			return {
				requestId,
				error: `Fetch failed: ${response.status}`,
				thumbnails: { small: "" }, // 错误情况下返回空 thumbnails（不会被使用）
				...(needsReExchange && { needsReExchange: true }),
			}
		}

		const blob = await response.blob()
		const contentType = blob.type || "image/jpeg"
		const fileSize = blob.size
		const extractedFilename = extractFilenameFromUrl(ossSrc)
		const filename =
			passedFilename ||
			extractedFilename ||
			`image.${getFileExtensionFromMimeType(contentType)}`

		// 检测是否支持 ImageBitmap
		const supportsImageBitmap = isImageBitmapSupported()

		let naturalWidth: number
		let naturalHeight: number
		let maxDim: number

		if (supportsImageBitmap) {
			// 支持 ImageBitmap：创建用于获取尺寸信息的 bitmap（稍后关闭）
			const sizeBitmap = await createImageBitmap(blob)
			naturalWidth = sizeBitmap.width
			naturalHeight = sizeBitmap.height
			maxDim = Math.max(naturalWidth, naturalHeight)
			sizeBitmap.close()
		} else {
			// 不支持 ImageBitmap：使用 HTMLImageElement 获取尺寸（降级方案）
			const img = await new Promise<HTMLImageElement>((resolve, reject) => {
				const image = new Image()
				image.onload = () => resolve(image)
				image.onerror = reject
				image.src = URL.createObjectURL(blob)
			})
			naturalWidth = img.naturalWidth
			naturalHeight = img.naturalHeight
			maxDim = Math.max(naturalWidth, naturalHeight)
			URL.revokeObjectURL(img.src)
		}

		const thumbnails: { small: string } = {} as {
			small: string
		}

		// Small: decide based on size
		if (maxDim <= SMALL_THUMBNAIL_MAX_SIZE) {
			const direct = await blobToDataUrl(blob)
			thumbnails.small = direct
		} else {
			if (supportsImageBitmap) {
				const smallBitmap = await createImageBitmap(blob, {
					resizeWidth: SMALL_THUMBNAIL_MAX_SIZE,
					resizeQuality: "high",
				})
				thumbnails.small = await bitmapToDataUrl(smallBitmap, 1)
			} else {
				// 降级：使用 canvas 缩放
				const img = await new Promise<HTMLImageElement>((resolve, reject) => {
					const image = new Image()
					image.onload = () => resolve(image)
					image.onerror = reject
					image.src = URL.createObjectURL(blob)
				})
				const canvas = new OffscreenCanvas(
					SMALL_THUMBNAIL_MAX_SIZE,
					(SMALL_THUMBNAIL_MAX_SIZE * img.naturalHeight) / img.naturalWidth,
				)
				const ctx = canvas.getContext("2d")
				if (ctx) {
					ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
					thumbnails.small = await blobToDataUrl(
						await canvas.convertToBlob({ type: "image/jpeg", quality: 1 }),
					)
				}
				URL.revokeObjectURL(img.src)
			}
			// tooltip场景直接用ossSrc渲染，不再生成tooltip缩略图
			// } else if (maxDim <= TOOLTIP_THUMBNAIL_MIN_SIZE) {
			// 	thumbnails.small = await blobToDataUrl(blob)
			// 	const tooltipBitmap = await createImageBitmap(blob, {
			// 		resizeWidth: TOOLTIP_THUMBNAIL_MIN_SIZE,
			// 		resizeQuality: "high",
			// 	})
			// 	thumbnails.tooltip = await bitmapToDataUrl(tooltipBitmap, 0.95)
			// } else {
			// 	const [smallBitmap, tooltipBitmap] = await Promise.all([
			// 		createImageBitmap(blob, {
			// 			resizeWidth: SMALL_THUMBNAIL_MAX_SIZE,
			// 			resizeQuality: "high",
			// 		}),
			// 		createImageBitmap(blob, {
			// 			resizeWidth: TOOLTIP_THUMBNAIL_MIN_SIZE,
			// 			resizeQuality: "high",
			// 		}),
			// 	])
			// 	thumbnails.small = await bitmapToDataUrl(smallBitmap, 0.9)
			// 	thumbnails.tooltip = await bitmapToDataUrl(tooltipBitmap, 0.95)
		}

		// Compressed: full size, dynamic quality
		// const pixelCount = naturalWidth * naturalHeight
		// const useWebp = await checkWebpSupportInWorker()
		// const quality = getCompressedQuality(
		// 	pixelCount,
		// 	fileSize,
		// 	useWebp ? COMPRESSED_WEBP_QUALITY : COMPRESSED_JPEG_QUALITY,
		// )
		// const compressedBitmap = await createImageBitmap(blob)
		// thumbnails.compressed = await bitmapToDataUrl(compressedBitmap, quality)

		const imageInfo = {
			naturalWidth,
			naturalHeight,
			fileSize,
			mimeType: contentType,
			filename,
		}

		// 根据是否支持 ImageBitmap 决定返回类型
		if (supportsImageBitmap) {
			// 创建用于传递的完整 ImageBitmap（将通过 transferable 传递，实现零拷贝）
			const imageSource = await createImageBitmap(blob)
			return {
				requestId,
				imageSource,
				imageInfo,
				thumbnails,
			}
		} else {
			// 降级：返回 blob，主线程将使用 createImageSourceFromBlob 创建 ImageSource（会降级到 HTMLImageElement）
			return {
				requestId,
				blob,
				imageInfo,
				thumbnails,
			}
		}
	} catch (err) {
		return {
			requestId,
			error: err instanceof Error ? err.message : String(err),
			thumbnails: { small: "" }, // 错误情况下返回空 thumbnails（不会被使用）
		}
	}
}

self.onmessage = (e: MessageEvent<ImageResourceWorkerRequest>) => {
	processRequest(e.data).then((response) => {
		// 如果响应中包含 ImageBitmap，通过 transferable 传递以实现零拷贝
		// 如果响应中包含 Blob，直接传递（Blob 也是 transferable，但为了兼容性直接传递）
		if (response.imageSource) {
			self.postMessage(response, { transfer: [response.imageSource] })
		} else if (response.blob) {
			// Blob 也可以通过 transfer 传递，但为了兼容性直接传递
			self.postMessage(response)
		} else {
			self.postMessage(response)
		}
	})
}
