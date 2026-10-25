/**
 * ImageSource 工具模块
 * 统一 HTMLImageElement 与 ImageBitmap 的抽象，优先使用 ImageBitmap（更省内存、可 transferable）
 * 在不支持的环境中自动降级为 HTMLImageElement
 */

import { parseImageMetadataFromBlobHeader } from "./imageHeaderDimensions"
import {
	applyImageExifOrientationTransform,
	createJpegBlobWithNeutralizedExifOrientation,
	getOrientedImageDimensions,
	IMAGE_BITMAP_ORIENTATION_OPTIONS,
} from "./imageOrientation"
import type { ImageExifOrientation, ImageOrientationMetadata } from "./imageOrientation"

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

function loadHtmlImage(blob: Blob): Promise<HTMLImageElement | null> {
	const blobUrl = URL.createObjectURL(blob)
	return new Promise((resolve) => {
		const image = new Image()
		image.crossOrigin = "anonymous"
		image.onload = () => {
			URL.revokeObjectURL(blobUrl)
			resolve(image)
		}
		image.onerror = () => {
			URL.revokeObjectURL(blobUrl)
			resolve(null)
		}
		image.src = blobUrl
	})
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, "image/png"))
}

function createOrientationCanvas(
	width: number,
	height: number,
): OffscreenCanvas | HTMLCanvasElement | null {
	if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height)
	if (typeof document === "undefined") return null
	return Object.assign(document.createElement("canvas"), { width, height })
}

async function applyOrientationToImageBitmap(
	bitmap: ImageBitmap,
	orientation: ImageExifOrientation,
): Promise<ImageBitmap> {
	if (orientation === 1) return bitmap
	const oriented = getOrientedImageDimensions(bitmap.width, bitmap.height, orientation)
	const canvas = createOrientationCanvas(oriented.width, oriented.height)
	if (!canvas) return bitmap
	const context = canvas.getContext("2d")
	if (!context) return bitmap
	applyImageExifOrientationTransform(context, orientation, bitmap.width, bitmap.height)
	context.drawImage(bitmap, 0, 0)
	try {
		const normalized = await createImageBitmap(canvas)
		bitmap.close()
		return normalized
	} catch {
		return bitmap
	}
}

function getDisplayResizeDimensions(
	options: ImageBitmapOptions,
	metadata: ImageOrientationMetadata,
): { width: number; height: number } | null {
	const resizeWidth = options.resizeWidth
	const resizeHeight = options.resizeHeight
	if (resizeWidth === undefined && resizeHeight === undefined) return null
	if (resizeWidth !== undefined && resizeHeight !== undefined) {
		return { width: resizeWidth, height: resizeHeight }
	}
	if (resizeWidth !== undefined) {
		return {
			width: resizeWidth,
			height: Math.max(1, Math.round((metadata.height * resizeWidth) / metadata.width)),
		}
	}
	if (resizeHeight !== undefined) {
		return {
			width: Math.max(1, Math.round((metadata.width * resizeHeight) / metadata.height)),
			height: resizeHeight,
		}
	}
	return null
}

async function createDeterministicallyOrientedBitmap(
	blob: Blob,
	options: ImageBitmapOptions,
	metadata: ImageOrientationMetadata,
): Promise<ImageBitmap | null> {
	if (metadata.orientation === 1) return null
	const displayResize = getDisplayResizeDimensions(options, metadata)
	const neutralizedBlob = await createJpegBlobWithNeutralizedExifOrientation(blob)
	if (!neutralizedBlob) return null

	const encodedResize = displayResize
		? getOrientedImageDimensions(
				displayResize.width,
				displayResize.height,
				metadata.orientation,
			)
		: null
	const encodedBitmap = await createImageBitmap(neutralizedBlob, {
		...options,
		...(encodedResize
			? { resizeWidth: encodedResize.width, resizeHeight: encodedResize.height }
			: {}),
		...IMAGE_BITMAP_ORIENTATION_OPTIONS,
	})
	return applyOrientationToImageBitmap(encodedBitmap, metadata.orientation)
}

async function normalizeImageBitmapWithMetadata(
	bitmap: ImageBitmap,
	metadata: ImageOrientationMetadata | null,
): Promise<ImageBitmap> {
	if (!metadata || metadata.orientation === 1) return bitmap
	if (bitmap.width === metadata.width && bitmap.height === metadata.height) {
		return bitmap
	}
	if (bitmap.width !== metadata.encodedWidth || bitmap.height !== metadata.encodedHeight) {
		return bitmap
	}
	return applyOrientationToImageBitmap(bitmap, metadata.orientation)
}

export async function createOrientedImageBitmapFromBlob(
	blob: Blob,
	options: ImageBitmapOptions = {},
	knownMetadata?: ImageOrientationMetadata | null,
): Promise<ImageBitmap> {
	const metadata = knownMetadata ?? (await parseImageMetadataFromBlobHeader(blob))
	if (metadata) {
		const deterministicBitmap = await createDeterministicallyOrientedBitmap(
			blob,
			options,
			metadata,
		)
		if (deterministicBitmap) {
			return deterministicBitmap
		}
	}
	const bitmap = await createImageBitmap(blob, {
		...options,
		...IMAGE_BITMAP_ORIENTATION_OPTIONS,
	})
	return normalizeImageBitmapWithMetadata(bitmap, metadata)
}

async function normalizeHtmlImageOrientation(
	image: HTMLImageElement,
	blob: Blob,
): Promise<HTMLImageElement | null> {
	const metadata = await parseImageMetadataFromBlobHeader(blob)
	if (!metadata || metadata.orientation === 1) return image

	// HTMLImageElement 是否应用 EXIF 依赖浏览器，且方向 2/3/4 无法通过宽高判断。
	// 优先中和 EXIF 后重新解码，再由 Canvas 确定性地应用完整旋转/镜像。
	const neutralizedBlob = await createJpegBlobWithNeutralizedExifOrientation(blob)
	const encodedImage = neutralizedBlob ? await loadHtmlImage(neutralizedBlob) : null
	if (!encodedImage) return image

	const canvas = document.createElement("canvas")
	canvas.width = metadata.width
	canvas.height = metadata.height
	const context = canvas.getContext("2d")
	if (!context) return image
	applyImageExifOrientationTransform(
		context,
		metadata.orientation,
		metadata.encodedWidth,
		metadata.encodedHeight,
	)
	context.drawImage(encodedImage, 0, 0, metadata.encodedWidth, metadata.encodedHeight)
	const normalizedBlob = await canvasToBlob(canvas)
	return normalizedBlob ? loadHtmlImage(normalizedBlob) : image
}

/**
 * 从 Blob 创建可绘制图片源
 * 优先尝试 ImageBitmap（现代浏览器、零拷贝、省内存），失败则降级为 HTMLImageElement
 */
export async function createImageSourceFromBlob(blob: Blob): Promise<ImageSource | null> {
	// 1. 优先 ImageBitmap（Safari 15+、Chrome 50+、Firefox 42+）
	if (typeof createImageBitmap === "function") {
		try {
			return await createOrientedImageBitmapFromBlob(blob)
		} catch {
			// 解码失败（损坏图片、不支持格式等）时降级
		}
	}

	// 2. 降级：HTMLImageElement + blob URL
	const image = await loadHtmlImage(blob)
	return image ? normalizeHtmlImageOrientation(image, blob) : null
}
