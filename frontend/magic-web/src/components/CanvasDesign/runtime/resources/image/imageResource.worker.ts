import { parseImageMetadataFromBlobHeader } from "./imageHeaderDimensions"
import { createOrientedImageBitmapFromBlob } from "./imageSourceUtils"
import type { ImageExifOrientation, ImageOrientationMetadata } from "./imageOrientation"

export type ImageResourceDecodeVariant = "low" | "preview" | "full"
export type ImageResourceWorkerRequestType =
	| "decode"
	| "encode-persistent-low"
	| "warmup"
	| "cancel"

export interface ImageResourceWorkerRequest {
	type?: ImageResourceWorkerRequestType
	ossSrc?: string
	/** 已由主线程获取并缓存的压缩 body；存在时 worker 只负责解码，不再 fetch。 */
	blob?: Blob
	filename?: string
	requestId: string
	mainThreadSentAt?: number
	variant?: ImageResourceDecodeVariant
	maxEdge?: number
	/** `cancel` 消息要取消的 decode requestId。 */
	targetRequestId?: string
	/** 已由主线程从 decoded resource 派生的 low bitmap；仅 encode-persistent-low 使用。 */
	imageSource?: ImageBitmap
	/** decoded source 对应的原始图片信息；仅 encode-persistent-low 使用。 */
	imageInfo?: ImageResourceWorkerResponse["imageInfo"]
}

export interface ImageResourceWorkerTimings {
	workerQueueMs?: number
	workerTotalMs: number
	fetchMs?: number
	metadataMs?: number
	imageDecodeMs?: number
	persistentDisplayMs?: number
	blobBytes?: number
	imageBitmapWidth?: number
	imageBitmapHeight?: number
	imageBitmapResized?: boolean
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
		orientation?: ImageExifOrientation
		encodedWidth?: number
		encodedHeight?: number
		fileSize: number
		mimeType: string
		filename: string
	}
	/** 可持久化的低清显示资源，仅用于 low 首屏缓存 */
	persistentDisplay?: {
		blob: Blob
		mimeType: string
		width: number
		height: number
	}
	/** 错误信息 */
	error?: string
	/** 响应状态码（非 2xx 时返回） */
	statusCode?: number
	/** 本次解码变体 */
	variant?: ImageResourceDecodeVariant
	cancelled?: boolean
	timings?: ImageResourceWorkerTimings
}

export interface ImageResourceWorkerReadyMessage {
	type: "ready"
	workerBootedAt: number
	workerReadyPostedAt: number
	workerTopLevelMs: number
}

export type ImageResourceWorkerMessage =
	| ImageResourceWorkerResponse
	| ImageResourceWorkerReadyMessage

const IMAGE_RESOURCE_WORKER_BOOTED_AT = Date.now()

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
const cancelledRequestIds = new Set<string>()
const activeRequestIds = new Set<string>()

function isCancelled(requestId: string): boolean {
	return cancelledRequestIds.has(requestId)
}

function createCancelledResponse(
	requestId: string,
	variant: ImageResourceDecodeVariant,
): ImageResourceWorkerResponse {
	cancelledRequestIds.delete(requestId)
	return { requestId, variant, cancelled: true, timings: { workerTotalMs: 0 } }
}

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

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = reject
		reader.readAsDataURL(blob)
	})
}

/**
 * 检测 Worker 环境是否支持 ImageBitmap
 */
function isImageBitmapSupported(): boolean {
	return typeof createImageBitmap === "function"
}

function getResizeDimensions(options: { width: number; height: number; maxEdge?: number }): {
	width: number
	height: number
	resized: boolean
} {
	const { width, height, maxEdge } = options
	if (!maxEdge || maxEdge <= 0) {
		return { width, height, resized: false }
	}

	const largestEdge = Math.max(width, height)
	if (largestEdge <= maxEdge) {
		return { width, height, resized: false }
	}

	const scale = maxEdge / largestEdge
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
		resized: true,
	}
}

async function getImageMetadata(options: {
	blob: Blob
	ossSrc: string
	passedFilename?: string
	supportsImageBitmap: boolean
}): Promise<{
	imageInfo: NonNullable<ImageResourceWorkerResponse["imageInfo"]>
	maxDim: number
}> {
	const { blob, ossSrc, passedFilename, supportsImageBitmap } = options
	const contentType = blob.type || "image/jpeg"
	const fileSize = blob.size
	const extractedFilename = extractFilenameFromUrl(ossSrc)
	const filename =
		passedFilename || extractedFilename || `image.${getFileExtensionFromMimeType(contentType)}`

	let metadata = await parseImageMetadataFromBlobHeader(blob)

	if (!metadata && supportsImageBitmap) {
		// 支持 ImageBitmap：创建用于获取尺寸信息的 bitmap（稍后关闭）
		const sizeBitmap = await createOrientedImageBitmapFromBlob(blob)
		metadata = {
			width: sizeBitmap.width,
			height: sizeBitmap.height,
			orientation: 1,
			encodedWidth: sizeBitmap.width,
			encodedHeight: sizeBitmap.height,
		}
		sizeBitmap.close()
	} else if (!metadata) {
		// 不支持 ImageBitmap：使用 HTMLImageElement 获取尺寸（降级方案）
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image()
			image.onload = () => resolve(image)
			image.onerror = reject
			image.src = URL.createObjectURL(blob)
		})
		metadata = {
			width: img.naturalWidth,
			height: img.naturalHeight,
			orientation: 1,
			encodedWidth: img.naturalWidth,
			encodedHeight: img.naturalHeight,
		}
		URL.revokeObjectURL(img.src)
	}
	if (!metadata) {
		throw new Error("Unable to read image dimensions")
	}

	const naturalWidth = metadata.width
	const naturalHeight = metadata.height
	return {
		imageInfo: {
			naturalWidth,
			naturalHeight,
			orientation: metadata.orientation,
			encodedWidth: metadata.encodedWidth,
			encodedHeight: metadata.encodedHeight,
			fileSize,
			mimeType: contentType,
			filename,
		},
		maxDim: Math.max(naturalWidth, naturalHeight),
	}
}

