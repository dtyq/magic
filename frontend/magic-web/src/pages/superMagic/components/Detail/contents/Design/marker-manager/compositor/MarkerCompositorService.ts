import type { Marker, MarkerArea, ImageElement } from "@/components/CanvasDesign/canvas/types"
import { MarkerTypeEnum } from "@/components/CanvasDesign/canvas/types"
import type {
	IdentifyImageMarkRequest,
	IdentifyImageMarkResponse,
	UploadPrivateFile,
	UploadPrivateFileResponse,
} from "@/components/CanvasDesign/types.magic"
import { getPersistedSourceCrop } from "@/components/CanvasDesign/canvas/utils/imageCropUtils"
import { drawMarkerOnCanvas } from "./markerDrawers"
import { generateUUID } from "@/components/CanvasDesign/canvas/utils/utils"

/** 用于合成的图片信息 */
interface ImageInfoForComposite {
	naturalWidth: number
	naturalHeight: number
	fileSize: number
	mimeType: string
	filename: string
}

interface ImageCompressionConfig {
	enableCompression: boolean
	minBytesPerPixel: number
	minQuality: number
	maxQuality: number
	pngMinBytesPerPixel: number
	pngToJpegThreshold: number
	pngToJpegQuality: number
	qualityCurveCoefficient: number
}

const DEFAULT_COMPRESSION_CONFIG: ImageCompressionConfig = {
	enableCompression: true,
	minBytesPerPixel: 0.3,
	minQuality: 0.65,
	maxQuality: 0.92,
	pngMinBytesPerPixel: 1.0,
	pngToJpegThreshold: 500 * 1024,
	pngToJpegQuality: 0.9,
	qualityCurveCoefficient: 0.3,
}

export interface MarkerCompositorMethods {
	getFileInfo: (
		path: string,
		options?: { useImageProcess?: boolean; forceRefresh?: boolean },
	) => Promise<{ src?: string }>
	uploadPrivateFiles: (files: UploadPrivateFile[]) => Promise<UploadPrivateFileResponse[]>
	identifyImageMark: (params: IdentifyImageMarkRequest) => Promise<IdentifyImageMarkResponse>
}

export interface MarkerCompositorInput {
	marker: Marker
	element: ImageElement
	sequence: number
	methods: MarkerCompositorMethods
	projectId?: string
	signal?: AbortSignal
	/** 可选的图片信息（从画布获取，避免重复加载） */
	imageInfo?: Partial<ImageInfoForComposite>
	/** 可选的 OSS URL（从画布获取，避免重复调用 getFileInfo） */
	ossUrl?: string
	/** 可选的图片对象（从画布获取，避免重复加载） */
	image?: HTMLImageElement | ImageBitmap
}

export interface CompositeResult {
	filePath: string
	imageInfo: ImageInfoForComposite
}

export interface IdentifyInput {
	marker: Marker
	filePath: string
	imageInfo: ImageInfoForComposite
	methods: Pick<MarkerCompositorMethods, "identifyImageMark">
	projectId?: string
	signal?: AbortSignal
}

/**
 * 无画布合成服务：加载图片、绘制 marker、压缩、上传、识别
 */
export class MarkerCompositorService {
	/**
	 * 合成 marker 与图片并上传
	 * @returns 返回上传后的文件路径和图片信息
	 */
	static async composite(input: MarkerCompositorInput): Promise<CompositeResult> {
		const {
			marker,
			element,
			sequence,
			methods,
			signal,
			imageInfo: providedImageInfo,
			ossUrl: providedOssUrl,
			image: providedImage,
		} = input
		const { getFileInfo, uploadPrivateFiles } = methods

		if (!element.src) {
			throw new Error("图片元素 src 为空")
		}

		// 1. 获取 OSS URL（优先使用提供的）
		let ossUrl = providedOssUrl
		if (!ossUrl) {
			throwIfAborted(signal)
			const fileInfo = await getFileInfo(element.src, { useImageProcess: true })
			ossUrl = fileInfo?.src
			if (!ossUrl) {
				throw new Error(`无法获取图片 OSS 地址: ${element.src}`)
			}
		}

		// 2. 加载图片和获取图片信息（优先使用提供的）
		let image: HTMLImageElement | ImageBitmap
		let imageInfo: ImageInfoForComposite

		if (providedImage && providedImageInfo?.naturalWidth && providedImageInfo?.naturalHeight) {
			// 使用提供的图片对象和信息（从画布获取）
			image = providedImage
			imageInfo = {
				naturalWidth: providedImageInfo.naturalWidth,
				naturalHeight: providedImageInfo.naturalHeight,
				fileSize: providedImageInfo.fileSize ?? 0,
				mimeType: providedImageInfo.mimeType ?? "image/png",
				filename: providedImageInfo.filename ?? "image.png",
			}
		} else {
			// 降级：加载图片
			const loaded = await loadImageFromUrl(ossUrl, signal)
			image = loaded.image
			imageInfo = loaded.imageInfo
		}

		throwIfAborted(signal)
		const sourceCrop = getCompositeSourceCrop(element, imageInfo)
		const compositeImageInfo = getCompositeImageInfo(imageInfo, sourceCrop)

		// 3. 创建离屏 canvas 并绘制
		const composedFile = await compositeMarkerWithImage(
			marker,
			image,
			imageInfo,
			compositeImageInfo,
			sequence,
			sourceCrop,
			signal,
		)

		// 4. 上传
		throwIfAborted(signal)
		const uploadResults = await uploadPrivateFiles([
			{
				file: composedFile,
				relativePath: "design-mark/",
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				onUploadComplete: () => {},
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				onUploadFailed: () => {},
			},
		])

		if (!uploadResults?.length || !uploadResults[0].path) {
			throw new Error("上传文件失败：未返回文件路径")
		}

		const filePath = uploadResults[0].path

		return {
			filePath,
			imageInfo: compositeImageInfo,
		}
	}