async function createImageBitmapForVariant(options: {
	blob: Blob
	imageInfo: NonNullable<ImageResourceWorkerResponse["imageInfo"]>
	variant: ImageResourceDecodeVariant
	maxEdge?: number
}): Promise<{
	imageBitmap: ImageBitmap
	resized: boolean
	targetWidth: number
	targetHeight: number
}> {
	const { blob, imageInfo, variant, maxEdge } = options
	const orientationMetadata: ImageOrientationMetadata | undefined =
		imageInfo.orientation && imageInfo.encodedWidth && imageInfo.encodedHeight
			? {
					width: imageInfo.naturalWidth,
					height: imageInfo.naturalHeight,
					orientation: imageInfo.orientation,
					encodedWidth: imageInfo.encodedWidth,
					encodedHeight: imageInfo.encodedHeight,
				}
			: undefined
	const resize = getResizeDimensions({
		width: imageInfo.naturalWidth,
		height: imageInfo.naturalHeight,
		maxEdge: variant === "full" ? undefined : maxEdge,
	})

	if (!resize.resized) {
		const imageBitmap = await createOrientedImageBitmapFromBlob(blob, {}, orientationMetadata)
		return {
			imageBitmap,
			resized: false,
			targetWidth: imageBitmap.width,
			targetHeight: imageBitmap.height,
		}
	}

	let imageBitmap = await createOrientedImageBitmapFromBlob(
		blob,
		{
			resizeWidth: resize.width,
			resizeHeight: resize.height,
			resizeQuality: "high",
		},
		orientationMetadata,
	)
	if (imageBitmap.width !== resize.width || imageBitmap.height !== resize.height) {
		const resizedBitmap = await createImageBitmap(imageBitmap, {
			resizeWidth: resize.width,
			resizeHeight: resize.height,
			resizeQuality: "high",
		})
		imageBitmap.close()
		imageBitmap = resizedBitmap
	}
	return {
		imageBitmap,
		resized: true,
		targetWidth: resize.width,
		targetHeight: resize.height,
	}
}

async function createPersistentDisplayBlob(
	imageBitmap: ImageBitmap,
	variant: ImageResourceDecodeVariant,
): Promise<ImageResourceWorkerResponse["persistentDisplay"] | undefined> {
	if (variant !== "low") return undefined

	const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height)
	const ctx = canvas.getContext("2d")
	if (!ctx) return undefined
	ctx.drawImage(imageBitmap, 0, 0)

	const useWebp = await checkWebpSupportInWorker()
	const mimeType = useWebp ? "image/webp" : "image/png"
	const blob = await canvas.convertToBlob({
		type: mimeType,
		quality: 0.82,
	})
	return {
		blob,
		mimeType: blob.type || mimeType,
		width: imageBitmap.width,
		height: imageBitmap.height,
	}
}