	/**
	 * 识别图片标记
	 * @returns 返回识别结果
	 */
	static async identify(input: IdentifyInput): Promise<IdentifyImageMarkResponse> {
		const { marker, filePath, imageInfo, methods, projectId, signal } = input
		const { identifyImageMark } = methods

		throwIfAborted(signal)
		const request = buildIdentifyRequest(marker, filePath, imageInfo, projectId)
		const result = await identifyImageMark(request)
		throwIfAborted(signal)
		return result
	}

	/**
	 * 将 marker 与图片合成并完成识别（便捷方法）
	 */
	static async compositeAndIdentify(
		input: MarkerCompositorInput,
	): Promise<IdentifyImageMarkResponse> {
		const compositeResult = await this.composite(input)
		return this.identify({
			marker: input.marker,
			filePath: compositeResult.filePath,
			imageInfo: compositeResult.imageInfo,
			methods: {
				identifyImageMark: input.methods.identifyImageMark,
			},
			projectId: input.projectId,
		})
	}
}

async function loadImageFromUrl(
	url: string,
	signal?: AbortSignal,
): Promise<{ image: HTMLImageElement; imageInfo: ImageInfoForComposite }> {
	throwIfAborted(signal)
	const response = await fetch(url, { signal })
	if (!response.ok) {
		throw new Error(`加载图片失败: ${response.status} ${response.statusText}`)
	}

	const blob = await response.blob()
	const fileSize = blob.size
	const mimeType = blob.type || "image/png"

	const image = await createImageFromBlob(blob, signal)
	const naturalWidth = image.naturalWidth
	const naturalHeight = image.naturalHeight

	const urlPath = url.split("?")[0] || ""
	const filename = urlPath.split("/").pop() || "image.png"

	return {
		image,
		imageInfo: {
			naturalWidth,
			naturalHeight,
			fileSize,
			mimeType,
			filename,
		},
	}
}

function createImageFromBlob(blob: Blob, signal?: AbortSignal): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(createAbortError())
			return
		}

		const url = URL.createObjectURL(blob)
		const img = new Image()
		const cleanup = () => {
			signal?.removeEventListener("abort", handleAbort)
			URL.revokeObjectURL(url)
		}
		const handleAbort = () => {
			img.src = ""
			cleanup()
			reject(createAbortError())
		}
		img.onload = () => {
			cleanup()
			resolve(img)
		}
		img.onerror = () => {
			cleanup()
			reject(new Error("创建图片失败"))
		}
		signal?.addEventListener("abort", handleAbort, { once: true })
		img.src = url
	})
}

function shouldCompressImage(
	params: { fileSize: number; width: number; height: number; mimeType: string },
	config: ImageCompressionConfig = DEFAULT_COMPRESSION_CONFIG,
): { compress: boolean; quality: number; outputFormat: string } {
	const { fileSize, width, height, mimeType } = params

	if (!config.enableCompression) {
		return { compress: false, quality: 1.0, outputFormat: mimeType }
	}

	const totalPixels = width * height
	const bytesPerPixel = fileSize / totalPixels

	if (mimeType === "image/png") {
		if (bytesPerPixel < config.pngMinBytesPerPixel) {
			return { compress: false, quality: 1.0, outputFormat: mimeType }
		}
		if (bytesPerPixel > 2.0 && fileSize > config.pngToJpegThreshold) {
			return {
				compress: true,
				quality: config.pngToJpegQuality,
				outputFormat: "image/jpeg",
			}
		}
		return { compress: false, quality: 1.0, outputFormat: mimeType }
	}

	if (bytesPerPixel < config.minBytesPerPixel) {
		return { compress: false, quality: 1.0, outputFormat: mimeType }
	}

	const quality = Math.max(
		config.minQuality,
		Math.min(
			config.maxQuality,
			1.0 - Math.log10(bytesPerPixel + 1) * config.qualityCurveCoefficient,
		),
	)

	return {
		compress: true,
		quality: Math.round(quality * 100) / 100,
		outputFormat: "image/jpeg",
	}
}