async function processRequest(
	request: ImageResourceWorkerRequest,
): Promise<ImageResourceWorkerResponse> {
	const {
		ossSrc,
		filename: passedFilename,
		requestId,
		mainThreadSentAt,
		variant = "full",
		maxEdge,
	} = request
	const workerStartedAt = Date.now()
	const timings: ImageResourceWorkerTimings = {
		workerQueueMs:
			typeof mainThreadSentAt === "number"
				? Math.max(0, workerStartedAt - mainThreadSentAt)
				: undefined,
		workerTotalMs: 0,
	}

	const markTiming = <K extends keyof ImageResourceWorkerTimings>(
		key: K,
		startedAt: number,
	): void => {
		timings[key] = Math.max(0, Date.now() - startedAt) as ImageResourceWorkerTimings[K]
	}

	const completeTimings = (): ImageResourceWorkerTimings => {
		timings.workerTotalMs = Math.max(0, Date.now() - workerStartedAt)
		return timings
	}

	try {
		if (isCancelled(requestId)) return createCancelledResponse(requestId, variant)
		if (request.type === "warmup") {
			return {
				requestId,
				variant,
				timings: completeTimings(),
			}
		}
		if (request.type === "encode-persistent-low") {
			const imageSource = request.imageSource
			if (!imageSource || !request.imageInfo) {
				throw new Error("Missing decoded low source")
			}
			try {
				if (isCancelled(requestId)) return createCancelledResponse(requestId, "low")
				const persistentDisplayStartedAt = Date.now()
				const persistentDisplay = await createPersistentDisplayBlob(imageSource, "low")
				if (isCancelled(requestId)) return createCancelledResponse(requestId, "low")
				if (persistentDisplay) {
					markTiming("persistentDisplayMs", persistentDisplayStartedAt)
				}
				return {
					requestId,
					imageInfo: request.imageInfo,
					persistentDisplay,
					variant: "low",
					timings: completeTimings(),
				}
			} finally {
				imageSource.close()
			}
		}

		if (!ossSrc) {
			throw new Error("Missing ossSrc")
		}

		const fetchStartedAt = Date.now()
		const blob = request.blob
			? request.blob
			: await (async () => {
					const response = await fetch(ossSrc, { cache: "default" })
					if (!response.ok) {
						const needsReExchange = response.status === 401 || response.status === 403
						throw Object.assign(new Error(`Fetch failed: ${response.status}`), {
							statusCode: response.status,
							needsReExchange,
						})
					}
					return response.blob()
				})()
		if (!request.blob) {
			markTiming("fetchMs", fetchStartedAt)
		}
		if (isCancelled(requestId)) return createCancelledResponse(requestId, variant)
		timings.blobBytes = blob.size
		const supportsImageBitmap = isImageBitmapSupported()
		const metadataStartedAt = Date.now()
		const { imageInfo } = await getImageMetadata({
			blob,
			ossSrc,
			passedFilename,
			supportsImageBitmap,
		})
		if (isCancelled(requestId)) return createCancelledResponse(requestId, variant)
		markTiming("metadataMs", metadataStartedAt)

		// 根据是否支持 ImageBitmap 决定返回类型
		if (supportsImageBitmap) {
			// 创建用于传递的 ImageBitmap（preview 会在 Worker 内缩放，full 保持原图）
			const imageDecodeStartedAt = Date.now()
			const {
				imageBitmap: imageSource,
				resized,
				targetWidth,
				targetHeight,
			} = await createImageBitmapForVariant({
				blob,
				imageInfo,
				variant,
				maxEdge,
			})
			if (isCancelled(requestId)) {
				imageSource.close()
				return createCancelledResponse(requestId, variant)
			}
			markTiming("imageDecodeMs", imageDecodeStartedAt)
			const persistentDisplayStartedAt = Date.now()
			const persistentDisplay = await createPersistentDisplayBlob(imageSource, variant)
			if (isCancelled(requestId)) {
				imageSource.close()
				return createCancelledResponse(requestId, variant)
			}
			if (persistentDisplay) {
				markTiming("persistentDisplayMs", persistentDisplayStartedAt)
			}
			timings.imageBitmapWidth = targetWidth
			timings.imageBitmapHeight = targetHeight
			timings.imageBitmapResized = resized
			return {
				requestId,
				imageSource,
				imageInfo,
				persistentDisplay,
				variant,
				timings: completeTimings(),
			}
		} else {
			// 降级：返回 blob，主线程将使用 createImageSourceFromBlob 创建 ImageSource（会降级到 HTMLImageElement）
			return {
				requestId,
				blob,
				imageInfo,
				variant,
				timings: completeTimings(),
			}
		}
	} catch (err) {
		const statusCode =
			err && typeof err === "object" && "statusCode" in err
				? Number((err as { statusCode?: unknown }).statusCode)
				: undefined
		const needsReExchange =
			err && typeof err === "object" && "needsReExchange" in err
				? Boolean((err as { needsReExchange?: unknown }).needsReExchange)
				: undefined
		return {
			requestId,
			error: err instanceof Error ? err.message : String(err),
			...(statusCode && { statusCode }),
			...(needsReExchange && { needsReExchange }),
			timings: completeTimings(),
		}
	}
}

self.onmessage = (e: MessageEvent<ImageResourceWorkerRequest>) => {
	if (e.data.type === "cancel") {
		if (e.data.targetRequestId && activeRequestIds.has(e.data.targetRequestId)) {
			cancelledRequestIds.add(e.data.targetRequestId)
		}
		return
	}
	activeRequestIds.add(e.data.requestId)
	processRequest(e.data)
		.then((response) => {
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
		.finally(() => {
			activeRequestIds.delete(e.data.requestId)
			cancelledRequestIds.delete(e.data.requestId)
		})
}

const IMAGE_RESOURCE_WORKER_READY_POSTED_AT = Date.now()
self.postMessage({
	type: "ready",
	workerBootedAt: IMAGE_RESOURCE_WORKER_BOOTED_AT,
	workerReadyPostedAt: IMAGE_RESOURCE_WORKER_READY_POSTED_AT,
	workerTopLevelMs: Math.max(
		0,
		IMAGE_RESOURCE_WORKER_READY_POSTED_AT - IMAGE_RESOURCE_WORKER_BOOTED_AT,
	),
} satisfies ImageResourceWorkerReadyMessage)