async function compositeMarkerWithImage(
	marker: Marker,
	image: HTMLImageElement | ImageBitmap,
	imageInfo: ImageInfoForComposite,
	compositeImageInfo: ImageInfoForComposite,
	sequence: number,
	sourceCrop?: { x: number; y: number; width: number; height: number },
	signal?: AbortSignal,
): Promise<File> {
	throwIfAborted(signal)
	const canvas = document.createElement("canvas")
	canvas.width = compositeImageInfo.naturalWidth
	canvas.height = compositeImageInfo.naturalHeight

	const ctx = canvas.getContext("2d")
	if (!ctx) {
		throw new Error("获取 Canvas 2D 上下文失败")
	}

	// 绘制原图
	if (sourceCrop) {
		ctx.drawImage(
			image,
			sourceCrop.x,
			sourceCrop.y,
			sourceCrop.width,
			sourceCrop.height,
			0,
			0,
			compositeImageInfo.naturalWidth,
			compositeImageInfo.naturalHeight,
		)
	} else {
		ctx.drawImage(
			image,
			0,
			0,
			compositeImageInfo.naturalWidth,
			compositeImageInfo.naturalHeight,
		)
	}

	// 绘制 marker
	drawMarkerOnCanvas(ctx, marker, compositeImageInfo, sequence)

	// 压缩策略
	const compressionResult = shouldCompressImage({
		fileSize: imageInfo.fileSize,
		width: compositeImageInfo.naturalWidth,
		height: compositeImageInfo.naturalHeight,
		mimeType: imageInfo.mimeType,
	})

	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob(
			resolve,
			compressionResult.outputFormat as "image/jpeg" | "image/png",
			compressionResult.quality,
		)
	})

	if (!blob) {
		throw new Error("将 Canvas 转换为 Blob 失败")
	}
	throwIfAborted(signal)

	const lastDotIndex = imageInfo.filename.lastIndexOf(".")
	const baseExt = lastDotIndex !== -1 ? imageInfo.filename.slice(lastDotIndex) : ""
	let ext = baseExt
	if (compressionResult.outputFormat === "image/jpeg" && baseExt.toLowerCase() === ".png") {
		ext = ".jpg"
	}
	const newFilename = `${generateUUID()}${ext}`

	return new File([blob], newFilename, { type: compressionResult.outputFormat })
}

function throwIfAborted(signal?: AbortSignal): void {
	if (!signal?.aborted) return
	throw createAbortError()
}

function createAbortError(): Error {
	return new DOMException("The operation was aborted", "AbortError")
}

function getCompositeSourceCrop(
	element: ImageElement,
	imageInfo: ImageInfoForComposite,
): { x: number; y: number; width: number; height: number } | undefined {
	const crop = getPersistedSourceCrop(element.crop, {
		width: imageInfo.naturalWidth,
		height: imageInfo.naturalHeight,
	})
	if (crop.width <= 0 || crop.height <= 0) return undefined
	if (
		crop.x === 0 &&
		crop.y === 0 &&
		crop.width === imageInfo.naturalWidth &&
		crop.height === imageInfo.naturalHeight
	) {
		return undefined
	}

	return crop
}

function getCompositeImageInfo(
	imageInfo: ImageInfoForComposite,
	sourceCrop?: { width: number; height: number },
): ImageInfoForComposite {
	if (!sourceCrop) return imageInfo

	return {
		...imageInfo,
		naturalWidth: Math.max(1, Math.round(sourceCrop.width)),
		naturalHeight: Math.max(1, Math.round(sourceCrop.height)),
	}
}

function buildIdentifyRequest(
	marker: Marker,
	filePath: string,
	imageInfo: ImageInfoForComposite,
	projectId?: string,
): IdentifyImageMarkRequest {
	if (marker.type === MarkerTypeEnum.Mark) {
		return {
			type: MarkerTypeEnum.Mark,
			project_id: projectId,
			file_path: filePath,
			mark: [marker.relativeX, marker.relativeY],
		}
	}

	const areaMarker = marker as MarkerArea
	const pixelWidth = areaMarker.areaWidth * imageInfo.naturalWidth
	const pixelHeight = areaMarker.areaHeight * imageInfo.naturalHeight
	return {
		type: MarkerTypeEnum.Area,
		project_id: projectId,
		file_path: filePath,
		area: [areaMarker.relativeX, areaMarker.relativeY, pixelWidth, pixelHeight],
	}
}
